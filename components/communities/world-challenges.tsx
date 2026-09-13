"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { formatNumber, timeAgo } from "@/lib/community-engine"
import {
  Trophy,
  Plus,
  Users,
  
  Flame,
  CheckCircle2,
  Heart,
  Lock,
  Coins,
  Clock,
  Crown,
  User,
} from "lucide-react"
import { DeviceMediaPicker, isVideoUrl, type PickedMedia } from "./device-media-picker"
import { Spinner } from "@/components/ui/skeletons"
import { VerifiedSeal } from "@/components/ui/verified-seal"

interface Challenge {
  id: number
  title: string
  description: string
  challenge_type: string
  starts_at: string
  ends_at: string
  status: string
  entry_count: number
  participant_count: number
  reward_coins?: number
  creator?: { username?: string; display_name?: string; avatar_url?: string | null; is_verified?: boolean }
}

export function WorldChallenges({
  communityId,
  initial,
  isMember,
  isModerator,
  focusId,
  onFocused,
}: {
  communityId: string
  initial: Challenge[]
  isMember: boolean
  isModerator: boolean
  focusId?: number
  onFocused?: () => void
}) {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState<Challenge[]>(initial)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [challengeType, setChallengeType] = useState("standard")
  const [durationDays, setDurationDays] = useState("7")
  const [rewardCoins, setRewardCoins] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [active, setActive] = useState<Challenge | null>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [submitContent, setSubmitContent] = useState("")
  const [submitMediaItems, setSubmitMediaItems] = useState<PickedMedia[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [voting, setVoting] = useState<number | null>(null)
  const [flashId, setFlashId] = useState<number | null>(null)

  const create = async () => {
    if (!title.trim()) return setError("Challenge needs a title")
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          challenge_type: challengeType,
          reward_coins: Math.max(0, Number(rewardCoins) || 0),
          ends_at: new Date(Date.now() + Number(durationDays) * 86400000).toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create")
      setOpen(false)
      setChallenges((prev) => [data.challenge, ...prev])
      setTitle("")
      setDescription("")
      setRewardCoins("")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Deep-link focus from What's Happening / Community Loop
  useEffect(() => {
    if (!focusId) return
    let attempts = 0
    const tryScroll = () => {
      attempts += 1
      const el = document.getElementById(`world-challenge-${focusId}`)
      if (el) {
        setFlashId(focusId)
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        setTimeout(() => {
          setFlashId(null)
          if (onFocused) onFocused()
        }, 2400)
      } else if (attempts < 10) {
        setTimeout(tryScroll, 180)
      } else if (onFocused) {
        onFocused()
      }
    }
    tryScroll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, challenges.length])

  const openChallenge = async (c: Challenge) => {
    setActive(c)
    setEntriesLoading(true)
    setEntries([])
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/challenges/${c.id}/entries`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setEntries(data.entries || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setEntriesLoading(false)
    }
  }

  const submitEntry = async () => {
    if (!active || (!submitContent.trim() && submitMediaItems.length === 0)) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/challenges/${active.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: submitContent, media_url: submitMediaItems[0]?.url || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to submit")
      setSubmitContent("")
      setSubmitMediaItems([])
      openChallenge(active)
      setChallenges((prev) =>
        prev.map((c) => (c.id === active.id ? { ...c, entry_count: c.entry_count + 1, participant_count: c.participant_count + 1 } : c))
      )
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const vote = async (entryId: number) => {
    if (!active || !user) return
    setVoting(entryId)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/challenges/${active.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vote", entry_id: entryId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to vote")
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, vote_count: data.vote_count, has_voted: data.voted } : e))
      )
    } catch (e: any) {
      setError(e.message)
    } finally {
      setVoting(null)
    }
  }

  const rankedEntries = [...entries].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
  const challengeDone = active?.status === "completed"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold">Missions & Challenges</h2>
          <p className="text-xs text-muted-foreground">Submit entries, the community votes, winners are remembered.</p>
        </div>
        {isMember && (
          <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New challenge
          </Button>
        )}
      </div>

      {challenges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Trophy className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-sm font-semibold">No challenges yet</p>
          <p className="text-xs text-muted-foreground mt-1">Give the community something to do — launch the first challenge.</p>
          {isMember && (
            <Button size="sm" variant="outline" className="mt-4 rounded-full" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Challenge
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {challenges.map((c) => (
            <button
              key={c.id}
              id={`world-challenge-${c.id}`}
              onClick={() => openChallenge(c)}
              className={`group rounded-2xl border bg-card p-4 text-left transition hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5 scroll-mt-24 ${
                flashId === c.id ? "border-amber-500 ring-2 ring-amber-500/40" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/15">
                  <Flame className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                    {c.status === "active" ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" /> {timeAgo(c.ends_at, true)}
                      </span>
                    ) : (
                      c.status
                    )}
                  </Badge>
                  {Number(c.reward_coins || 0) > 0 && (
                    <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                      <Coins className="h-2.5 w-2.5 mr-0.5" /> {formatNumber(Number(c.reward_coins))} prize
                    </Badge>
                  )}
                </div>
              </div>
              <p className="mt-2 font-bold text-sm truncate group-hover:text-amber-500 transition-colors">{c.title}</p>
              {c.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
              {c.creator?.username && (
                <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <User className="h-3 w-3" /> by {c.creator.display_name || c.creator.username}
                  {c.creator.is_verified && <VerifiedSeal size={14} title="Verified Creator" />}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.participant_count || c.entry_count || 0} participants</span>
                <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {c.entry_count || 0} entries</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Launch a challenge</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium">Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 rounded-xl" maxLength={120} placeholder='e.g. "Weekend Meme Battle"' />
            </div>
            <div>
              <label className="text-xs font-medium">Description / rules</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 rounded-xl text-sm min-h-[80px]" maxLength={2000} placeholder="What should the community create? Any rules to follow?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Type</label>
                <div className="mt-1 flex gap-1.5">
                  {["standard", "creative", "speedrun"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setChallengeType(t)}
                      className={`flex-1 rounded-lg border p-2 text-center text-[11px] font-semibold capitalize transition ${challengeType === t ? "border-amber-500 bg-amber-500/10" : "border-border hover:border-amber-500/40"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Duration (days)</label>
                <Input type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="mt-1 rounded-xl h-9" min={1} max={30} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Prize (Loop Coins) — optional</label>
              <div className="relative mt-1">
                <Coins className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  value={rewardCoins}
                  onChange={(e) => setRewardCoins(e.target.value)}
                  className="rounded-xl pl-9 h-9"
                  min={0}
                  placeholder="0 — no prize"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving} className="rounded-full bg-amber-600 hover:bg-amber-500">
              {saving ? <Spinner className="h-3.5 w-3.5 mr-1.5" /> : <Flame className="h-3.5 w-3.5 mr-1.5" />}
              Launch challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entries dialog */}
      <Dialog open={Boolean(active)} onOpenChange={(o) => { if (!o) setActive(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-amber-500" /> {active.title}
                  <Badge className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                    {active.status === "active" ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" /> {timeAgo(active.ends_at, true)}
                      </span>
                    ) : (
                      active.status
                    )}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              {active.description && <p className="text-sm text-muted-foreground -mt-1">{active.description}</p>}

              {/* Challenge meta row — creator, prize, participants */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-[11px] text-muted-foreground">
                {active.creator?.username && (
                  <span className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={active.creator.avatar_url || ""} alt="" />
                      <AvatarFallback className="text-[8px]">{(active.creator.display_name || active.creator.username).slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    Hosted by {active.creator.display_name || active.creator.username}
                  </span>
                )}
                {Number(active.reward_coins || 0) > 0 && (
                  <span className="flex items-center gap-1 font-semibold text-emerald-600">
                    <Coins className="h-3 w-3" /> {formatNumber(Number(active.reward_coins))} prize
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {active.participant_count || 0} participants
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> {active.entry_count || 0} entries
                </span>
              </div>

              {isMember ? (
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2.5">
                  <Textarea value={submitContent} onChange={(e) => setSubmitContent(e.target.value)} placeholder="Write about your entry (or just upload media)…" className="rounded-xl text-sm min-h-[60px]" maxLength={2000} />
                  <DeviceMediaPicker
                    items={submitMediaItems}
                    onChange={setSubmitMediaItems}
                    maxItems={1}
                    folder="community-challenges"
                    compact
                  />
                  <div className="flex justify-end pt-0.5">
                    <Button size="sm" className="rounded-full bg-amber-600 hover:bg-amber-500 h-8 text-[11px]" onClick={submitEntry} disabled={submitting || (!submitContent.trim() && submitMediaItems.length === 0)}>
                      {submitting ? <Spinner className="h-3.5 w-3.5 mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                      Submit entry
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Join the community to submit and vote.</p>
              )}

              {entriesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner className="h-5 w-5 text-amber-500" />
                </div>
              ) : entries.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">The stage is empty — enter now and claim the first spot.</p>
              ) : (
                <div className="space-y-2.5">
                  {rankedEntries.map((e, idx) => {
                    const isWinner = challengeDone && idx === 0 && (e.vote_count || 0) > 0
                    return (
                      <div key={e.id} className={`rounded-xl border bg-card p-3 ${isWinner ? "border-amber-500/50 bg-amber-500/[0.04]" : "border-border"}`}>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={e.author?.avatar_url || ""} alt="" />
                              <AvatarFallback className="text-[10px]">{(e.author?.display_name || e.author?.username || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            {challengeDone && idx === 0 && (e.vote_count || 0) > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white">
                                <Crown className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-semibold">{e.author?.display_name || e.author?.username}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(e.created_at)}</span>
                        </div>
                        {e.content && <p className="mt-2 text-xs">{e.content}</p>}
                        {e.media_url && isVideoUrl(e.media_url) ? (
                          <div className="mt-2 relative aspect-video overflow-hidden rounded-lg bg-muted">
                            <video src={e.media_url} controls playsInline className="h-full w-full object-contain" />
                          </div>
                        ) : e.media_url ? (
                          <div className="mt-2 relative aspect-video overflow-hidden rounded-lg bg-muted">
                            <Image src={e.media_url} alt="" fill className="object-cover" unoptimized />
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center gap-2">
                          <Button size="sm" variant={e.has_voted ? "default" : "outline"} className="rounded-full h-7 text-[11px]" disabled={voting === e.id || !user || !isMember} onClick={() => vote(e.id)}>
                            <Heart className={`h-3 w-3 mr-1 ${e.has_voted ? "fill-white" : ""}`} />
                            {e.vote_count || 0}
                          </Button>
                          {e.has_voted && <span className="text-[10px] text-muted-foreground">You voted</span>}
                          {challengeDone && idx === 0 && (e.vote_count || 0) > 0 && (
                            <span className="ml-auto text-[10px] font-bold text-amber-600">Winner</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}