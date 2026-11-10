"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Swords, Coins, Timer, Trophy, CheckCircle2, Send } from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"

interface DuelEntry {
  id: string
  side: "A" | "B"
  title: string
  content: string
  media_url?: string
  votes_count: number
  user_id: string
}

interface DuelData {
  id: string
  prompt: string
  creator_id: string
  opponent_id?: string
  stake_coins: number
  duration_hours: number
  expires_at: string
  status: "active" | "completed"
  winner_id?: string
  created_at: string
  side_a_label?: string | null
  side_b_label?: string | null
  creator?: {
    id: string
    username: string
    display_name: string
    avatar_url: string
  }
  opponent?: {
    id: string
    username: string
    display_name: string
    avatar_url: string
  }
  entries?: DuelEntry[]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
)

export function LoopDuelCard({ duel: initialDuel, loopId }: { duel?: DuelData; loopId?: string }) {
  const [duel, setDuel] = useState<DuelData | null>(initialDuel || null)
  const [hasVoted, setHasVoted] = useState<"A" | "B" | null>(null)
  const [userSideBContent, setUserSideBContent] = useState("")
  const [isSubmittingB, setIsSubmittingB] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (initialDuel) {
      setDuel(initialDuel)
      return
    }
    if (loopId) {
      fetch(`/api/duels?loop_id=${loopId}&status=all`)
        .then((res) => res.json())
        .then((data) => {
          if (data.duels && data.duels[0]) {
            setDuel(data.duels[0])
          } else if (data.duel) {
            setDuel(data.duel)
          }
        })
        .catch(() => {})
    }
  }, [initialDuel, loopId])

  // Real-time votes subscription
  useEffect(() => {
    if (!duel?.id) return

    const channel = supabase
      .channel(`duel_live:${duel.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "loop_duel_votes", filter: `duel_id=eq.${duel.id}` },
        (payload) => {
          const newVote = payload.new as any
          if (newVote) {
            setDuel((prev) => {
              if (!prev) return null
              const updatedEntries = (prev.entries || []).map((e) =>
                e.side === newVote.side ? { ...e, votes_count: e.votes_count + 1 } : e
              )
              return { ...prev, entries: updatedEntries }
            })
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [duel?.id])

  // Live countdown timer
  useEffect(() => {
    if (!duel?.expires_at) return
    const endsAt = new Date(duel.expires_at).getTime()
    let interval: ReturnType<typeof setInterval>
    const tick = () => {
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0) clearInterval(interval)
    }
    tick()
    interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [duel?.expires_at])

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${sec}s`
  }

  if (!duel) return null

  const labelA = duel.side_a_label || "Side A"
  const labelB = duel.side_b_label || "Side B"
  const entryA = duel.entries?.find((e) => e.side === "A")
  const entryB = duel.entries?.find((e) => e.side === "B")
  const votesA = entryA?.votes_count || 0
  const votesB = entryB?.votes_count || 0
  const totalVotes = votesA + votesB
  const percentA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50
  const percentB = totalVotes > 0 ? 100 - percentA : 50
  const isEnded = duel.status === "completed" || secondsLeft === 0
  const winnerSide = duel.winner_id
    ? duel.winner_id === entryA?.user_id || duel.winner_id === duel.creator_id
      ? "A"
      : duel.winner_id === entryB?.user_id || duel.winner_id === duel.opponent_id
        ? "B"
        : null
    : null

  /** Image/video duel entry media — fixed height keeps both sides aligned. */
  const EntryMedia = ({ url }: { url: string }) => {
    const isVideo = /\.(mp4|webm|mov|m4v|ogv|m3u8)(\?|#|$)/i.test(url) || /video\//.test(url)
    if (isVideo) {
      return (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          className="mt-2 h-24 w-full rounded-lg bg-black object-cover"
        />
      )
    }
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt="Duel entry media"
        loading="lazy"
        className="mt-2 h-24 w-full rounded-lg bg-muted object-cover"
      />
    )
  }

  const handleVote = async (side: "A" | "B") => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to vote on this duel!" })
      return
    }
    if (isEnded) {
      toast({ title: "Voting closed", description: "This duel has already ended." })
      return
    }

    const previousVote = hasVoted
    try {
      setHasVoted(side)
      setDuel((prev) => {
        if (!prev) return null
        const updatedEntries = (prev.entries || []).map((e) =>
          e.side === side ? { ...e, votes_count: e.votes_count + 1 } : e
        )
        return { ...prev, entries: updatedEntries }
      })

      const res = await fetch(`/api/duels/${duel.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ side }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setHasVoted(previousVote)
        setDuel((prev) => {
          if (!prev) return null
          const updatedEntries = (prev.entries || []).map((e) =>
            e.side === side ? { ...e, votes_count: Math.max(0, e.votes_count - 1) } : e
          )
          return { ...prev, entries: updatedEntries }
        })
        toast({ title: "Vote failed", description: data.error || "Could not record vote", variant: "destructive" })
      } else {
        toast({ title: "Vote recorded", description: `You voted for ${side === "A" ? labelA : labelB}.` })
      }
    } catch (err) {
      console.error("Failed to vote:", err)
      setHasVoted(previousVote)
      toast({ title: "Vote failed", description: "Check your connection and try again.", variant: "destructive" })
    }
  }

  const handleJoinDuel = async () => {
    if (!user || !userSideBContent.trim()) return
    setIsSubmittingB(true)

    try {
      const res = await fetch(`/api/duels/${duel.id}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ content: userSideBContent }),
      })

      const data = await res.json()
      if (res.ok && data.entry) {
        toast({ title: "Duel accepted!", description: "Your counter-take is now live." })
        setDuel((prev) => {
          if (!prev) return null
          return {
            ...prev,
            opponent: {
              id: user.id,
              username: user.username || "me",
              display_name: user.display_name || user.username || "You",
              avatar_url: user.avatar_url || "",
            },
            entries: [...(prev.entries || []), data.entry],
          } as DuelData
        })
        setUserSideBContent("")
      } else {
        toast({ title: "Failed to join", description: data.error || "Could not submit take", variant: "destructive" })
      }
    } catch (err) {
      console.error("Failed to submit side B take:", err)
      toast({ title: "Failed to join", description: "Check your connection and try again.", variant: "destructive" })
    } finally {
      setIsSubmittingB(false)
    }
  }

  const voteLabel = (side: "A" | "B", votes: number) => {
    if (hasVoted === side) return `Voted ${side}`
    if (isEnded) return "Voting closed"
    return `Vote ${side} · ${votes}`
  }

  return (
    <div
      data-tour="duels"
      className="my-3 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border/60 px-3.5 py-2.5 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-300">
            <Swords className="h-3 w-3" />
            Loop Duel
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Coins className="h-3 w-3 text-amber-500" />
            {(duel.stake_coins * 2).toLocaleString()} prize
          </span>
          {totalVotes > 0 && (
            <span className="text-[10px] tabular-nums text-muted-foreground">{totalVotes.toLocaleString()} votes</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <Timer className="h-3 w-3 text-muted-foreground" />
          {secondsLeft !== null && secondsLeft > 0 ? (
            <span className="font-mono font-semibold tabular-nums text-foreground">{fmtTime(secondsLeft)}</span>
          ) : (
            <>
              <span className="font-semibold text-rose-600 dark:text-rose-400">Ended</span>
              <FreshnessTimestamp date={duel.expires_at} />
            </>
          )}
        </div>
      </div>

      <div className="px-3.5 pb-3 pt-2.5 sm:px-4">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-foreground sm:text-base">
          &ldquo;{duel.prompt}&rdquo;
        </h3>

        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold">
            <span className="truncate text-rose-600 dark:text-rose-400">
              {labelA} · {totalVotes > 0 ? `${percentA}%` : "—"}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {totalVotes > 0 ? `${totalVotes.toLocaleString()} votes` : "Be the first to vote"}
            </span>
            <span className="truncate text-right text-cyan-600 dark:text-cyan-400">
              {totalVotes > 0 ? `${percentB}%` : "—"} · {labelB}
            </span>
          </div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-500 ${totalVotes > 0 ? "bg-rose-500/90" : "bg-muted-foreground/20"}`}
              style={{ width: `${percentA}%` }}
            />
            <div
              className={`h-full transition-all duration-500 ${totalVotes > 0 ? "bg-cyan-500/90" : "bg-muted-foreground/10"}`}
              style={{ width: `${percentB}%` }}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* SIDE A */}
          <div className="flex min-w-0 flex-col rounded-xl border border-rose-500/20 bg-rose-500/[0.035] p-2.5">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7 border border-rose-400/40">
                <AvatarImage src={duel.creator?.avatar_url} />
                <AvatarFallback className="text-[10px]">{duel.creator?.display_name?.charAt(0) || "A"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{labelA}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {duel.creator?.display_name || "Challenger"}
                  {duel.creator?.username ? ` · @${duel.creator.username}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[10px] font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {votesA}
              </span>
            </div>

            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-foreground/85">
              {entryA?.content || "No take posted yet."}
            </p>
            {entryA?.media_url && <EntryMedia url={entryA.media_url} />}

            <div className="mt-auto pt-2">
              <Button
                onClick={() => handleVote("A")}
                disabled={hasVoted === "A" || isEnded}
                size="sm"
                className={`h-8 w-full rounded-lg text-[11px] font-semibold ${
                  hasVoted === "A"
                    ? "border border-rose-500/40 bg-rose-500/15 text-rose-700 shadow-none hover:bg-rose-500/15 dark:text-rose-200"
                    : "bg-rose-600 text-white shadow-sm hover:bg-rose-500"
                }`}
              >
                {hasVoted === "A" ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {voteLabel("A", votesA)}
                  </span>
                ) : (
                  voteLabel("A", votesA)
                )}
              </Button>
            </div>
          </div>

          {/* SIDE B */}
          <div className="flex min-w-0 flex-col rounded-xl border border-cyan-500/20 bg-cyan-500/[0.035] p-2.5">
            {entryB ? (
              <>
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7 border border-cyan-400/40">
                    <AvatarImage src={duel.opponent?.avatar_url} />
                    <AvatarFallback className="text-[10px]">{duel.opponent?.display_name?.charAt(0) || "B"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{labelB}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {duel.opponent?.display_name || "Opponent"}
                      {duel.opponent?.username ? ` · @${duel.opponent.username}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
                    {votesB}
                  </span>
                </div>

                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-foreground/85">
                  {entryB.content}
                </p>
                {entryB.media_url && <EntryMedia url={entryB.media_url} />}

                <div className="mt-auto pt-2">
                  <Button
                    onClick={() => handleVote("B")}
                    disabled={hasVoted === "B" || isEnded}
                    size="sm"
                    className={`h-8 w-full rounded-lg text-[11px] font-semibold ${
                      hasVoted === "B"
                        ? "border border-cyan-500/40 bg-cyan-500/15 text-cyan-700 shadow-none hover:bg-cyan-500/15 dark:text-cyan-200"
                        : "bg-cyan-600 text-white shadow-sm hover:bg-cyan-500"
                    }`}
                  >
                    {hasVoted === "B" ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {voteLabel("B", votesB)}
                      </span>
                    ) : (
                      voteLabel("B", votesB)
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* Open Duel Response Form */
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-700 dark:text-cyan-300">
                  Open counter
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  This side is waiting for a take.
                </p>
                <div className="mt-auto space-y-1.5 pt-2">
                  <textarea
                    value={userSideBContent}
                    onChange={(e) => setUserSideBContent(e.target.value)}
                    placeholder="Write your counter-take…"
                    maxLength={500}
                    className="h-16 w-full resize-none rounded-lg border border-border bg-background/80 p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-cyan-400 focus:outline-none"
                  />
                  <Button
                    onClick={handleJoinDuel}
                    disabled={isSubmittingB || !userSideBContent.trim()}
                    size="sm"
                    className="h-8 w-full rounded-lg bg-cyan-600 text-[11px] font-semibold text-white hover:bg-cyan-500"
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    {isSubmittingB ? "Submitting…" : "Accept & post take"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {isEnded && winnerSide && (
          <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            <Trophy className="h-3.5 w-3.5" />
            {winnerSide === "A" ? labelA : labelB} won this duel
          </div>
        )}
      </div>
    </div>
  )
}
