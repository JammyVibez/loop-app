"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useLoginGate } from "@/hooks/use-login-gate"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import {
  Check,
  CheckCircle2,
  Coins,
  ExternalLink,
  Hourglass,
  Loader2,
  ShieldCheck,
  Target,
  Trophy,
  X,
} from "lucide-react"

interface Quest {
  id: string
  title: string
  description: string
  difficulty: "beginner" | "intermediate" | "expert"
  reward_coins: number
  tags: string[]
  ends_at: string | null
  is_active: boolean
  completions: number
  my_submission: { id: string; status: string; reward_coins_awarded: number; created_at: string } | null
}

interface AdminSubmission {
  id: string
  status: "pending" | "approved" | "rejected"
  note: string | null
  link: string | null
  created_at: string
  quest?: { id: string; title: string; difficulty: string; reward_coins: number }
  user?: { id: string; username: string; display_name: string; avatar_url: string | null }
  project?: { id: string; title: string } | null
}

const DIFFICULTY_META: Record<Quest["difficulty"], { label: string; className: string }> = {
  beginner: { label: "Beginner", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  intermediate: { label: "Intermediate", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  expert: { label: "Expert", className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
}

const STATUS_META: Record<string, { label: string; className: string; icon: typeof Hourglass }> = {
  pending: { label: "Pending review", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Hourglass },
  approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-rose-500/15 text-rose-600 dark:text-rose-400", icon: X },
}

function endsInLabel(iso: string | null) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return "Ended"
  const days = Math.ceil(ms / 86_400_000)
  if (days > 1) return `${days} days left`
  const hours = Math.max(1, Math.ceil(ms / 3_600_000))
  return `${hours}h left`
}

export function DeveloperQuests() {
  const { user, getAuthHeader, refreshUser } = useAuth()
  const { toast } = useToast()
  const { requireAuth, LoginGateDialog } = useLoginGate()

  const [quests, setQuests] = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitFor, setSubmitFor] = useState<Quest | null>(null)
  const [myProjects, setMyProjects] = useState<Array<{ id: string; title: string }>>([])
  const [draft, setDraft] = useState({ project_id: "", link: "", note: "" })

  const [adminSubs, setAdminSubs] = useState<AdminSubmission[]>([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const isAdmin = Boolean(user?.is_admin)

  const fetchQuests = useCallback(async () => {
    try {
      const res = await fetch("/api/developers/quests", {
        headers: user ? getAuthHeader() : undefined,
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load quests")
      setQuests(data.quests || [])
    } catch (err: any) {
      toast({ title: "Quests unavailable", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [user, getAuthHeader, toast])

  const fetchAdminSubs = useCallback(async () => {
    if (!isAdmin) return
    setAdminLoading(true)
    try {
      const res = await fetch("/api/admin/quest-submissions", {
        headers: getAuthHeader(),
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load submissions")
      setAdminSubs(data.submissions || [])
    } catch (err: any) {
      console.error("Admin quest submissions load failed:", err)
    } finally {
      setAdminLoading(false)
    }
  }, [isAdmin, getAuthHeader])

  useEffect(() => {
    void fetchQuests()
  }, [fetchQuests])

  useEffect(() => {
    void fetchAdminSubs()
  }, [fetchAdminSubs])

  // Realtime: new submissions + admin review decisions show up instantly.
  useEffect(() => {
    const channel = supabase.channel("dev-quests:live")
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dev_quest_submissions" },
        () => {
          void fetchQuests()
          void fetchAdminSubs()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dev_quests" },
        () => void fetchQuests(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const openSubmit = async (quest: Quest) => {
    if (!requireAuth("submit")) return
    setSubmitFor(quest)
    setDraft({ project_id: "", link: "", note: "" })
    try {
      const res = await fetch("/api/developers/projects?mine=true&sortBy=recent", {
        headers: getAuthHeader(),
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      setMyProjects(
        (data.projects || []).map((p: any) => ({ id: p.id, title: p.title })),
      )
    } catch {
      setMyProjects([])
    }
  }

  const submitQuest = async () => {
    if (!submitFor) return
    if (!draft.project_id && !draft.link.trim()) {
      toast({ title: "Link a project or paste a URL", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/developers/quests/${submitFor.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          project_id: draft.project_id || null,
          link: draft.link.trim(),
          note: draft.note.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to submit")
      toast({ title: "Submitted!", description: "An admin will review your entry." })
      setSubmitFor(null)
      await fetchQuests()
    } catch (err: any) {
      toast({ title: "Submit failed", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const review = async (submission: AdminSubmission, status: "approved" | "rejected") => {
    setReviewingId(submission.id)
    try {
      const res = await fetch("/api/admin/quest-submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ submission_id: submission.id, status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Review failed")
      toast({
        title: status === "approved" ? "Approved + coins credited" : "Submission rejected",
        description:
          status === "approved"
            ? `${data.coins_awarded || 0} Loop Coins awarded to the submitter.`
            : undefined,
      })
      await Promise.all([fetchAdminSubs(), fetchQuests()])
      // Keep the signed-in viewer's coin balance fresh if they were approved.
      if (status === "approved") void refreshUser()
    } catch (err: any) {
      toast({ title: "Review failed", description: err.message, variant: "destructive" })
    } finally {
      setReviewingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading quests…
      </div>
    )
  }

  return (
    <>
      {LoginGateDialog}

      <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-card to-indigo-600/5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
            <Target className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold tracking-tight">Dev Quests & bounties</h3>
            <p className="text-sm text-muted-foreground">
              Complete challenges, get your work reviewed by the team, and earn real Loop Coins for
              shipping. New quests drop regularly — check back often.
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1 rounded-full">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            {quests.filter((q) => q.my_submission?.status === "approved").length} completed
          </Badge>
        </CardContent>
      </Card>

      {quests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Target className="h-9 w-9 text-muted-foreground" />
            <p className="font-medium">No active quests right now</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              The team is cooking up the next batch of bounties. Check the Developer Hub again soon.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {quests.map((quest) => {
            const difficulty = DIFFICULTY_META[quest.difficulty] || DIFFICULTY_META.beginner
            const my = quest.my_submission
            const statusMeta = my ? STATUS_META[my.status] : null
            const StatusIcon = statusMeta?.icon || Hourglass
            const endsIn = endsInLabel(quest.ends_at)
            return (
              <Card
                key={quest.id}
                className="overflow-hidden border-border/70 transition hover:border-cyan-500/30"
              >
                <CardContent className="p-0">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
                    <Badge className={cn("rounded-full", difficulty.className)}>
                      {difficulty.label}
                    </Badge>
                    <Badge variant="secondary" className="gap-1 rounded-full">
                      <Coins className="h-3.5 w-3.5 text-yellow-500" />
                      {quest.reward_coins.toLocaleString()} coins
                    </Badge>
                    {endsIn && (
                      <Badge variant="outline" className="ml-auto rounded-full text-[11px]">
                        <Hourglass className="mr-1 h-3 w-3" />
                        {endsIn}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-3 px-4 py-4">
                    <h3 className="font-bold leading-tight">{quest.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground line-clamp-4">
                      {quest.description}
                    </p>
                    {quest.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {quest.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="rounded-full text-[10px]">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                      <p className="text-xs text-muted-foreground">
                        <Trophy className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
                        {quest.completions} dev{quest.completions === 1 ? "" : "s"} completed
                      </p>
                      {my && statusMeta ? (
                        <Badge className={cn("gap-1 rounded-full", statusMeta.className)}>
                          <StatusIcon className="h-3 w-3" />
                          {statusMeta.label}
                          {my.status === "approved" && my.reward_coins_awarded > 0
                            ? ` · +${my.reward_coins_awarded}`
                            : ""}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          className="rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:from-cyan-400 hover:to-indigo-500"
                          onClick={() => void openSubmit(quest)}
                        >
                          <Trophy className="mr-1.5 h-3.5 w-3.5" />
                          Enter quest
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {isAdmin && (
        <Card className="border-amber-500/25">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold">Review submissions</h3>
              <span className="text-xs text-muted-foreground">
                · {adminSubs.filter((s) => s.status === "pending").length} pending
              </span>
              {adminLoading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {adminSubs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No submissions yet — they'll appear here in real time.
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {adminSubs.map((sub) => {
                  const pending = sub.status === "pending"
                  return (
                    <div key={sub.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={sub.user?.avatar_url ?? undefined} />
                          <AvatarFallback>{(sub.user?.display_name || "U").charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {sub.user?.display_name || "user"}
                            <span className="font-normal text-muted-foreground">
                              {" "}· {sub.quest?.title}
                            </span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {sub.project ? `Project: ${sub.project.title}` : sub.link || sub.note || "No details"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {sub.quest?.reward_coins ? (
                          <Badge variant="outline" className="gap-1 rounded-full text-[11px]">
                            <Coins className="h-3 w-3 text-yellow-500" />
                            {sub.quest.reward_coins}
                          </Badge>
                        ) : null}
                        {pending ? (
                          <>
                            <Button
                              size="sm"
                              className="h-8 rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
                              disabled={reviewingId === sub.id}
                              onClick={() => void review(sub, "approved")}
                            >
                              {reviewingId === sub.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full text-muted-foreground hover:text-destructive"
                              disabled={reviewingId === sub.id}
                              onClick={() => void review(sub, "rejected")}
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </>
                        ) : (
                          <Badge className={cn("rounded-full", STATUS_META[sub.status]?.className)}>
                            {STATUS_META[sub.status]?.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit dialog */}
      <Dialog open={!!submitFor} onOpenChange={(open) => !open && setSubmitFor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Enter: {submitFor?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link a project (recommended)</Label>
              {myProjects.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                  No projects yet —{" "}
                  <Link href="/developers" className="underline">
                    share one in the Developer Hub
                  </Link>{" "}
                  first, or paste a URL below.
                </p>
              ) : (
                <Select value={draft.project_id} onValueChange={(v) => setDraft((d) => ({ ...d, project_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose one of your projects" />
                  </SelectTrigger>
                  <SelectContent>
                    {myProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Or paste a link</Label>
              <Input
                placeholder="https://github.com/you/repo"
                value={draft.link}
                onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Note for the reviewer</Label>
              <Textarea
                placeholder="What did you build? What makes it great?"
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSubmitFor(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => void submitQuest()}
                disabled={submitting || (!draft.project_id && !draft.link.trim())}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                Submit entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
