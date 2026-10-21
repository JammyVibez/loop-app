"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RichContent } from "@/components/content/rich-content"
import { Spinner } from "@/components/ui/skeletons"
import { cn } from "@/lib/utils"
import {
  ArrowBigUp,
  ArrowLeft,
  CornerDownRight,
  Eye,
  Hash,
  Loader2,
  Lock,
  MoreHorizontal,
  Pin,
  Send,
  Shield,
  Trash2,
  Unlock,
  X,
} from "lucide-react"

type Author = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_verified?: boolean
}

type Reply = {
  id: string
  content: string
  media_url: string | null
  media_type: string | null
  created_at: string
  hidden: boolean
  author: Author | null
  is_author: boolean
  parent: { id: string; content: string; author_name: string } | null
}

type ThreadPayload = {
  thread: {
    id: string
    title: string
    body: string
    tags: string[]
    media_url: string | null
    media_type: string | null
    author: Author | null
    forum: { id: string; name: string; icon?: string | null } | null
    pinned: boolean
    locked: boolean
    hidden: boolean
    created_at: string
    replies_count: number
    votes: number
    views: number
  }
  replies: Reply[]
  viewer: {
    is_member: boolean
    is_staff: boolean
    can_manage: boolean
    is_author: boolean
    voted: boolean
    role: string | null
  }
}

function initials(name?: string | null) {
  return (name || "?").trim().slice(0, 2).toUpperCase()
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function ForumThread({ communityId, threadId }: { communityId: string; threadId: string }) {
  const router = useRouter()
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [data, setData] = useState<ThreadPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string; content: string } | null>(null)
  const [voting, setVoting] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      try {
        const res = await fetch(`/api/communities/${communityId}/threads/${threadId}`, {
          headers: { ...getAuthHeader() },
          cache: "no-store",
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to load thread")
        setData(json)
        setError(null)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [communityId, threadId, getAuthHeader],
  )

  useEffect(() => {
    void load()
  }, [load])

  const vote = async () => {
    if (!user) {
      router.push(`/auth?returnTo=/communities/${communityId}/posts/${threadId}`)
      return
    }
    if (voting || !data) return
    setVoting(true)
    const optimistic = data.thread.votes + (data.viewer.voted ? -1 : 1)
    setData({
      ...data,
      thread: { ...data.thread, votes: optimistic },
      viewer: { ...data.viewer, voted: !data.viewer.voted },
    })
    try {
      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}/vote`, {
        method: "POST",
        headers: { ...getAuthHeader() },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Vote failed")
      setData((prev) =>
        prev
          ? { ...prev, thread: { ...prev.thread, votes: json.votes }, viewer: { ...prev.viewer, voted: json.voted } }
          : prev,
      )
    } catch (e: any) {
      toast({ title: "Could not vote", description: e.message, variant: "destructive" })
      void load({ silent: true })
    } finally {
      setVoting(false)
    }
  }

  const send = async () => {
    const content = replyText.trim()
    if (!content || sending || !data) return
    if (!user) {
      router.push(`/auth?returnTo=/communities/${communityId}/posts/${threadId}`)
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ content, parent_comment_id: replyTarget?.id || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to reply")
      setReplyText("")
      setReplyTarget(null)
      setData((prev) =>
        prev
          ? {
              ...prev,
              replies: [
                ...prev.replies,
                {
                  ...json.reply,
                  parent: replyTarget
                    ? { id: replyTarget.id, content: replyTarget.content.slice(0, 180), author_name: replyTarget.name }
                    : null,
                },
              ],
              thread: { ...prev.thread, replies_count: prev.thread.replies_count + 1 },
            }
          : prev,
      )
      toast({ title: "Reply posted" })
    } catch (e: any) {
      toast({ title: "Could not reply", description: e.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const moderate = async (action: "pin" | "unpin" | "lock" | "unlock" | "hide" | "restore") => {
    setBusy(true)
    try {
      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Action failed")
      await load({ silent: true })
      toast({ title: `Thread ${action === "unpin" ? "unpinned" : action === "unlock" ? "unlocked" : action === "restore" ? "restored" : `${action}ned`}` })
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const removeThread = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to delete")
      toast({ title: "Thread deleted" })
      router.push(`/communities/${communityId}`)
    } catch (e: any) {
      toast({ title: "Could not delete", description: e.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7 text-primary" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-sm font-medium">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push(`/communities/${communityId}`)}>
          Back to forum
        </Button>
      </div>
    )
  }

  if (!data) return null
  const { thread, replies, viewer } = data

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-28 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={`/communities/${communityId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to forum
        </Link>
        {viewer.can_manage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {viewer.is_staff && (
                <>
                  <DropdownMenuItem onClick={() => moderate(thread.pinned ? "unpin" : "pin")} disabled={busy}>
                    <Pin className="mr-2 h-4 w-4" /> {thread.pinned ? "Unpin" : "Pin thread"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => moderate(thread.locked ? "unlock" : "lock")} disabled={busy}>
                    {thread.locked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                    {thread.locked ? "Unlock replies" : "Lock replies"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => moderate(thread.hidden ? "restore" : "hide")} disabled={busy}>
                    <Shield className="mr-2 h-4 w-4" /> {thread.hidden ? "Restore" : "Hide thread"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={removeThread} disabled={busy} className="text-rose-600 focus:text-rose-600">
                <Trash2 className="mr-2 h-4 w-4" /> Delete thread
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Thread */}
      <article className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {thread.forum && (
            <Link
              href={`/communities/${communityId}`}
              className="inline-flex items-center gap-0.5 font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              <Hash className="h-3 w-3" /> {thread.forum.name}
            </Link>
          )}
          {thread.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-bold text-emerald-600 dark:text-emerald-400">
              <Pin className="h-2.5 w-2.5" /> Pinned
            </span>
          )}
          {thread.locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-bold text-muted-foreground">
              <Lock className="h-2.5 w-2.5" /> Locked
            </span>
          )}
          {thread.hidden && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 font-bold text-rose-600 dark:text-rose-400">
              Hidden
            </span>
          )}
        </div>

        <h1 className="mt-1.5 text-xl font-extrabold leading-tight tracking-tight text-foreground sm:text-2xl">{thread.title}</h1>

        <div className="mt-3 flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={thread.author?.avatar_url || undefined} alt="" />
            <AvatarFallback className="text-[10px]">{initials(thread.author?.display_name || thread.author?.username)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Link
              href={`/profile/${thread.author?.username || thread.author?.id || ""}`}
              className="block truncate text-xs font-semibold text-foreground hover:underline"
            >
              {thread.author?.display_name || thread.author?.username || "Member"}
            </Link>
            <p className="text-[11px] text-muted-foreground">
              {timeAgo(thread.created_at)} · <Eye className="inline h-3 w-3" /> {thread.views}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <div className="flex w-11 shrink-0 flex-col items-center self-start rounded-xl border border-border bg-muted/40 py-1.5">
            <button
              type="button"
              onClick={vote}
              aria-label={viewer.voted ? "Remove upvote" : "Upvote thread"}
              className={cn(
                "rounded-lg p-0.5 transition-colors hover:bg-emerald-500/15",
                viewer.voted ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              <ArrowBigUp className={cn("h-5 w-5", viewer.voted && "fill-current")} />
            </button>
            <span className="text-xs font-bold tabular-nums">{thread.votes}</span>
          </div>

          <div className="min-w-0 flex-1">
            {thread.body && (
              <RichContent text={thread.body} className="text-sm leading-relaxed text-foreground/90" />
            )}
            {thread.media_url && (thread.media_type === "image" || !thread.media_type) && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={thread.media_url} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" />
            )}
            {thread.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {thread.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </article>

      {/* Replies */}
      <section className="mt-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </h2>

        {replies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
            <p className="text-sm font-semibold">No replies yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Be the first to answer — good communities start with one person replying.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {replies.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "rounded-2xl border border-border bg-card p-3 sm:p-4",
                  r.hidden && "border-rose-500/30 bg-rose-500/[0.04]",
                )}
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={r.author?.avatar_url || undefined} alt="" />
                    <AvatarFallback className="text-[9px]">{initials(r.author?.display_name || r.author?.username)}</AvatarFallback>
                  </Avatar>
                  <Link
                    href={`/profile/${r.author?.username || r.author?.id || ""}`}
                    className="truncate text-xs font-semibold text-foreground hover:underline"
                  >
                    {r.author?.display_name || r.author?.username || "Member"}
                  </Link>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                  {r.hidden && (
                    <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">hidden</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTarget({
                        id: r.id,
                        name: r.author?.display_name || r.author?.username || "Member",
                        content: r.content,
                      })
                      inputRef.current?.focus()
                    }}
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <CornerDownRight className="h-3 w-3" /> Reply
                  </button>
                </div>

                {r.parent && (
                  <div className="mt-2 rounded-lg border-l-2 border-primary/50 bg-muted/50 px-2.5 py-1.5">
                    <p className="text-[10px] font-bold text-primary">{r.parent.author_name}</p>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">{r.parent.content}</p>
                  </div>
                )}

                <div className="mt-1.5 pl-9">
                  <RichContent text={r.content} className="text-sm leading-relaxed text-foreground/90" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reply composer */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 px-3 py-2 backdrop-blur-xl sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto max-w-4xl">
          {replyTarget && (
            <div className="mb-1.5 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-1.5">
              <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-bold text-primary">Replying to {replyTarget.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{replyTarget.content}</p>
              </div>
              <button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply" className="rounded-md p-1 hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {thread.locked ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> This thread is locked — new replies are closed.
            </div>
          ) : viewer.is_member ? (
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void send()
                  }
                }}
                placeholder={replyTarget ? `Reply to ${replyTarget.name}…` : "Write a reply…"}
                rows={2}
                className="min-h-11 flex-1 resize-none rounded-xl"
              />
              <Button onClick={send} disabled={sending || !replyText.trim()} className="h-11 rounded-xl px-4">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Join this community to reply.</p>
              <Button size="sm" className="rounded-full" onClick={() => router.push(`/auth?returnTo=/communities/${communityId}`)}>
                Join in
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
