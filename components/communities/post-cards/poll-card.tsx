"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Check, Clock } from "lucide-react"

interface PollOption {
  id: string
  text: string
  votes: number
}

interface PollCardProps {
  pollId: number
  question: string
  options: PollOption[]
  totalVotes: number
  expiresAt?: string
  isMember: boolean
  onVote: (pollId: number, optionId: string) => void
  voting?: boolean
}

export function PollCard({
  pollId,
  question,
  options,
  totalVotes,
  expiresAt,
  isMember,
  onVote,
  voting,
}: PollCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [localVotes, setLocalVotes] = useState<Record<string, number>>({})

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false
  const showResults = hasVoted || isExpired

  const handleVote = () => {
    if (!selectedOption || hasVoted) return
    onVote(pollId, selectedOption)
    setHasVoted(true)
    setLocalVotes((prev) => ({
      ...prev,
      [selectedOption]: (prev[selectedOption] || 0) + 1,
    }))
  }

  const getVotePercentage = (optionVotes: number, optionId: string) => {
    const actualVotes = optionVotes + (localVotes[optionId] || 0)
    const actualTotal = totalVotes + Object.values(localVotes).reduce((a, b) => a + b, 0)
    if (actualTotal === 0) return 0
    return Math.round((actualVotes / actualTotal) * 100)
  }

  return (
    <div className="mt-3 space-y-2">
      {question && (
        <p className="text-sm font-semibold">{question}</p>
      )}

      {options.map((opt) => {
        const pct = getVotePercentage(opt.votes, opt.id)
        const isSelected = selectedOption === opt.id
        const optVotes = opt.votes + (localVotes[opt.id] || 0)

        return (
          <button
            key={opt.id}
            onClick={() => {
              if (!showResults && isMember && !isExpired) {
                setSelectedOption(opt.id)
              }
            }}
            disabled={showResults || !isMember || isExpired}
            className={cn(
              "w-full relative rounded-xl border p-3 text-left transition-all",
              showResults
                ? "border-border"
                : isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:border-primary/40",
            )}
          >
            {showResults && (
              <div
                className="absolute inset-0 rounded-xl bg-primary/10 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            )}
            <div className="relative flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{opt.text}</span>
              <div className="flex items-center gap-2 shrink-0">
                {isSelected && !showResults && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
                {showResults && (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {optVotes} ({pct}%)
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">
          {totalVotes + Object.values(localVotes).reduce((a, b) => a + b, 0)} vote{(totalVotes + Object.values(localVotes).reduce((a, b) => a + b, 0)) !== 1 ? "s" : ""}
        </span>
        {expiresAt && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {isExpired ? "Ended" : `Ends ${new Date(expiresAt).toLocaleDateString()}`}
          </span>
        )}
      </div>

      {!showResults && isMember && !isExpired && selectedOption && (
        <Button
          size="sm"
          className="rounded-full w-full mt-1"
          onClick={handleVote}
          disabled={voting}
        >
          Vote
        </Button>
      )}
    </div>
  )
}
