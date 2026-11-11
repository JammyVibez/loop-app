"use client"

import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react"
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
import { RoleChip, type RoleBadgeLike } from "@/components/communities/forum/role-chip"
import { MiniProfile } from "@/components/communities/forum/mini-profile"
import { QuotedLoopCard } from "@/components/loops/quoted-loop-card"
import { GiftButton } from "@/components/gifting/gift-button"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { cn } from "@/lib/utils"
import {
  ArrowBigUp,
  ArrowLeft,
  CornerDownRight,
  Eye,
  Hash,
  ImagePlus,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Pin,
  Send,
  Share2,
  Shield,
  SmilePlus,
  Trash2,
  Unlock,
  X,
} from "@/components/icons/lucide-compat"

type Author = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_verified?: boolean
  role_badge?: RoleBadgeLike | null
}

type CommentReaction = {
  emoji: string
  count: number
  users: string[]
  reacted: boolean
}

type Reply = {
  id: string
  content: string
  media_url: string | null
  media_type: string | null
  created_at: string
  hidden: boolean
  reactions?: CommentReaction[]
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
    poll: {
      id: string | number
      question: string
      options: Array<{ id: string; text: string; votes: number }>
      total_votes: number
      expires_at?: string | null
    } | null
    /** A Loop shared into the community — rendered live from its own row. */
    shared_loop_id?: string | null
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

/** Hover timestamp — Discord's absolute time once a message leaves "now". */
function clockTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** The quick-reaction shelf shown on hover / long press. */
const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "🎉", "😮", "🙏"]

/** One local toggle, so a reaction feels instant before the server answers. */
function applyReaction(list: CommentReaction[], emoji: string, userId: string): CommentReaction[] {
  const next = list.map((r) => ({ ...r, users: [...r.users] }))
  const existing = next.find((r) => r.emoji === emoji)
  if (!existing) {
    return [...next, { emoji, count: 1, users: [userId], reacted: true }]
  }
  const has = existing.users.includes(userId)
  existing.users = has ? existing.users.filter((u) => u !== userId) : [...existing.users, userId]
  existing.count = existing.users.length
  existing.reacted = !has
  return existing.count > 0 ? next : next.filter((r) => r.emoji !== emoji)
}

/* ─────────────────── One message in the reply list ───────────────────
 * Borderless Discord-style row: avatar + name + role chip + time on the first
 * line, message underneath, reaction pills below that. Consecutive messages
 * from the same person collapse into a compact row whose left gutter shows the
 * time on hover. Swiping a row right (or hitting reply) targets it.
 */
function MessageRow({
  reply,
  compact,
  last,
  canInteract,
  communityId,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onJump,
}: {
  reply: Reply
  compact: boolean
  last: boolean
  canInteract: boolean
  communityId: string
  onReply: (reply: Reply) => void
  onReact: (reply: Reply, emoji: string) => void
  onEdit: (reply: Reply, content: string) => Promise<void>
  onDelete: (reply: Reply) => void
  onJump: (parentId: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(reply.content)
  const [savingEdit, setSavingEdit] = useState(false)
  const touch = useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(null)
  const dragRef = useRef(0)

  const name = reply.author?.display_name || reply.author?.username || "Member"
  const reactions = reply.reactions || []

  const onTouchStart = (e: ReactTouchEvent) => {
    if (!canInteract) return
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY, axis: null }
  }
  const onTouchMove = (e: ReactTouchEvent) => {
    const s = touch.current
    if (!s || !canInteract) return
    const t = e.touches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (!s.axis) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
    }
    if (s.axis !== "x") return
    const clamped = Math.max(0, Math.min(96, dx))
    dragRef.current = clamped
    setDragX(clamped)
  }
  const onTouchEnd = () => {
    if (dragRef.current > 56) onReply(reply)
    dragRef.current = 0
    setDragX(0)
    touch.current = null
  }

  return (
    <li id={`reply-${reply.id}`} className="group relative scroll-mt-24">
      {/* Swipe affordance — fades in as the row is pulled toward a reply */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-primary/15 text-primary transition-opacity",
          dragX > 6 ? "opacity-100" : "opacity-0",
        )}
      >
        <CornerDownRight className="h-4 w-4" />
      </span>

      <div
        className={cn(
          "relative rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40",
          compact && "py-0.5",
          !last && "pb-1.5",
          reply.hidden && "bg-rose-500/[0.05] hover:bg-rose-500/[0.08]",
        )}
        style={{
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transitionDuration: dragX ? "0ms" : "140ms",
          transitionProperty: "transform, background-color",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {/* Reply preview — Discord's inline quote, not a nested card */}
        {reply.parent && (
          /* Tapping the quote takes you to the message it answers. */
          <button
            type="button"
            onClick={() => onJump(String(reply.parent!.id))}
            className="mb-1 flex w-full items-center gap-1.5 rounded pl-11 pr-2 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <CornerDownRight className="h-3 w-3 shrink-0" />
            <span className="shrink-0 font-semibold text-foreground/80">{reply.parent.author_name}</span>
            <span className="truncate opacity-80">{reply.parent.content}</span>
          </button>
        )}

        <div className="flex gap-2.5">
          {compact ? (
            <div className="flex w-9 shrink-0 justify-center pt-1">
              <span className="hidden text-[9px] leading-none text-muted-foreground group-hover:inline">
                {new Date(reply.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          ) : (
            <Avatar className="mt-0.5 h-9 w-9 shrink-0">
              <AvatarImage src={reply.author?.avatar_url || undefined} alt="" />
              <AvatarFallback className="text-[10px]">{initials(reply.author?.display_name || reply.author?.username)}</AvatarFallback>
            </Avatar>
          )}

          <div className="min-w-0 flex-1">
            {!compact && (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                {/* Tapping the name opens their community card, not the full
                    profile — the card carries the link through. */}
                {reply.author?.id ? (
                  <MiniProfile communityId={communityId} userId={reply.author.id} name={name} />
                ) : (
                  <span className="truncate text-[13px] font-semibold text-foreground">{name}</span>
                )}
                {reply.author?.role_badge && <RoleChip badge={reply.author.role_badge} />}
                <span className="text-[10px] text-muted-foreground" title={clockTime(reply.created_at)}>
                  {timeAgo(reply.created_at)}
                </span>
                {reply.hidden && (
                  <span className="rounded-full bg-rose-500/10 px-1.5 py-px text-[9px] font-bold text-rose-500">hidden</span>
                )}
              </div>
            )}

            <div className={cn("text-sm leading-relaxed text-foreground/90", compact && "mt-0")}>
              {editing ? (
                <div className="mt-1 space-y-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    maxLength={4000}
                    className="resize-none rounded-xl text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 rounded-full px-3 text-xs"
                      disabled={savingEdit || !draft.trim()}
                      onClick={async () => {
                        setSavingEdit(true)
                        try {
                          await onEdit(reply, draft.trim())
                          setEditing(false)
                        } catch {
                          /* the parent already surfaced the reason */
                        } finally {
                          setSavingEdit(false)
                        }
                      }}
                    >
                      {savingEdit && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-full px-3 text-xs"
                      onClick={() => {
                        setDraft(reply.content)
                        setEditing(false)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <RichContent text={reply.content} />
              )}
            </div>

            {reply.media_url && (reply.media_type === "image" || !reply.media_type) && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={reply.media_url} alt="" className="mt-1.5 max-h-72 w-full rounded-lg object-cover" />
            )}
            {reply.media_url && reply.media_type === "video" && (
              <video
                src={reply.media_url}
                controls
                playsInline
                className="mt-1.5 max-h-72 w-full rounded-lg bg-black object-contain"
              />
            )}

            {reactions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {reactions.map((rx) => (
                  <button
                    key={rx.emoji}
                    type="button"
                    disabled={!canInteract}
                    aria-label={`${rx.emoji} · ${rx.count}`}
                    onClick={() => onReact(reply, rx.emoji)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs transition-colors",
                      rx.reacted
                        ? "bg-primary/15 text-primary ring-1 ring-primary/50"
                        : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <span className="leading-none">{rx.emoji}</span>
                    <span className="text-[11px] font-bold tabular-nums leading-none">{rx.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action bar — appears on hover (desktop) / always on touch */}
        {canInteract && (
          <div className="absolute -top-3 right-1 flex items-center gap-0.5 rounded-full border border-border bg-card px-0.5 py-0.5 shadow-sm opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <button
              type="button"
              aria-label="Add reaction"
              onClick={() => setPickerOpen((v) => !v)}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>
            {reply.is_author && !editing && (
              <button
                type="button"
                aria-label="Edit your reply"
                onClick={() => {
                  setDraft(reply.content)
                  setEditing(true)
                }}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {reply.is_author && (
              <button
                type="button"
                aria-label="Delete your reply"
                onClick={() => onDelete(reply)}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              aria-label={`Reply to ${name}`}
              onClick={() => onReply(reply)}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CornerDownRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {pickerOpen && canInteract && (
          <div className="absolute -top-9 right-1 z-10 flex items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-1 shadow-lg">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React with ${emoji}`}
                onClick={() => {
                  onReact(reply, emoji)
                  setPickerOpen(false)
                }}
                className="rounded-full px-1 text-base leading-none transition-transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              aria-label="Close"
              onClick={() => setPickerOpen(false)}
              className="ml-0.5 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </li>
  )
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
  const [replyMedia, setReplyMedia] = useState<{ url: string; type: string } | null>(null)
  const [uploadingReplyMedia, setUploadingReplyMedia] = useState(false)
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

  const attachReplyMedia = async (file?: File | null) => {
    if (!file) return
    setUploadingReplyMedia(true)
    try {
      const isVideo = file.type.startsWith("video/")
      const { url } = await uploadMediaFile(file, {
        type: isVideo ? "video" : "image",
        folder: "community-replies",
        authHeaders: getAuthHeader(),
      })
      setReplyMedia({ url, type: isVideo ? "video" : "image" })
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" })
    } finally {
      setUploadingReplyMedia(false)
    }
  }

  const send = async () => {
    const content = replyText.trim()
    if ((!content && !replyMedia) || sending || !data) return
    if (!user) {
      router.push(`/auth?returnTo=/communities/${communityId}/posts/${threadId}`)
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          content,
          parent_comment_id: replyTarget?.id || null,
          media_url: replyMedia?.url || null,
          media_type: replyMedia?.type || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to reply")
      setReplyText("")
      setReplyTarget(null)
      setReplyMedia(null)
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

  const react = async (r: Reply, emoji: string) => {
    if (!user) {
      router.push(`/auth?returnTo=/communities/${communityId}/posts/${threadId}`)
      return
    }
    if (!data) return
    const optimistic = applyReaction(r.reactions || [], emoji, user.id)
    setData((prev) =>
      prev ? { ...prev, replies: prev.replies.map((x) => (x.id === r.id ? { ...x, reactions: optimistic } : x)) } : prev,
    )
    try {
      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ comment_id: r.id, emoji }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Reaction failed")
      setData((prev) =>
        prev
          ? { ...prev, replies: prev.replies.map((x) => (x.id === r.id ? { ...x, reactions: json.reactions } : x)) }
          : prev,
      )
    } catch (e: any) {
      toast({ title: "Couldn't save that reaction", description: e.message, variant: "destructive" })
      void load({ silent: true })
    }
  }

  const [votedOption, setVotedOption] = useState<string | null>(null)

  const votePoll = async (optionId: string) => {
    const poll = data?.thread.poll
    if (!poll || votedOption) return
    if (!user) {
      router.push(`/auth?returnTo=/communities/${communityId}/posts/${threadId}`)
      return
    }
    setData((prev) =>
      prev
        ? {
            ...prev,
            thread: {
              ...prev.thread,
              poll: {
                ...poll,
                options: poll.options.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)),
                total_votes: (poll.total_votes || 0) + 1,
              },
            },
          }
        : prev,
    )
    setVotedOption(optionId)
    try {
      const res = await fetch(`/api/circles/${communityId}/posts/${threadId}/poll/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ optionId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not vote")
    } catch (e: any) {
      setVotedOption(null)
      setData((prev) => (prev ? { ...prev, thread: { ...prev.thread, poll } } : prev))
      toast({ title: "Couldn't vote", description: e.message, variant: "destructive" })
    }
  }

  const editReply = async (r: Reply, content: string) => {
    try {
      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}/comments/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ content }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not save that edit")
      setData((prev) =>
        prev ? { ...prev, replies: prev.replies.map((x) => (x.id === r.id ? { ...x, content } : x)) } : prev,
      )
      toast({ title: "Reply updated" })
    } catch (e: any) {
      toast({ title: "Could not save that edit", description: e.message, variant: "destructive" })
      throw e
    }
  }

  const deleteReply = async (r: Reply) => {
    try {
      const res = await fetch(`/api/communities/${communityId}/threads/${threadId}/comments/${r.id}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not delete that reply")
      setData((prev) =>
        prev ? { ...prev, replies: prev.replies.filter((x) => x.id !== r.id) } : prev,
      )
      toast({ title: "Reply deleted" })
    } catch (e: any) {
      toast({ title: "Could not delete that reply", description: e.message, variant: "destructive" })
    }
  }

  /** Tapping a quoted reply scrolls to the message it answers. */
  const jumpToParent = (parentId: string) => {
    const el = document.getElementById(`reply-${parentId}`)
    if (!el) {
      toast({
        title: "That message has moved on",
        description: "It may have been deleted, or it is further up the thread.",
      })
      return
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("ring-1", "ring-primary/50", "bg-primary/5")
    window.setTimeout(() => el.classList.remove("ring-1", "ring-primary/50", "bg-primary/5"), 1500)
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
            <span className="flex min-w-0 items-center gap-1.5">
              <Link
                href={`/profile/${thread.author?.username || thread.author?.id || ""}`}
                className="truncate text-xs font-semibold text-foreground hover:underline"
              >
                {thread.author?.display_name || thread.author?.username || "Member"}
              </Link>
              {thread.author?.role_badge && <RoleChip badge={thread.author.role_badge} />}
            </span>
            <p className="text-[11px] text-muted-foreground">
              {timeAgo(thread.created_at)} · <Eye className="inline h-3 w-3" /> {thread.views}
            </p>
          </div>
          {/* Community posts are giftable without leaving the thread. */}
          <GiftButton
            recipients={[thread.author]}
            context={{ type: "post", id: String(threadId), title: thread.title, circle_id: String(communityId) }}
            className="ml-auto shrink-0 text-muted-foreground hover:text-pink-500"
            title="Send the author a gift"
          />
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
            {thread.media_url && thread.media_type === "video" && (
              <video
                src={thread.media_url}
                controls
                playsInline
                className="mt-3 max-h-96 w-full rounded-xl bg-black object-contain"
              />
            )}

            {thread.poll && (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {thread.poll.question}
                </p>
                <div className="mt-3 space-y-2">
                  {thread.poll.options.map((option) => {
                    const total = thread.poll!.total_votes || 0
                    const pct = total ? Math.round((option.votes / total) * 100) : 0
                    const picked = votedOption === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={Boolean(votedOption)}
                        onClick={() => void votePoll(String(option.id))}
                        className={`relative block w-full overflow-hidden rounded-xl border px-3 py-2 text-left transition-colors ${
                          picked ? "border-primary" : "border-border hover:border-primary/50"
                        } ${votedOption ? "cursor-default" : "cursor-pointer"}`}
                      >
                        <span
                          className="absolute inset-y-0 left-0 bg-primary/15"
                          style={{ width: votedOption ? `${pct}%` : "0%" }}
                        />
                        <span className="relative flex items-center justify-between gap-3 text-sm font-semibold">
                          <span className="truncate">{option.text}</span>
                          {votedOption && (
                            <span className="shrink-0 tabular-nums text-muted-foreground">{pct}%</span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {votedOption ? "Your vote is in." : "Pick one — you can vote once."}{' '}
                  {thread.poll.total_votes || 0} vote{(thread.poll.total_votes || 0) === 1 ? "" : "s"}
                </p>
              </div>
            )}
            {thread.shared_loop_id && (
              <div className="mt-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Share2 className="h-3 w-3" aria-hidden /> Shared from the Loop feed
                </p>
                <QuotedLoopCard loopId={thread.shared_loop_id} className="mt-0" />
              </div>
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

      {/* Replies — a plain message list: no cards, no borders, hover group */}
      <section className="mt-5">
        <h2 className="mb-1 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </h2>

        {replies.length === 0 ? (
          <div className="px-2 py-10 text-center">
            <p className="text-sm font-semibold">No replies yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Be the first to answer — good communities start with one person replying.
            </p>
          </div>
        ) : (
          <ul className="min-w-0">
            {replies.map((r, i) => {
              const prev = replies[i - 1]
              const next = replies[i + 1]
              const sameAuthor = (a?: Reply | null, b?: Reply | null) =>
                Boolean(a?.author?.id && b?.author?.id && a.author.id === b.author.id)
              // Discord's rule: same author, no reply-break, consecutive.
              const compact =
                !r.parent && sameAuthor(prev, r) && !prev?.parent &&
                new Date(r.created_at).getTime() - new Date(prev!.created_at).getTime() < 7 * 60_000
              const lastOfGroup = !sameAuthor(r, next) || Boolean(next?.parent)
              return (
                <MessageRow
                  key={r.id}
                  reply={r}
                  compact={compact}
                  last={lastOfGroup}
                  canInteract={Boolean(viewer.is_member && !thread.locked)}
                  communityId={communityId}
                  onReply={(target) => {
                    setReplyTarget({
                      id: target.id,
                      name: target.author?.display_name || target.author?.username || "Member",
                      content: target.content,
                    })
                    inputRef.current?.focus()
                  }}
                  onReact={react}
                  onEdit={editReply}
                  onDelete={(target) => void deleteReply(target)}
                  onJump={jumpToParent}
                />
              )
            })}
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
          {replyMedia && (
            <div className="mb-1.5 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-2 py-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={replyMedia.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
              <span className="flex-1 text-[11px] text-muted-foreground">Attached — it sends with your reply.</span>
              <button
                type="button"
                onClick={() => setReplyMedia(null)}
                aria-label="Remove attachment"
                className="rounded-md p-1 hover:bg-muted"
              >
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
              <label
                aria-label="Attach an image or video"
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {uploadingReplyMedia ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    void attachReplyMedia(e.target.files?.[0])
                    e.currentTarget.value = ""
                  }}
                />
              </label>
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
              <Button onClick={send} disabled={sending || (!replyText.trim() && !replyMedia)} className="h-11 rounded-xl px-4">
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
