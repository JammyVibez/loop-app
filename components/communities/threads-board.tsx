"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArrowLeft, Check, Loader2, Pencil, Pin, Plus, Radio, RotateCcw, Send, Trash2, Users, Video } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/community-engine"
import {
  FollowIcon,
  THREAD_KINDS,
  ThreadKindIcon,
  ThreadRow,
  ThreadStateChip,
  threadKind,
  type ThreadRecord,
} from "@/components/communities/thread-row"

const FILTERS = [
  { id: "open", label: "Open" },
  { id: "decided", label: "Decided" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "Everything" },
] as const

/**
 * Open a thread (create) or edit an existing one.
 * The same dialog does both so the copy and validation stay identical.
 */
export function NewThreadDialog({
  open,
  onOpenChange,
  communityId,
  spaces,
  onCreated,
  thread,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  communityId: string
  spaces: any[]
  onCreated: (thread: ThreadRecord) => void
  thread?: ThreadRecord | null
}) {
  const { toast } = useToast()
  const editing = Boolean(thread)
  const [title, setTitle] = useState("")
  const [prompt, setPrompt] = useState("")
  const [kind, setKind] = useState<string>("make")
  const [spaceId, setSpaceId] = useState<string>("none")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(thread?.title || "")
      setPrompt(thread?.prompt || "")
      setKind(thread?.kind || "make")
      setSpaceId(thread?.space?.id ? String(thread.space.id) : "none")
    }
  }, [open, thread])

  const submit = async () => {
    if (title.trim().length < 3) {
      toast({ title: "Give the thread a title", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        prompt: prompt.trim(),
        kind,
        space_id: spaceId === "none" ? null : Number(spaceId),
      }
      const res = await fetch(
        editing ? `/api/communities/${communityId}/threads/${thread!.id}` : `/api/communities/${communityId}/threads`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (editing ? "Failed to update thread" : "Failed to open thread"))
      onCreated(data.thread)
      onOpenChange(false)
      toast({
        title: editing ? "Thread updated" : "Thread opened",
        description: editing ? undefined : "It shows up for everyone in the community.",
      })
    } catch (e: any) {
      toast({
        title: editing ? "Couldn't update the thread" : "Couldn't open the thread",
        description: e.message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit thread" : "Open a thread"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the title, context, kind, or where posts land."
              : "A thread is one piece of work with an end. Decide it, record the outcome, archive it."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground">What is it?</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name the thread"
              maxLength={120}
              className="mt-1.5"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Context</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Why does this exist? What does done look like?"
              maxLength={600}
              rows={3}
              className="mt-1.5 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Kind of work</label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {THREAD_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors",
                    kind === k.id
                      ? "border-foreground/30 bg-muted"
                      : "border-border bg-background hover:bg-muted/50",
                  )}
                >
                  <ThreadKindIcon kind={k.id} className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <span>
                    <span className="block text-xs font-semibold text-foreground">{k.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{k.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {spaces.length > 0 ? (
            <div>
              <label className="text-xs font-semibold text-foreground">Where posts land</label>
              <Select value={spaceId} onValueChange={setSpaceId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="No space" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No space</SelectItem>
                  {spaces.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : editing ? (
              <Check className="mr-1.5 h-4 w-4" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" />
            )}
            {editing ? "Save changes" : "Open thread"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The Threads tab: the lifecycle board. */
export function ThreadsBoard({
  communityId,
  spaces,
  isMember,
  openThreadId,
  onThreadOpened,
}: {
  communityId: string
  spaces: any[]
  isMember: boolean
  openThreadId?: number | null
  onThreadOpened?: () => void
}) {
  const { toast } = useToast()
  const [threads, setThreads] = useState<ThreadRecord[]>([])
  const [filter, setFilter] = useState<string>("open")
  const [spaceFilter, setSpaceFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [canCreate, setCanCreate] = useState(false)
  const [canManage, setCanManage] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ state: filter })
      if (spaceFilter !== "all") params.set("space_id", spaceFilter)
      const res = await fetch(`/api/communities/${communityId}/threads?${params.toString()}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load threads")
      setThreads(data.threads || [])
      setCanCreate(Boolean(data.can_create))
      setCanManage(Boolean(data.can_manage))
    } catch (e: any) {
      toast({ title: "Couldn't load threads", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [communityId, filter, spaceFilter, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (openThreadId) setSelected(openThreadId)
  }, [openThreadId])

  const openThread = (thread: ThreadRecord) => {
    setSelected(thread.id)
    onThreadOpened?.()
  }

  if (selected) {
    return (
      <ThreadDetail
        communityId={communityId}
        threadId={selected}
        isMember={isMember}
        canManage={canManage}
        spaces={spaces}
        onBack={() => {
          setSelected(null)
          void load()
        }}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-sm font-semibold tracking-tight">Threads</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Work moves through states here — nothing rots in an endless scroll.
          </p>
        </div>
        {isMember && canCreate ? (
          <Button size="sm" className="h-8 shrink-0 rounded-full px-3 text-xs" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New thread
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                filter === f.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {spaces.length > 0 ? (
          <Select value={spaceFilter} onValueChange={setSpaceFilter}>
            <SelectTrigger className="h-8 w-[150px] rounded-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All spaces</SelectItem>
              {spaces.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="divide-y divide-border/60">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              {filter === "open"
                ? "No open threads. Everyone is either decided or resting."
                : "Nothing here yet."}
            </p>
          ) : (
            threads.map((t) => <ThreadRow key={t.id} thread={t} onOpen={openThread} />)
          )}
        </div>
      </div>

      <NewThreadDialog
        open={creating}
        onOpenChange={setCreating}
        communityId={communityId}
        spaces={spaces}
        onCreated={(t) => {
          setSelected(t.id)
          void load()
        }}
      />
    </div>
  )
}

/** One thread: its prompt, its contributions, its outcome, its lifecycle. */
function ThreadDetail({
  communityId,
  threadId,
  isMember,
  canManage,
  spaces,
  onBack,
}: {
  communityId: string
  threadId: number
  isMember: boolean
  canManage: boolean
  spaces: any[]
  onBack: () => void
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [outcome, setOutcome] = useState("")
  const [contribution, setContribution] = useState("")
  const [busy, setBusy] = useState(false)
  const [savingOutcome, setSavingOutcome] = useState(false)
  const [togglingLive, setTogglingLive] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load thread")
      setData(json)
      setOutcome(json.thread?.outcome || "")
    } catch (e: any) {
      toast({ title: "Couldn't load the thread", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [communityId, threadId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const patch = async (body: Record<string, any>, label?: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to update")
      await load()
      if (label) toast({ title: label })
    } catch (e: any) {
      toast({ title: "Couldn't update the thread", description: e.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const addContribution = async () => {
    const body = contribution.trim()
    if (!body) return
    setBusy(true)
    try {
      const res = await fetch(`/api/circles/${communityId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body, thread_id: threadId, space_id: data?.thread?.space_id || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to post")
      setContribution("")
      await load()
    } catch (e: any) {
      toast({ title: "Couldn't add that", description: e.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const deleteThread = async () => {
    if (!window.confirm("Delete this thread? Its posts stay, but they detach from it. This cannot be undone.")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}`, { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to delete thread")
      toast({ title: "Thread deleted" })
      onBack()
    } catch (e: any) {
      toast({ title: "Couldn't delete the thread", description: e.message, variant: "destructive" })
      setDeleting(false)
    }
  }

  const joinRoom = () => {
    const roomId: string | null = data?.thread?.live_stream_id || null
    if (!roomId) {
      toast({ title: "The room is still starting", description: "Give it a moment, then try again." })
      return
    }
    router.push(`/streams/${roomId}`)
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  const thread = data?.thread
  const isAuthor = Boolean(data?.is_author)
  if (!thread) return null
  const contributions: any[] = data?.contributions || []
  const kind = threadKind(thread.kind)

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> All threads
      </button>

      {/* Live banner — full width strip above the thread card */}
      {thread.is_live ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Live now</p>
            <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">
              {thread.live_viewer_count ? `${thread.live_viewer_count} watching` : "Voice, video and chat are open"}
            </p>
          </div>
          {isMember ? (
            <Button
              size="sm"
              className="ml-auto h-8 shrink-0 rounded-full bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
              onClick={joinRoom}
            >
              <Video className="mr-1.5 h-3.5 w-3.5" /> Join room
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-start gap-3 px-4 py-3.5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
            <ThreadKindIcon kind={thread.kind} className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-foreground">{thread.title}</h1>
              <ThreadStateChip state={thread.state} />
              {thread.is_pinned ? <Pin className="h-3.5 w-3.5 text-amber-500" /> : null}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
              <span>{kind.label}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={thread.creator?.avatar_url || ""} alt="" />
                  <AvatarFallback className="text-[8px]">
                    {(thread.creator?.display_name || thread.creator?.username || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {thread.creator?.display_name || thread.creator?.username}
              </span>
              <span>·</span>
              <span>opened {timeAgo(thread.created_at)}</span>
              {thread.space?.name ? (
                <>
                  <span>·</span>
                  <span>{thread.space.name}</span>
                </>
              ) : null}
            </p>
            {thread.prompt ? (
              <p className="mt-2.5 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {thread.prompt}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isMember ? (
              <button
                type="button"
                title={`Notifications: ${thread.follow_mode || "none"}`}
                onClick={() =>
                  patch({ follow_mode: thread.follow_mode === "all" ? "mentions" : thread.follow_mode === "mentions" ? "none" : "all" })
                }
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
              >
                <FollowIcon mode={thread.follow_mode} className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {canManage ? (
              <>
                <button
                  type="button"
                  title={thread.is_pinned ? "Unpin" : "Pin"}
                  onClick={() => patch({ is_pinned: !thread.is_pinned }, thread.is_pinned ? "Unpinned" : "Pinned")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Pin className={cn("h-3.5 w-3.5", thread.is_pinned && "text-amber-500")} />
                </button>
                {thread.state !== "decided" ? (
                  <Button
                    size="sm"
                    className="h-8 rounded-full px-3 text-xs"
                    disabled={busy}
                    onClick={() => patch({ state: "decided" }, "Marked decided")}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Decide
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full px-3 text-xs"
                    disabled={busy}
                    onClick={() => patch({ state: "open" }, "Reopened")}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reopen
                  </Button>
                )}
                {thread.state !== "archived" ? (
                  <button
                    type="button"
                    title="Archive"
                    onClick={() => patch({ state: "archived" }, "Archived")}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {/* Go live / End live toggle */}
                <button
                  type="button"
                  title={thread.is_live ? "End live" : "Go live"}
                  disabled={togglingLive}
                  onClick={async () => {
                    setTogglingLive(true)
                    try {
                      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ is_live: !thread.is_live }),
                      })
                      if (!res.ok) throw new Error("Failed")
                      await load()
                      toast({ title: thread.is_live ? "Live session ended" : "You're live!" })
                    } catch {
                      toast({ title: "Couldn't toggle live", variant: "destructive" })
                    } finally {
                      setTogglingLive(false)
                    }
                  }}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                    thread.is_live
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {togglingLive ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Radio className="h-3.5 w-3.5" />
                  )}
                </button>
                {canManage || isAuthor ? (
                  <button
                    type="button"
                    title="Edit thread"
                    onClick={() => setEditing(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {canManage ? (
                  <button
                    type="button"
                    title="Delete thread"
                    disabled={deleting}
                    onClick={() => void deleteThread()}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-500"
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {/* Outcome — the reason the thread exists */}
        <div className="border-t border-border/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Outcome</p>
            {thread.decided_at ? (
              <p className="text-[10px] text-muted-foreground">
                decided {timeAgo(thread.decided_at)}
                {thread.decider?.display_name ? ` by ${thread.decider.display_name}` : ""}
              </p>
            ) : null}
          </div>
          {canManage ? (
            <div className="mt-2 flex items-start gap-2">
              <Textarea
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What did this thread produce? One or two lines everyone can read later."
                rows={2}
                maxLength={600}
                className="min-h-[64px] resize-none text-sm"
              />
              <Button
                size="sm"
                className="h-8 shrink-0 rounded-full px-3 text-xs"
                disabled={savingOutcome || outcome === (thread.outcome || "")}
                onClick={async () => {
                  setSavingOutcome(true)
                  await patch({ outcome }, "Outcome saved")
                  setSavingOutcome(false)
                }}
              >
                Save
              </Button>
            </div>
          ) : (
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
              {thread.outcome || "Nothing recorded yet."}
            </p>
          )}
        </div>
      </div>

      {/* Contributions */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Contributions</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground">{contributions.length}</span>
        </div>

        <div className="divide-y divide-border/60">
          {contributions.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              Nothing here yet. Add the first piece.
            </p>
          ) : (
            contributions.map((p) => (
              <div key={p.id} className="flex items-start gap-3 px-4 py-3">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={p.author?.avatar_url || ""} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {(p.author?.display_name || p.author?.username || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-foreground">
                      {p.author?.display_name || p.author?.username}
                    </span>
                    <span className="text-muted-foreground">{timeAgo(p.created_at)}</span>
                  </p>
                  {p.content ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{p.content}</p>
                  ) : null}
                  {Array.isArray(p.media_urls) && p.media_urls.length > 0 ? (
                    <div className="mt-2 flex gap-2">
                      {p.media_urls.slice(0, 3).map((u: string, i: number) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={`/api/image-proxy?url=${encodeURIComponent(u)}`}
                          alt=""
                          className="h-20 w-20 rounded-lg border border-border object-cover"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {isMember && thread.state !== "archived" ? (
          <div className="flex items-end gap-2 border-t border-border/60 px-4 py-3">
            <Textarea
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              placeholder="Add to this thread…"
              rows={1}
              className="min-h-[40px] resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void addContribution()
                }
              }}
            />
            <Button
              size="sm"
              className="h-9 shrink-0 rounded-full px-3"
              disabled={busy || !contribution.trim()}
              onClick={() => void addContribution()}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : null}
      </div>

      <NewThreadDialog
        open={editing}
        onOpenChange={setEditing}
        communityId={communityId}
        spaces={spaces}
        thread={thread}
        onCreated={() => void load()}
      />
    </div>
  )
}
