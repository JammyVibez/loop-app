"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Vote, CheckCircle2, Clock, Zap, Pencil, Plus, X } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

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

/**
 * Normalize poll options into { id, text, votes } primitives.
 * Legacy writers stored options as strings AND as nested objects like
 * { text: { text: "x" } } — rendering/editing those raw produced the
 * "[object Object]" option labels and NaN vote counts.
 */
function normalizeOptions(raw: any[] | undefined): PollOption[] {
  return (Array.isArray(raw) ? raw : []).map((o: any, i: number) => {
    if (o && typeof o === "object") {
      const val = o.text ?? o.label ?? o.name ?? ""
      const text = val && typeof val === "object" ? String(val.text ?? val.value ?? val.label ?? "") : String(val ?? "")
      return {
        id: String(o.id ?? `opt_${i + 1}`),
        text,
        votes: Number(o.votes || 0) || 0,
      }
    }
    return { id: `opt_${i + 1}`, text: String(o ?? ""), votes: 0 }
  })
}

function normalizePoll(p: PollData): PollData {
  return { ...p, options: normalizeOptions(p?.options as any) }
}

export function PollCardWidget({ poll: initialPoll, loopId, creatorId }: { poll?: PollData; loopId?: string; creatorId?: string }) {
  const [poll, setPoll] = useState<PollData | null>(initialPoll ? normalizePoll(initialPoll) : null)
  const [userVotedOptionId, setUserVotedOptionId] = useState<string | null>(null)
  const [isVoting, setIsVoting] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editQuestion, setEditQuestion] = useState("")
  const [editOptions, setEditOptions] = useState<string[]>([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [pollOwnerId, setPollOwnerId] = useState<string | null>(null)

  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (initialPoll) {
      setPoll(normalizePoll(initialPoll))
      return
    }
    if (loopId) {
      fetch(`/api/polls?loop_id=${loopId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.poll) setPoll(normalizePoll(data.poll))
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
                options: updated.options ? normalizeOptions(updated.options) : prev.options,
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

  const openEdit = () => {
    setEditQuestion(poll?.question || "")
    setEditOptions(poll?.options?.map(o => o.text) || ["", ""])
    setIsEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!poll || !user) return
    if (editOptions.filter(o => o.trim()).length < 2) {
      toast({ title: "Need at least 2 options" })
      return
    }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/polls/${poll.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ question: editQuestion, options: editOptions.filter(o => o.trim()) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update")
      setPoll(prev => prev ? { ...prev, question: editQuestion, options: editOptions.filter(o => o.trim()).map((text, i) => ({ id: `opt_${i+1}`, text, votes: 0 })) } : prev)
      setIsEditing(false)
      toast({ title: "Poll updated" })
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" })
    } finally {
      setSavingEdit(false)
    }
  }

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
    <>
    <div className="p-5 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-card space-y-4 my-3 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-400/30 font-bold px-2.5 py-0.5 text-xs flex items-center gap-1">
            <Vote className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" /> LIVE POLL
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">{totalVotes} Total Votes</span>
        </div>

        {creatorId && user?.id === creatorId && (poll.total_votes || 0) === 0 && !isExpired && (
          <button onClick={openEdit} className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition">
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
        {poll.expires_at && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
            <span>{isExpired ? "Ended" : "Ends"}</span>
            <FreshnessTimestamp date={poll.expires_at} />
          </div>
        )}
      </div>

      <h4 className="text-base font-bold text-foreground leading-snug">{poll.question}</h4>

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
                      ? "border-cyan-400 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200 ring-1 ring-cyan-400/40 shadow-md"
                      : "border-border bg-muted text-foreground"
                  }`}
                >
                  {/* Progress fill */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ${
                      isUserChoice
                        ? "bg-cyan-500/30"
                        : "bg-muted-foreground/20"
                    }`}
                    style={{ width: `${percent}%` }}
                  />

                  <div className="relative z-10 flex items-center gap-2 truncate pr-2">
                    {isUserChoice && <CheckCircle2 className="h-4 w-4 text-cyan-500 dark:text-cyan-400 shrink-0" />}
                    <span className="truncate">{option.text}</span>
                  </div>

                  <div className="relative z-10 font-bold flex items-center gap-2 shrink-0">
                    <span>{percent}%</span>
                    <span className="text-[10px] text-muted-foreground font-normal">({votesCount})</span>
                  </div>
                </div>
              ) : (
                /* Interactive Vote Button */
                <button
                  type="button"
                  disabled={isVoting}
                  onClick={() => handleVote(option.id)}
                  className="w-full text-left p-3 rounded-xl border border-border bg-muted hover:bg-cyan-500/10 hover:border-cyan-500/50 text-xs font-semibold text-foreground hover:text-cyan-600 dark:hover:text-cyan-300 transition-all duration-200 flex items-center justify-between group shadow-sm"
                >
                  <span className="truncate pr-2">{option.text}</span>
                  <Vote className="h-4 w-4 text-muted-foreground group-hover:text-cyan-500 dark:group-hover:text-cyan-400 shrink-0 transition-colors" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Edit Poll</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={editQuestion} onChange={e => setEditQuestion(e.target.value)} placeholder="Poll question" />
            {editOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input value={opt} onChange={e => { const n = [...editOptions]; n[i] = e.target.value; setEditOptions(n) }} placeholder={`Option ${i + 1}`} />
                {editOptions.length > 2 && (
                  <button onClick={() => setEditOptions(editOptions.filter((_, j) => j !== i))} className="text-rose-400 hover:text-rose-300 p-2"><X className="h-4 w-4" /></button>
                )}
              </div>
            ))}
            {editOptions.length < 6 && (
              <button onClick={() => setEditOptions([...editOptions, ""])} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                <Plus className="h-3 w-3" /> Add option
              </button>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}