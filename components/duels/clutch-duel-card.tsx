"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import {
  Coins,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Timer,
  Play,
  Trophy,
  Flame,
  Pencil,
  Loader2,
} from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"
import { ProtectedMedia } from "@/components/media-protection"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

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
  side_a_label?: string | null
  side_b_label?: string | null
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
  const [isEditing, setIsEditing] = useState(false)
  const [editPrompt, setEditPrompt] = useState("")
  const [editPrediction, setEditPrediction] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [myResult, setMyResult] = useState<{ kind: "win" | "loss" | "refund" | null; amount?: number } | null>(null)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Phase machine guard — "revealed" is terminal, and the anticipation beat
  // ("revealing") is only ever entered once so no timer fights itself.
  const phaseRef = useRef<"betting" | "revealing" | "revealed">("betting")
  phaseRef.current = phase
  const enterRevealBeat = useCallback(() => {
    if (phaseRef.current === "revealed") return
    setPhase("revealing")
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    revealTimerRef.current = setTimeout(() => setPhase("revealed"), 1600)
  }, [])

  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  // Load duel by loopId if not passed in (e.g. loop detail page).
  useEffect(() => {
    if (initialDuel) {
      setDuel(initialDuel)
      return
    }
    if (loopId) {
      fetch(`/api/duels?loop_id=${loopId}&status=all`)
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
      // NOTE: deliberately no phase writes here. Phase is driven by the
      // countdown + reveal flow only, so polling can never yank the card
      // back to "betting" after the window closed (that caused the blink).
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
            // Only the winner-side state change matters here; everything else
            // (stake totals ticking up, etc.) must not touch the phase.
            if (next.outcome_revealed) enterRevealBeat()
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current)
    }
  }, [duel?.id, supabase, refreshSummary, enterRevealBeat])

  // Countdown — the tension engine. The interval STOPS the moment it hits
  // zero (never keeps running), and the reveal beat fires exactly once.
  useEffect(() => {
    if (!duel?.betting_ends_at) return
    if (duel.outcome_revealed) {
      // If the anticipation beat is already playing (creator just revealed via
      // realtime), let it finish — never yank it straight to the video.
      if (phaseRef.current !== "revealing") setPhase("revealed")
      return
    }
    const endsAt = new Date(duel.betting_ends_at).getTime()

    const finishCountdown = () => {
      setSecondsLeft(0)
      enterRevealBeat()
      // Pull the freshest duel row so the creator's reveal UI shows the
      // post-window state without waiting for a realtime event.
      if (duel?.id) {
        fetch(`/api/duels?status=all&id=${duel.id}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.duels?.[0]) setDuel(d.duels[0])
          })
          .catch(() => {})
      }
    }

    // Window already closed (e.g. card opened late) — go straight to reveal.
    if (endsAt <= Date.now()) {
      finishCountdown()
      return
    }

    let interval: ReturnType<typeof setInterval>
    const tick = () => {
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0) {
        clearInterval(interval)
        finishCountdown()
      }
    }
    tick()
    interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel?.betting_ends_at, duel?.outcome_revealed, enterRevealBeat])

  // Resolve the viewer's result once revealed.
  useEffect(() => {
    if (phase !== "revealed" || !duel?.correct_side || !userPick) return
    if (userPick.side === duel.correct_side) setMyResult({ kind: "win" })
    else setMyResult({ kind: "loss" })
  }, [phase, duel?.correct_side, userPick])

  const yesLabel = duel?.side_a_label || "YES"
  const noLabel = duel?.side_b_label || "NO"

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
        title: side === "yes" ? "Locked in — YES" : "Locked in — NO",
        description: `${stakeAmount} coins staked. Good luck!`,
      })
      void refreshSummary()
    } catch (err) {
      console.error("Predict error:", err)
      toast({ title: "Couldn't place your stake", description: "Check your coin balance and try again.", variant: "destructive" })
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
      enterRevealBeat()
      toast({ title: "Outcome revealed", description: `The clutch was a ${side.toUpperCase()}. Payouts processed.` })
    } catch (err) {
      console.error("Reveal error:", err)
    } finally {
      setRevealing(false)
    }
  }

  const isCreator = Boolean(user && duel?.creator_id && user.id === duel.creator_id)
  const canEdit = isCreator && phase === "betting" && !userPick

  const openEdit = () => {
    setEditPrompt(duel?.prompt || "")
    setEditPrediction(duel?.prediction_question || "")
    setIsEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!duel) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/duels/${duel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ prompt: editPrompt, prediction_question: editPrediction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update")
      setDuel((prev) => (prev ? { ...prev, prompt: editPrompt, prediction_question: editPrediction } : prev))
      setIsEditing(false)
      toast({ title: "Duel updated" })
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" })
    } finally {
      setSavingEdit(false)
    }
  }

  const bettingOpen = phase === "betting" && secondsLeft !== 0
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
  const creatorName = duel?.creator?.display_name || duel?.creator?.username || "A player"
  const question = duel?.prediction_question || duel?.prompt || "Does he land the clutch?"

  if (!duel) return null

  return (
    <>
      <div className="my-3 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-violet-700 dark:text-violet-300">
              <Zap className="h-3 w-3 fill-current" />
              Clutch Duel
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Coins className="h-3 w-3 text-amber-500" />
              {totalStake.toLocaleString()} staked
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={openEdit}
                aria-label="Edit clutch duel"
                title="Edit duel"
                className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>

          {phase === "betting" ? (
            secondsLeft !== null && secondsLeft > 0 ? (
              <div
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums",
                  secondsLeft <= 5
                    ? "animate-pulse border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                    : "border-border/60 text-foreground",
                )}
              >
                <Timer className="h-3 w-3" />
                {fmtTime(secondsLeft)}
              </div>
            ) : (
              <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">Stakes open</span>
            )
          ) : phase === "revealing" ? (
            <div className="flex shrink-0 items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              <Flame className="h-3 w-3 animate-pulse" />
              Revealing
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              <Trophy className="h-3 w-3" />
              Result live
            </div>
          )}
        </div>

        <div className="px-3.5 pb-3 pt-3 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] sm:items-start">
            <div className="min-w-0">
              {/* Creator + question */}
              <div className="flex items-center gap-2">
                <VideoAvatar
                  src={duel.creator?.avatar_url}
                  className="h-7 w-7 border border-violet-400/30"
                  fallback={creatorName.charAt(0)}
                />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-foreground">{creatorName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {bettingOpen ? "Call it before the clip plays" : "The clip is live"}
                  </p>
                </div>
              </div>

              <h4 className="mt-2 line-clamp-3 text-[15px] font-semibold leading-snug tracking-tight text-foreground sm:text-base">
                {question}
              </h4>

              {phase === "revealed" && duel.correct_side && (
                <div
                  className={cn(
                    "mt-2.5 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-medium leading-snug",
                    myResult?.kind === "win"
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                      : myResult?.kind === "loss"
                        ? "border-rose-400/40 bg-rose-500/10 text-rose-800 dark:text-rose-200"
                        : "border-border/70 bg-muted/30 text-muted-foreground",
                  )}
                >
                  {myResult?.kind === "win" ? (
                    <>
                      <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>You called it. Your stake and winnings are on the way.</span>
                    </>
                  ) : myResult?.kind === "loss" ? (
                    <>
                      <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                      <span>Not this time — the house keeps your stake. GG.</span>
                    </>
                  ) : (
                    <>
                      <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" />
                      <span>
                        Outcome: <strong className="uppercase text-foreground">{duel.correct_side}</strong>
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Video stage */}
            <div className="relative h-[180px] w-full overflow-hidden rounded-xl border border-border bg-black sm:h-[210px]">
              {phase === "betting" ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-[radial-gradient(circle_at_center,var(--card)_0%,var(--background)_75%)]">
                  <Zap className="h-7 w-7 animate-pulse text-amber-400" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
                    Clip locked
                  </p>
                  <p className="px-5 text-center text-[10px] text-muted-foreground">The outcome stays hidden.</p>
                </div>
              ) : phase === "revealing" ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_center,#f43f5e33_0%,var(--background)_75%)]">
                  <div className="relative">
                    <div className="h-12 w-12 animate-ping rounded-full bg-amber-500/30" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="h-6 w-6 fill-amber-400 text-amber-400" />
                    </div>
                  </div>
                  <p className="animate-pulse text-xs font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                    Did he land it?
                  </p>
                </div>
              ) : duel.clip_url ? (
                <div className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-contain">
                  <ProtectedMedia type="video" src={duel.clip_url} className="h-full w-full" showControls />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Clip unavailable</div>
              )}
            </div>
          </div>

          {/* Live prediction bars */}
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold">
              <span className="flex min-w-0 items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <ThumbsUp className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {yesLabel} · {totalStake > 0 ? `${yesPct}%` : "—"} · {(summary?.yes?.stake || 0).toLocaleString()}
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-1 text-sky-600 dark:text-sky-400">
                <span className="truncate">
                  {(summary?.no?.stake || 0).toLocaleString()} · {totalStake > 0 ? `${noPct}%` : "—"} · {noLabel}
                </span>
                <ThumbsDown className="h-3 w-3 shrink-0" />
              </span>
            </div>
            <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full transition-all duration-500", totalStake > 0 ? "bg-emerald-500/90" : "bg-muted-foreground/20")}
                style={{ width: `${yesPct}%` }}
              />
              <div
                className={cn("h-full transition-all duration-500", totalStake > 0 ? "bg-sky-500/90" : "bg-muted-foreground/10")}
                style={{ width: `${noPct}%` }}
              />
            </div>
          </div>

          {/* Betting / result actions */}
          {phase === "betting" ? (
            <div className="mt-3">
              {lockedSide ? (
                <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/[0.06] px-2.5 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-800 dark:text-violet-200">
                    {lockedSide === "yes" ? (
                      <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <ThumbsDown className="h-3.5 w-3.5 text-sky-500" />
                    )}
                    Locked {lockedSide.toUpperCase()} · {userPick?.stake || 0} coins
                  </p>
                  <span className="animate-pulse text-[10px] font-medium text-muted-foreground">Waiting for reveal…</span>
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                  <div className="mb-2 flex flex-wrap items-center gap-1">
                    <span className="mr-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                      <Coins className="h-3 w-3 text-amber-500" />
                      Stake
                    </span>
                    {STAKE_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setStakeAmount(chip)}
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition-colors",
                          stakeAmount === chip
                            ? "border-amber-400/60 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "border-border/70 text-muted-foreground hover:border-amber-400/40 hover:text-foreground",
                        )}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      onClick={() => void handlePredict("yes")}
                      disabled={staking || !user}
                      size="sm"
                      aria-label={`Stake ${stakeAmount} coins on ${yesLabel}`}
                      className="h-9 bg-emerald-600 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-500"
                    >
                      {staking ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="mr-1 h-3.5 w-3.5" />}
                      {yesLabel}
                    </Button>
                    <Button
                      onClick={() => void handlePredict("no")}
                      disabled={staking || !user}
                      size="sm"
                      aria-label={`Stake ${stakeAmount} coins on ${noLabel}`}
                      className="h-9 bg-sky-600 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-500"
                    >
                      {staking ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="mr-1 h-3.5 w-3.5" />}
                      {noLabel}
                    </Button>
                  </div>
                  {!user && (
                    <p className="mt-1.5 text-center text-[10px] text-muted-foreground">Sign in to stake coins on your call.</p>
                  )}
                </div>
              )}
            </div>
          ) : phase === "revealing" ? (
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/[0.06] px-2.5 py-2">
              <Flame className="h-3.5 w-3.5 animate-pulse text-amber-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-300">
                The moment of truth…
              </p>
            </div>
          ) : isCreator && !duel.correct_side ? (
            <div className="mt-3 rounded-lg border border-border/60 bg-muted/25 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Creator · reveal the outcome
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <Button
                  onClick={() => void handleReveal("yes")}
                  disabled={revealing}
                  variant="outline"
                  size="sm"
                  className="h-9 border-emerald-500/30 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                >
                  Reveal {yesLabel}
                </Button>
                <Button
                  onClick={() => void handleReveal("no")}
                  disabled={revealing}
                  variant="outline"
                  size="sm"
                  className="h-9 border-sky-500/30 text-[11px] font-semibold text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
                >
                  Reveal {noLabel}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-muted/25 px-2.5 py-2 text-center">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-[11px] font-medium text-muted-foreground">Waiting for the creator to call the outcome.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[85dvh] overflow-y-auto bg-background border-violet-500/30">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Duel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-violet-600 dark:text-violet-300">Prompt</label>
              <Input
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Duel prompt"
                className="bg-background border-input text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-violet-600 dark:text-violet-300">Prediction Question</label>
              <Input
                value={editPrediction}
                onChange={(e) => setEditPrediction(e.target.value)}
                placeholder="What should people predict?"
                className="bg-background border-input text-foreground"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-muted-foreground hover:text-foreground">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit} className="bg-violet-600 hover:bg-violet-500">
                {savingEdit ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
