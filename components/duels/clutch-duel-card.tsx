"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Coins, Zap, ThumbsUp, ThumbsDown, Timer, Play, Trophy, Flame, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface ClutchDuelData {
  id: string
  loop_id?: string | null
  prompt?: string
  prediction_question?: string
  clip_url?: string
  betting_ends_at?: string
  correct_side?: "yes" | "no" | null
  outcome_revealed?: boolean
  payout_processed?: boolean
  yes_stake?: number
  no_stake?: number
  creator_id?: string
  status?: string
  creator?: { id: string; username?: string; display_name?: string; avatar_url?: string }
}

const STAKE_CHIPS = [10, 50, 100, 500]

export function ClutchDuelCard({ duel: initialDuel, loopId }: { duel?: ClutchDuelData; loopId?: string }) {
  const [duel, setDuel] = useState<ClutchDuelData | null>(initialDuel || null)
  const [summary, setSummary] = useState<{ yes: { predictions: number; stake: number }; no: { predictions: number; stake: number } } | null>(null)
  const [userPick, setUserPick] = useState<{ side: "yes" | "no"; stake: number } | null>(null)
  const [stakeAmount, setStakeAmount] = useState(50)
  const [lockedSide, setLockedSide] = useState<"yes" | "no" | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [phase, setPhase] = useState<"betting" | "revealing" | "revealed">("betting")
  const [staking, setStaking] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [myResult, setMyResult] = useState<{ kind: "win" | "loss" | "refund" | null; amount?: number } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  // Load duel by loopId if not passed in (e.g. loop detail page).
  useEffect(() => {
    if (initialDuel) {
      setDuel(initialDuel)
      return
    }
    if (loopId) {
      fetch(`/api/duels?loop_id=${loopId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.duels && data.duels[0]) setDuel(data.duels[0])
          else if (data.duel) setDuel(data.duel)
        })
        .catch(() => {})
    }
  }, [initialDuel, loopId])

  const refreshSummary = useCallback(async () => {
    if (!duel?.id) return
    try {
      const res = await fetch(`/api/duels/${duel.id}/predict`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setSummary(data.summary || null)
      setPhase(data.bettingOpen ? "betting" : (d) => (d === "betting" ? "revealed" : d))
    } catch {
      /* ignore */
    }
  }, [duel?.id])

  // Fetch summary + the viewer's own prediction.
  useEffect(() => {
    if (!duel?.id) return
    void refreshSummary()
    const token = user?.access_token || user?.token
    if (token) {
      fetch(`/api/duels/${duel.id}/predictions/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.prediction) {
            setUserPick({ side: data.prediction.side, stake: Number(data.prediction.stake_coins || 0) })
            setLockedSide(data.prediction.side)
          }
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel?.id])

  // Live prediction bars + outcome state, streamed over realtime.
  useEffect(() => {
    if (!duel?.id) return
    const channel = supabase
      .channel(`clutch-live:${duel.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clutch_duel_predictions", filter: `duel_id=eq.${duel.id}` },
        () => void refreshSummary(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loop_duels", filter: `id=eq.${duel.id}` },
        (payload: any) => {
          const next = payload.new as any
          if (next) {
            setDuel((prev) => (prev ? { ...prev, ...next } : prev))
            if (next.outcome_revealed) {
              setPhase("revealing")
              revealTimerRef.current = setTimeout(() => setPhase("revealed"), 1600)
            }
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    }
  }, [duel?.id, supabase, refreshSummary])

  // Countdown — the tension engine.
  useEffect(() => {
    if (!duel?.betting_ends_at) return
    if (duel.outcome_revealed) {
      setPhase("revealed")
      return
    }
    const endsAt = new Date(duel.betting_ends_at).getTime()
    const tick = () => {
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0) {
        setPhase("revealing")
        revealTimerRef.current = setTimeout(() => {
          setPhase("revealed")
          // Pull the freshest duel row so creator reveal UI shows post-window state.
          if (duel?.id) {
            fetch(`/api/duels?status=all&id=${duel.id}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.duels?.[0]) setDuel(d.duels[0])
              })
              .catch(() => {})
          }
        }, 1600)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => {
      clearInterval(interval)
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel?.betting_ends_at, duel?.outcome_revealed])

  // Resolve the viewer's result once revealed.
  useEffect(() => {
    if (phase !== "revealed" || !duel?.correct_side || !userPick) return
    if (userPick.side === duel.correct_side) setMyResult({ kind: "win" })
    else setMyResult({ kind: "loss" })
  }, [phase, duel?.correct_side, userPick])

  const totalStake = (summary?.yes?.stake || 0) + (summary?.no?.stake || 0)
  const yesPct = totalStake > 0 ? Math.round(((summary?.yes?.stake || 0) / totalStake) * 100) : 50
  const noPct = totalStake > 0 ? 100 - yesPct : 50

  const handlePredict = async (side: "yes" | "no") => {
    if (!user) {
      toast({ title: "Sign in required", description: "Log in to stake coins on this clutch duel!" })
      return
    }
    if (lockedSide) return
    if (!duel?.id) return
    setStaking(true)
    try {
      const res = await fetch(`/api/duels/${duel.id}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ side, stake: stakeAmount }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Prediction failed", description: data.error || "Could not stake coins", variant: "destructive" })
        return
      }
      setUserPick({ side, stake: stakeAmount })
      setLockedSide(side)
      toast({
        title: side === "yes" ? "Locked in — YES! 🔥" : "Locked in — NO! 🧊",
        description: `${stakeAmount} coins staked. Good luck!`,
      })
      void refreshSummary()
    } catch (err) {
      console.error("Predict error:", err)
      toast({ title: "Error", description: "Could not stake coins", variant: "destructive" })
    } finally {
      setStaking(false)
    }
  }

  const handleReveal = async (side: "yes" | "no") => {
    if (!duel?.id || revealing) return
    setRevealing(true)
    try {
      const res = await fetch(`/api/duels/${duel.id}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ correctSide: side }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Reveal failed", description: data.error || "Could not reveal outcome", variant: "destructive" })
        return
      }
      setDuel((prev) => (prev ? { ...prev, correct_side: side, outcome_revealed: true } : prev))
      setPhase("revealing")
      revealTimerRef.current = setTimeout(() => setPhase("revealed"), 1600)
      toast({ title: "Outcome revealed!", description: `The clutch was a ${side.toUpperCase()}. Payouts processed.` })
    } catch (err) {
      console.error("Reveal error:", err)
    } finally {
      setRevealing(false)
    }
  }

  const isCreator = Boolean(user && duel?.creator_id && user.id === duel.creator_id)
  const bettingOpen = phase === "betting" && secondsLeft !== 0
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
  const creatorName = duel?.creator?.display_name || duel?.creator?.username || "A player"

  if (!duel) return null

  return (
    <div className="relative my-4 overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-b from-[#120b2e] to-[#0a0818] shadow-2xl shadow-violet-950/40">
      {/* Ambient gaming glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge className="gap-1 bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 font-black text-slate-950 shadow-lg">
            <Zap className="h-3.5 w-3.5 fill-current" /> CLUTCH DUEL
          </Badge>
          <Badge variant="outline" className="border-violet-400/40 text-violet-300">
            <Coins className="mr-1 h-3 w-3 text-amber-400" />
            {totalStake.toLocaleString()} staked
          </Badge>
        </div>
        {phase === "betting" && secondsLeft !== null && secondsLeft > 0 ? (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm font-black tabular-nums",
              secondsLeft <= 5
                ? "animate-pulse border-rose-500/60 bg-rose-500/15 text-rose-300"
                : "border-cyan-400/40 bg-cyan-500/10 text-cyan-300",
            )}
          >
            <Timer className="h-3.5 w-3.5" />
            {fmtTime(secondsLeft)}
          </div>
        ) : phase === "revealing" ? (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-500/10 px-3 py-1 text-sm font-black text-amber-300">
            <Flame className="h-3.5 w-3.5 animate-pulse" /> REVEALING…
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
            <Trophy className="h-3.5 w-3.5" /> RESULT LIVE
          </div>
        )}
      </div>

      <div className="relative p-4 sm:p-5">
        {/* Creator + question */}
        <div className="mb-4 flex items-center gap-2.5">
          <Avatar className="h-9 w-9 border border-violet-400/40">
            <AvatarImage src={duel.creator?.avatar_url} />
            <AvatarFallback>{creatorName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{creatorName}</p>
            <p className="text-[11px] text-violet-300/80">
              {bettingOpen ? "Predict before the clip plays…" : "Clip revealed"}
            </p>
          </div>
        </div>

        <h4 className="text-lg font-extrabold leading-snug text-white">
          {duel.prediction_question || duel.prompt || "Does he land the clutch?"}
        </h4>

        {/* Video stage */}
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black">
          {phase === "betting" ? (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_center,#1b1040_0%,#0a0818_75%)]">
              <Zap className="h-10 w-10 animate-pulse text-amber-400" />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Clip locked</p>
              <p className="px-6 text-center text-[11px] text-slate-400">
                The outcome is hidden until the window closes.
              </p>
            </div>
          ) : phase === "revealing" ? (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_center,#3a0f0f_0%,#0a0818_75%)]">
              <div className="relative">
                <div className="h-16 w-16 animate-ping rounded-full bg-amber-500/30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-8 w-8 fill-amber-400 text-amber-400" />
                </div>
              </div>
              <p className="animate-pulse text-lg font-black uppercase tracking-widest text-amber-300">
                Did he land it…?
              </p>
              <p className="text-[11px] text-slate-400">playing the clip in a moment</p>
            </div>
          ) : (
            <div className="relative aspect-video w-full">
              {duel.clip_url ? (
                <video
                  ref={videoRef}
                  src={duel.clip_url}
                  controls
                  playsInline
                  className="h-full w-full rounded-2xl object-contain"
                  onPlay={() => setVideoPlaying(true)}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">Clip unavailable</div>
              )}
              {!videoPlaying && (
                <button
                  type="button"
                  onClick={() => {
                    void videoRef.current?.play()
                  }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40"
                  aria-label="Play the clip to see the outcome"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 shadow-xl shadow-violet-500/40 transition hover:scale-110">
                    <Play className="ml-0.5 h-6 w-6 fill-white text-white" />
                  </span>
                  <span className="text-xs font-bold text-white drop-shadow">Watch the outcome</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Outcome banner */}
        {phase === "revealed" && duel.correct_side && (
          <div
            className={cn(
              "mt-4 flex items-center gap-2 rounded-xl border px-3 py-2.5",
              duel.correct_side === "yes"
                ? "border-emerald-400/40 bg-emerald-500/10"
                : "border-sky-400/40 bg-sky-500/10",
            )}
          >
            {myResult?.kind === "win" ? (
              <>
                <Trophy className="h-5 w-5 text-amber-400" />
                <p className="text-sm font-bold text-white">
                  You called it! Your stake + winnings are on the way. 🎉
                </p>
              </>
            ) : myResult?.kind === "loss" ? (
              <>
                <Flame className="h-5 w-5 text-rose-400" />
                <p className="text-sm font-bold text-white">Not this time — the house keeps your stake. GG.</p>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 text-cyan-300" />
                <p className="text-sm font-bold text-white">
                  Outcome: <span className="uppercase">{duel.correct_side}</span> — the clip tells the story.
                </p>
              </>
            )}
          </div>
        )}

        {/* Live prediction bars */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1 text-emerald-400">
              <ThumbsUp className="h-3.5 w-3.5" /> YES ({yesPct}%) · {summary?.yes?.stake || 0} coins
            </span>
            <span className="flex items-center gap-1 text-sky-400">
              NO ({noPct}%) · {summary?.no?.stake || 0} coins <ThumbsDown className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-white/10 bg-slate-900">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${yesPct}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${noPct}%` }}
            />
          </div>
        </div>

        {/* Betting / result actions */}
        {phase === "betting" ? (
          <div className="mt-4">
            {lockedSide ? (
              <div className="flex items-center justify-between rounded-xl border border-violet-400/40 bg-violet-500/10 px-3 py-2.5">
                <p className="flex items-center gap-2 text-sm font-bold text-violet-200">
                  {lockedSide === "yes" ? <ThumbsUp className="h-4 w-4 text-emerald-400" /> : <ThumbsDown className="h-4 w-4 text-sky-400" />}
                  Locked: {lockedSide.toUpperCase()} · {userPick?.stake || 0} coins
                </p>
                <span className="animate-pulse text-[11px] font-bold text-violet-300">Waiting for reveal…</span>
              </div>
            ) : (
              <>
                <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 flex items-center gap-1 text-[11px] font-bold text-slate-400">
                    <Coins className="h-3.5 w-3.5 text-amber-400" /> Stake:
                  </span>
                  {STAKE_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setStakeAmount(chip)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-bold transition",
                        stakeAmount === chip
                          ? "border-amber-400 bg-amber-500/20 text-amber-300"
                          : "border-white/10 text-slate-400 hover:border-amber-400/40 hover:text-amber-300",
                      )}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => void handlePredict("yes")}
                    disabled={staking || !user}
                    className="h-11 bg-gradient-to-r from-emerald-500 to-teal-500 font-black text-white shadow-lg shadow-emerald-900/40 transition hover:scale-[1.02] hover:from-emerald-400 hover:to-teal-400"
                  >
                    <ThumbsUp className="mr-1.5 h-4 w-4" /> YES — He lands it
                  </Button>
                  <Button
                    onClick={() => void handlePredict("no")}
                    disabled={staking || !user}
                    className="h-11 bg-gradient-to-r from-sky-500 to-indigo-500 font-black text-white shadow-lg shadow-sky-900/40 transition hover:scale-[1.02] hover:from-sky-400 hover:to-indigo-400"
                  >
                    <ThumbsDown className="mr-1.5 h-4 w-4" /> NO — He chokes
                  </Button>
                </div>
                {!user && <p className="mt-2 text-center text-[11px] text-slate-400">Sign in to stake coins on your call.</p>}
              </>
            )}
          </div>
        ) : phase === "revealing" ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/5 px-3 py-3">
            <Flame className="h-4 w-4 animate-pulse text-amber-400" />
            <p className="text-sm font-black uppercase tracking-wider text-amber-300">The moment of truth…</p>
          </div>
        ) : isCreator ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Creator — reveal the outcome</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => void handleReveal("yes")}
                disabled={revealing}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 font-black"
              >
                He landed it (YES)
              </Button>
              <Button
                onClick={() => void handleReveal("no")}
                disabled={revealing}
                className="bg-gradient-to-r from-sky-500 to-indigo-500 font-black"
              >
                He choked (NO)
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center">
            <Trophy className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-semibold text-slate-300">Waiting for the creator to call the outcome.</p>
          </div>
        )}
      </div>
    </div>
  )
}
