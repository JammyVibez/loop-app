"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Button } from "@/components/ui/button"
import { Eye, Loader2, MessageCircle, Pencil, Send, Trash2, Zap } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

export interface MomentCardMoment {
  id: string
  user_id: string
  media_url?: string | null
  media_type?: string | null
  content?: string | null
  created_at?: string | null
  expires_at?: string | null
  view_count?: number | null
  comment_count?: number | null
}

export interface MomentCardAuthor {
  id?: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  is_verified?: boolean | null
  is_premium?: boolean | null
}

interface MomentComment {
  id: string
  moment_id: string
  user_id: string
  content: string
  parent_comment_id: string | null
  created_at: string
  author?: MomentCardAuthor | null
}

interface MomentCardProps {
  moment: MomentCardMoment
  author?: MomentCardAuthor | null
  isMine?: boolean
  /** Total lifetime in hours (24 or 48). Defaults to 24. */
  durationHours?: number
  onEdit?: (content: string) => void
  onDelete?: () => void
  className?: string
}

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "Expired"
  const totalMinutes = Math.max(1, Math.floor(msLeft / 60000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|$)/i.test(url)
}

/**
 * MomentCard — the ephemeral story-style card for 24–48h Moments.
 *
 * Deliberately NOT a Loop card: dashed "fading" borders, a ticking countdown
 * with a shrinking life bar, and an amber/rose "now-or-never" palette so a
 * moment reads as temporary at a glance.
 */
export function MomentCard({
  moment,
  author,
  isMine = false,
  durationHours = 24,
  onEdit,
  onDelete,
  className,
}: MomentCardProps) {
  const { user, getAuthHeader } = useAuth()
  const [now, setNow] = useState(() => Date.now())
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<MomentComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [replyTo, setReplyTo] = useState<MomentComment | null>(null)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/moments/${moment.id}/comments`, {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments || [])
      }
    } catch {
      /* ignore */
    } finally {
      setCommentsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment.id])

  const toggleComments = useCallback(() => {
    const next = !commentsOpen
    setCommentsOpen(next)
    if (next && comments.length === 0) void fetchComments()
  }, [commentsOpen, comments.length, fetchComments])

  const postComment = useCallback(
    async (content: string, parentId?: string) => {
      if (!user) {
        window.location.href = "/login"
        return
      }
      setPosting(true)
      try {
        const res = await fetch(`/api/moments/${moment.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ content, parent_comment_id: parentId || null }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Failed to comment")
        }
        const data = await res.json()
        setComments((prev) => [...prev, data.comment])
        setCommentText("")
        setReplyTo(null)
      } catch (error: any) {
        console.error("Comment failed:", error)
      } finally {
        setPosting(false)
      }
    },
    [user, moment.id, getAuthHeader],
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      try {
        await fetch(`/api/moments/${moment.id}/comments?comment_id=${commentId}`, {
          method: "DELETE",
          headers: { ...getAuthHeader() },
        })
        setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId))
      } catch {
        /* ignore */
      }
    },
    [moment.id, getAuthHeader],
  )

  const expiresAt = useMemo(() => (moment.expires_at ? new Date(moment.expires_at).getTime() : null), [moment.expires_at])
  const createdAt = useMemo(
    () => (moment.created_at ? new Date(moment.created_at).getTime() : null),
    [moment.created_at],
  )
  const lifeMs = durationHours * 60 * 60 * 1000
  const elapsedMs = createdAt ? Math.max(0, now - createdAt) : 0
  const remainingMs = expiresAt ? Math.max(0, expiresAt - now) : Math.max(0, lifeMs - elapsedMs)
  const lifeLeft = lifeMs > 0 ? Math.max(0, Math.min(1, remainingMs / lifeMs)) : 0
  const expired = remainingMs <= 0

  const displayName = author?.display_name || author?.username || "User"
  const mediaUrl = moment.media_url || ""
  const isVideo = isVideoUrl(mediaUrl) || moment.media_type === "video"
  const viewCount = Number(moment.view_count || 0)
  const commentCount = Number(moment.comment_count || comments.length || 0)
  const rootComments = comments.filter((c) => !c.parent_comment_id)
  const repliesOf = (parentId: string) => comments.filter((c) => c.parent_comment_id === parentId)

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-3xl border border-dashed border-amber-500/30 bg-card/60 shadow-[0_8px_30px_rgba(251,191,36,0.06)]",
        "transition-all duration-300 hover:border-amber-500/50 hover:shadow-[0_8px_36px_rgba(251,191,36,0.12)]",
        expired && "opacity-60",
        className,
      )}
    >
      {/* Fading corner accent — the "disappearing" motif */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

      {/* Header */}
      <header className="flex items-center gap-2.5 px-3.5 py-3">
        <span className="rounded-full bg-primary p-[2px]">
          <span className="block rounded-full bg-background p-[2px]">
            <VideoAvatar src={author?.avatar_url || undefined} className="h-9 w-9" fallback={displayName.charAt(0).toUpperCase()} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold leading-tight">
            <span className="truncate">{displayName}</span>
            {author?.is_verified && (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-400 text-[10px] font-bold text-white">
                ✓
              </span>
            )}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Zap className="h-3 w-3 text-amber-500" />
            Moment · {formatCountdown(remainingMs)} left
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 rounded-full border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400",
            expired && "border-red-500/40 text-red-500",
          )}
        >
          {expired ? "Expired" : `${durationHours}h`}
        </Badge>
      </header>

      {/* Life bar — shrinks in real time */}
      <div className="h-1 w-full bg-muted">
        <div
          className={cn(
            "h-full transition-[width] duration-1000 ease-linear",
            expired
              ? "bg-red-500"
              : lifeLeft < 0.25
                ? "bg-gradient-to-r from-rose-500 to-red-500"
                : "bg-primary",
          )}
          style={{ width: `${Math.max(0, lifeLeft * 100)}%` }}
        />
      </div>

      {/* Media */}
      {mediaUrl && (
        <div className="relative mx-3.5 mt-3.5 overflow-hidden rounded-2xl border border-amber-500/20 bg-black">
          {isVideo ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={mediaUrl}
              className="max-h-[55vh] w-full object-contain"
              controls
              autoPlay
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt="Moment"
              className="max-h-[55vh] w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          )}
          <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-amber-300 backdrop-blur">
            <Zap className="h-3 w-3" />
            Disappears soon
          </span>
        </div>
      )}

      {/* Content */}
      {moment.content && (
        <div className="px-4 py-3">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{moment.content}</p>
        </div>
      )}

      {/* Footer — stats + countdown */}
      <footer className="flex items-center justify-between gap-2 border-t border-dashed border-border/70 bg-muted/30 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {viewCount.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={toggleComments}
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-amber-500/10 hover:text-amber-400"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {commentCount.toLocaleString()}
          </button>
          <span className="hidden items-center gap-1 sm:inline-flex">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            {expired ? "Vanished" : formatCountdown(remainingMs) + " left"}
          </span>
        </div>
        {isMine && (
          <div className="flex shrink-0 gap-1.5">
            {onEdit && (
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onEdit(moment.content || "")}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs" onClick={onDelete}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </footer>

      {/* Thread comments — replies nest under their parent */}
      {commentsOpen && (
        <div className="border-t border-dashed border-border/70 bg-background/40 px-3.5 py-3">
          {commentsLoading ? (
            <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading comments…
            </p>
          ) : rootComments.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No comments yet — be the first.</p>
          ) : (
            <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
              {rootComments.map((comment) => {
                const replies = repliesOf(comment.id)
                return (
                  <div key={comment.id} className="space-y-2">
                    <CommentRow
                      comment={comment}
                      canDelete={
                        Boolean(user && (comment.user_id === user.id || comment.author?.id === user.id))
                      }
                      onReply={() => setReplyTo(replyTo?.id === comment.id ? null : comment)}
                      onDelete={() => void deleteComment(comment.id)}
                    />
                    {replies.map((reply) => (
                      <div key={reply.id} className="ml-6">
                        <CommentRow
                          comment={reply}
                          canDelete={
                            Boolean(user && (reply.user_id === user.id || reply.author?.id === user.id))
                          }
                          onReply={() => setReplyTo(replyTo?.id === reply.id ? null : reply)}
                          onDelete={() => void deleteComment(reply.id)}
                        />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* Reply composer */}
          <div className="mt-3">
            {replyTo && (
              <div className="mb-1.5 flex items-center justify-between rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs">
                <span className="truncate text-amber-600 dark:text-amber-400">
                  Replying to {replyTo.author?.display_name || replyTo.author?.username || "someone"}
                </span>
                <button type="button" onClick={() => setReplyTo(null)} className="ml-2 text-muted-foreground hover:text-foreground">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    if (commentText.trim()) void postComment(commentText.trim(), replyTo?.id)
                  }
                }}
                placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
                className="h-9 w-full rounded-full border border-border/70 bg-card/60 px-3.5 text-sm outline-none placeholder:text-muted-foreground focus:border-amber-500/60"
                maxLength={500}
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-white hover:opacity-90"
                onClick={() => {
                  if (commentText.trim()) void postComment(commentText.trim(), replyTo?.id)
                }}
                disabled={posting || !commentText.trim()}
              >
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

function CommentRow({
  comment,
  canDelete,
  onReply,
  onDelete,
}: {
  comment: MomentComment
  canDelete: boolean
  onReply: () => void
  onDelete: () => void
}) {
  const name = comment.author?.display_name || comment.author?.username || "User"
  return (
    <div className="flex items-start gap-2">
      <VideoAvatar src={comment.author?.avatar_url || undefined} className="h-6 w-6 shrink-0" fallback={name.charAt(0).toUpperCase()} />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-muted/60 px-3 py-1.5">
        <p className="flex items-center gap-1 text-xs font-semibold leading-tight">
          <span className="truncate">{name}</span>
          {comment.author?.is_verified && (
            <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-sky-400 text-[8px] font-bold text-white">
              ✓
            </span>
          )}
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-foreground">{comment.content}</p>
        <div className="mt-1 flex items-center gap-2">
          <button type="button" onClick={onReply} className="text-[10px] font-medium text-muted-foreground hover:text-amber-400">
            Reply
          </button>
          {canDelete && (
            <button type="button" onClick={onDelete} className="text-[10px] font-medium text-muted-foreground hover:text-red-500">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Small inline loading/empty states used around moments. */
export function MomentLoading() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading moment…
    </div>
  )
}

export function MomentGone() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <span className="text-4xl">⏳</span>
      <h1 className="text-lg font-bold">Moment gone</h1>
      <p className="text-sm text-muted-foreground">This moment expired or was deleted. That&apos;s the point — moments are ephemeral.</p>
    </div>
  )
}
