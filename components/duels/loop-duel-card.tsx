"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Swords, Coins, Timer, Trophy, CheckCircle2, Zap, Send } from "lucide-react"
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

  /** Image/video duel entry media — renders the attached proof clip/take. */
  const EntryMedia = ({ url }: { url: string }) => {
    const isVideo = /\.(mp4|webm|mov|m4v|ogv|m3u8)(\?|#|$)/i.test(url) || /video\//.test(url)
    if (isVideo) {
      return (
        <video src={url} controls playsInline preload="metadata" className="mt-2 aspect-video w-full rounded-xl bg-black object-contain" />
      )
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="Duel entry media" className="mt-2 aspect-video w-full rounded-xl bg-muted object-cover" />
  }

  const votesA = entryA?.votes_count || 0
  const votesB = entryB?.votes_count || 0
  const totalVotes = votesA + votesB
  const percentA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50
  const percentB = totalVotes > 0 ? 100 - percentA : 50

  const handleVote = async (side: "A" | "B") => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to vote on this duel!" })
      return
    }

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

      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Vote failed", description: data.error || "Could not record vote" })
      } else {
        toast({ title: "Vote recorded!", description: `You voted for Side ${side}` })
      }
    } catch (err) {
      console.error("Failed to vote:", err)
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
        toast({ title: "Duel accepted!", description: "Your counter-take is now live!" })
        setDuel((prev) => {
          if (!prev) return null
          return {
            ...prev,
            opponent: {
              id: user.id,
              username: user.username || "me",
              display_name: user.display_name || user.username || "You",
              avatar_url: user.avatar_url || null,
            },
            entries: [...(prev.entries || []), data.entry],
          } as DuelData
        })
        setUserSideBContent("")
      } else {
        toast({ title: "Failed to join", description: data.error || "Could not submit take" })
      }
    } catch (err) {
      console.error("Failed to submit side B take:", err)
    } finally {
      setIsSubmittingB(false)
    }
  }

  return (
    <Card className="border border-cyan-500/30 bg-gradient-to-b from-[#0b142c]/90 to-[#070d1e]/90 shadow-2xl rounded-3xl overflow-hidden my-6">
      <CardHeader className="p-5 border-b border-white/10 bg-cyan-950/20">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge className="bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold px-3 py-1 flex items-center gap-1.5 shadow-md">
              <Swords className="h-4 w-4" /> LOOP DUEL
            </Badge>
            <Badge variant="outline" className="border-amber-400/50 text-amber-300 font-semibold flex items-center gap-1">
              <Coins className="h-3.5 w-3.5" /> {duel.stake_coins * 2} Coin Prize Pool
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Timer className="h-3.5 w-3.5 text-cyan-400" />
            {secondsLeft !== null && secondsLeft > 0 ? (
              <span className="font-mono font-bold text-cyan-300">⏱ {fmtTime(secondsLeft)}</span>
            ) : (
              <><span className="text-rose-400 font-semibold">Ended</span> <FreshnessTimestamp date={duel.expires_at} /></>
            )}
          </div>
        </div>

        <h3 className="text-xl font-extrabold text-white mt-3 leading-snug tracking-tight">
          &ldquo;{duel.prompt}&rdquo;
        </h3>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Voting Percentage Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="text-rose-400 flex items-center gap-1">
              {labelA} ({percentA}%) — {votesA} votes
            </span>
            <span className="text-cyan-400 flex items-center gap-1">
              {labelB} ({percentB}%) — {votesB} votes
            </span>
          </div>

          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex p-0.5 border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-l-full transition-all duration-500"
              style={{ width: `${percentA}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-r-full transition-all duration-500"
              style={{ width: `${percentB}%` }}
            />
          </div>
        </div>

        {/* Versus Side-by-Side Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
          {/* VS Badge */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-slate-900 border-2 border-amber-400 items-center justify-center font-black text-amber-400 shadow-xl text-xs">
            VS
          </div>

          {/* SIDE A */}
          <div className="border border-rose-500/30 bg-rose-950/20 p-5 rounded-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-rose-400">
                  <AvatarImage src={duel.creator?.avatar_url} />
                  <AvatarFallback>{duel.creator?.display_name?.charAt(0) || "A"}</AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-bold text-white text-sm block">
                    {duel.creator?.display_name || "Challenger"}
                  </span>
                  <span className="text-xs text-rose-300 font-semibold">@{labelA}</span>
                </div>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{entryA?.content || "No take posted yet."}</p>
              {entryA?.media_url && <EntryMedia url={entryA.media_url} />}
            </div>

            <Button
              onClick={() => handleVote("A")}
              disabled={hasVoted === "A"}
              className={`w-full font-bold rounded-xl transition-all ${
                hasVoted === "A"
                  ? "bg-rose-500/30 text-rose-200 border border-rose-500/50"
                  : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg"
              }`}
            >
              {hasVoted === "A" ? (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Voted {labelA}
                </span>
              ) : (
                `Vote ${labelA} (${votesA})`
              )}
            </Button>
          </div>

          {/* SIDE B */}
          <div className="border border-cyan-500/30 bg-cyan-950/20 p-5 rounded-2xl flex flex-col justify-between space-y-4">
            {entryB ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-cyan-400">
                      <AvatarImage src={duel.opponent?.avatar_url} />
                      <AvatarFallback>{duel.opponent?.display_name?.charAt(0) || "B"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-bold text-white text-sm block">
                        {duel.opponent?.display_name || "Opponent"}
                      </span>
                      <span className="text-xs text-cyan-300 font-semibold">@{labelB}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{entryB.content}</p>
                  {entryB.media_url && <EntryMedia url={entryB.media_url} />}
                </div>

                <Button
                  onClick={() => handleVote("B")}
                  disabled={hasVoted === "B"}
                  className={`w-full font-bold rounded-xl transition-all ${
                    hasVoted === "B"
                      ? "bg-cyan-500/30 text-cyan-200 border border-cyan-500/50"
                      : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg"
                  }`}
                >
                  {hasVoted === "B" ? (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Voted {labelB}
                    </span>
                  ) : (
                    `Vote ${labelB} (${votesB})`
                  )}
                </Button>
              </>
            ) : (
              /* Open Duel Response Form */
              <div className="space-y-3 flex flex-col justify-between h-full">
                <div>
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                    ⚔️ Open Counter Challenge
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    This duel is waiting for Side B! Accept the challenge and post your counter argument.
                  </p>
                </div>

                <div className="space-y-2">
                  <textarea
                    value={userSideBContent}
                    onChange={(e) => setUserSideBContent(e.target.value)}
                    placeholder="Write your counter take..."
                    className="w-full h-24 bg-slate-900/80 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <Button
                    onClick={handleJoinDuel}
                    disabled={isSubmittingB || !userSideBContent.trim()}
                    className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 font-bold text-xs py-2 rounded-xl"
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Accept & Submit Side B
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
