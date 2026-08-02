"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Vote, CheckCircle2, Clock, Sparkles } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@supabase/supabase-js"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"

interface PollOption {
  id: string
  text: string
  votes: number
}

interface PollData {
  id: string
  loop_id: string
  question: string
  options: PollOption[]
  expires_at?: string
  total_votes: number
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
)

export function PollCardWidget({ poll: initialPoll, loopId }: { poll?: PollData; loopId?: string }) {
  const [poll, setPoll] = useState<PollData | null>(initialPoll || null)
  const [userVotedOptionId, setUserVotedOptionId] = useState<string | null>(null)
  const [isVoting, setIsVoting] = useState<boolean>(false)

  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (initialPoll) {
      setPoll(initialPoll)
      return
    }
    if (loopId) {
      fetch(`/api/polls?loop_id=${loopId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.poll) setPoll(data.poll)
        })
        .catch(() => {})
    }
  }, [initialPoll, loopId])

  const pollId = poll?.id

  // Check if current user voted
  useEffect(() => {
    if (!user || !pollId) return

    const checkVote = async () => {
      const { data } = await supabase
        .from("loop_poll_votes")
        .select("option_id")
        .eq("poll_id", pollId)
        .eq("user_id", user.id)
        .single()

      if (data?.option_id) {
        setUserVotedOptionId(data.option_id)
      }
    }
    void checkVote()
  }, [pollId, user])

  // Real-time Supabase subscription for live poll vote counts
  useEffect(() => {
    if (!pollId) return

    const channel = supabase
      .channel(`poll_live:${pollId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loop_polls", filter: `id=eq.${pollId}` },
        (payload) => {
          const updated = payload.new as any
          if (updated) {
            setPoll((prev) => {
              if (!prev) return null
              return {
                ...prev,
                options: updated.options || prev.options,
                total_votes: updated.total_votes ?? prev.total_votes,
              }
            })
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [pollId])

  if (!poll) return null

  const totalVotes = poll.total_votes || poll.options?.reduce((acc, o) => acc + (o.votes || 0), 0) || 0
  const isExpired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false

  const handleVote = async (optionId: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to vote!" })
      return
    }

    if (userVotedOptionId || isExpired) return

    setIsVoting(true)
    setUserVotedOptionId(optionId)

    // Optimistic update
    setPoll((prev) => {
      if (!prev) return null
      const updatedOptions = (prev.options || []).map((opt) =>
        opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
      )
      return { ...prev, options: updatedOptions, total_votes: (prev.total_votes || 0) + 1 }
    })

    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ optionId }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Vote failed", description: data.error || "Could not record vote" })
      } else {
        toast({ title: "Vote recorded!", description: "Thanks for participating in the poll!" })
      }
    } catch (err) {
      console.error("Failed to cast poll vote:", err)
    } finally {
      setIsVoting(false)
    }
  }

  const showResults = Boolean(userVotedOptionId || isExpired)

  return (
    <div className="p-5 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#0b142c]/90 to-[#080f24]/90 space-y-4 my-3 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30 font-bold px-2.5 py-0.5 text-xs flex items-center gap-1">
            <Vote className="h-3.5 w-3.5 text-cyan-400" /> LIVE POLL
          </Badge>
          <span className="text-xs text-slate-400 font-medium">{totalVotes} Total Votes</span>
        </div>

        {poll.expires_at && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span>{isExpired ? "Ended " : "Ends "}</span>
            <FreshnessTimestamp date={poll.expires_at} />
          </div>
        )}
      </div>

      <h4 className="text-base font-bold text-white leading-snug">{poll.question}</h4>

      {/* Options list */}
      <div className="space-y-2.5 pt-1">
        {poll.options.map((option) => {
          const votesCount = option.votes || 0
          const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0
          const isUserChoice = option.id === userVotedOptionId

          return (
            <div key={option.id} className="relative">
              {showResults ? (
                /* Results Bar View */
                <div
                  className={`relative overflow-hidden p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                    isUserChoice
                      ? "border-cyan-400 bg-cyan-950/40 text-cyan-200 ring-1 ring-cyan-400/40 shadow-md"
                      : "border-white/10 bg-slate-900/60 text-slate-200"
                  }`}
                >
                  {/* Progress fill */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ${
                      isUserChoice
                        ? "bg-cyan-500/30"
                        : "bg-slate-700/40"
                    }`}
                    style={{ width: `${percent}%` }}
                  />

                  <div className="relative z-10 flex items-center gap-2 truncate pr-2">
                    {isUserChoice && <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />}
                    <span className="truncate">{option.text}</span>
                  </div>

                  <div className="relative z-10 font-bold flex items-center gap-2 shrink-0">
                    <span>{percent}%</span>
                    <span className="text-[10px] text-slate-400 font-normal">({votesCount})</span>
                  </div>
                </div>
              ) : (
                /* Interactive Vote Button */
                <button
                  type="button"
                  disabled={isVoting}
                  onClick={() => handleVote(option.id)}
                  className="w-full text-left p-3 rounded-xl border border-white/10 bg-slate-900/80 hover:bg-cyan-950/40 hover:border-cyan-500/50 text-xs font-semibold text-slate-100 hover:text-cyan-300 transition-all duration-200 flex items-center justify-between group shadow-sm"
                >
                  <span className="truncate pr-2">{option.text}</span>
                  <Vote className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 shrink-0 transition-colors" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
