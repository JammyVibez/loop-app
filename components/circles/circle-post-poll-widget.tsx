"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Vote, CheckCircle2, Clock } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"

export type CirclePostPoll = {
  id?: string
  question: string
  options: Array<{ id: string; text: string; votes: number }>
  total_votes?: number
  expires_at?: string
  user_vote?: string
}

export function CirclePostPollWidget({
  circleId,
  postId,
  poll: initialPoll,
}: {
  circleId: string
  postId: string
  poll: CirclePostPoll
}) {
  const [poll, setPoll] = useState(initialPoll)
  const [userVotedOptionId, setUserVotedOptionId] = useState<string | null>(initialPoll.user_vote || null)
  const [isVoting, setIsVoting] = useState(false)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const totalVotes = poll.total_votes || poll.options?.reduce((acc, o) => acc + (o.votes || 0), 0) || 0
  const isExpired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false
  const showResults = Boolean(userVotedOptionId || isExpired)

  const handleVote = async (optionId: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to vote!" })
      return
    }
    if (userVotedOptionId || isExpired || isVoting) return

    setIsVoting(true)
    setUserVotedOptionId(optionId)
    setPoll((prev) => ({
      ...prev,
      options: prev.options.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)),
      total_votes: (prev.total_votes || 0) + 1,
    }))

    try {
      const res = await fetch(`/api/circles/${circleId}/posts/${postId}/poll/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ optionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setUserVotedOptionId(null)
        setPoll(initialPoll)
        toast({ title: "Vote failed", description: data.error || "Could not record vote", variant: "destructive" })
      }
    } catch {
      setUserVotedOptionId(null)
      setPoll(initialPoll)
    } finally {
      setIsVoting(false)
    }
  }

  return (
    <div className="mb-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Badge className="bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-400/30 font-bold px-2.5 py-0.5 text-xs flex items-center gap-1">
          <Vote className="h-3.5 w-3.5" /> POLL
        </Badge>
        <span className="text-xs text-muted-foreground font-medium">{totalVotes} votes</span>
        {poll.expires_at && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
            <Clock className="h-3.5 w-3.5" />
            <span>{isExpired ? "Ended " : "Ends "}</span>
            <FreshnessTimestamp date={poll.expires_at} />
          </div>
        )}
      </div>

      <p className="text-sm font-semibold">{poll.question}</p>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const votesCount = option.votes || 0
          const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0
          const isUserChoice = option.id === userVotedOptionId

          return showResults ? (
            <div
              key={option.id}
              className={`relative overflow-hidden rounded-xl border p-2.5 text-xs font-medium flex items-center justify-between ${
                isUserChoice ? "border-cyan-400 bg-cyan-500/10" : "border-border bg-muted"
              }`}
            >
              <div
                className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ${isUserChoice ? "bg-cyan-500/20" : "bg-muted-foreground/10"}`}
                style={{ width: `${percent}%` }}
              />
              <span className="relative z-10 flex items-center gap-1.5 truncate pr-2">
                {isUserChoice && <CheckCircle2 className="h-3.5 w-3.5 text-cyan-500 shrink-0" />}
                {option.text}
              </span>
              <span className="relative z-10 shrink-0">
                {percent}% <span className="text-muted-foreground">({votesCount})</span>
              </span>
            </div>
          ) : (
            <button
              key={option.id}
              type="button"
              disabled={isVoting}
              onClick={() => handleVote(option.id)}
              className="w-full text-left rounded-xl border border-border bg-muted p-2.5 text-xs font-medium hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-colors"
            >
              {option.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
