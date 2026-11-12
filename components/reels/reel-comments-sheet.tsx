"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Heart, Loader2, MessageCircle, Send, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RichContent } from "@/components/content/rich-content"
import { CommentMediaPicker } from "@/components/comments/comment-media-picker"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Comment = {
  id: string
  content: string
  created_at?: string
  like_count?: number
  is_liked?: boolean
  parent_comment_id?: string | null
  replies?: Comment[]
  author?: { id?: string; username?: string; display_name?: string; avatar_url?: string }
}

type DraftMedia = { url: string; kind: "GIF" | "Sticker" }

interface ReelCommentsSheetProps {
  reelId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCountChange?: (delta: number) => void
}

function relativeTime(iso?: string) {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)}d`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function mediaToken(media: DraftMedia | null) {
  return media ? ` ![${media.kind}](${media.url}) ` : ""
}

function totalComments(items: Comment[]): number {
  return items.reduce((sum, item) => sum + 1 + (item.replies?.length || 0), 0)
}

function updateComment(items: Comment[], id: string, updater: (comment: Comment) => Comment): Comment[] {
  return items.map((item) => {
    if (item.id === id) return updater(item)
    if (item.replies?.length) {
      return { ...item, replies: updateComment(item.replies, id, updater) }
    }
    return item
  })
}

function removeComment(items: Comment[], id: string): Comment[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => (item.replies?.length ? { ...item, replies: removeComment(item.replies, id) } : item))
}

/**
 * TikTok-style comments drawer for reels.
 *
 * Comments, replies and rich media all travel through the same content string
 * (`![GIF](...)` / `![Sticker](...)`) so GIFs and stickers are real inline
 * media, not links.
 */
export function ReelCommentsSheet({ reelId, open, onOpenChange, onCountChange }: ReelCommentsSheetProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState("")
  const [draftMedia, setDraftMedia] = useState<DraftMedia | null>(null)
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [burstId, setBurstId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !reelId) return
    let cancelled = false
    setLoading(true)
    setReplyTo(null)
    setDraft("")
    setDraftMedia(null)
    setExpanded(new Set())
    fetch(`/api/reels/${reelId}/comments?limit=60`, { headers: { ...getAuthHeader() } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return
        const roots = (json?.comments || json?.data?.comments || []) as Comment[]
        setComments(
          roots.map((comment) => ({
            ...comment,
            like_count: Number(comment.like_count || 0),
            replies: Array.isArray(comment.replies) ? comment.replies : [],
          })),
        )
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, reelId, getAuthHeader])

  const patch = useCallback((id: string, updater: (comment: Comment) => Comment) => {
    setComments((current) => updateComment(current, id, updater))
  }, [])

  const toggleLike = async (comment: Comment) => {
    if (!user) {
      toast({ title: "Sign in to like comments" })
      return
    }
    const liked = !comment.is_liked
    patch(comment.id, (item) => ({
      ...item,
      is_liked: liked,
      like_count: Math.max(0, Number(item.like_count || 0) + (liked ? 1 : -1)),
    }))
    if (liked) {
      setBurstId(comment.id)
      window.setTimeout(() => setBurstId((current) => (current === comment.id ? null : current)), 700)
    }
    await fetch(`/api/reels/${reelId}/comments/${comment.id}/like`, {
      method: "POST",
      headers: { ...getAuthHeader() },
    }).catch(() => undefined)
  }

  const submit = async () => {
    const text = draft.trim()
    if (!reelId || (!text && !draftMedia) || sending) return
    if (!user) {
      toast({ title: "Sign in to comment" })
      return
    }
    setSending(true)
    const content = `${text}${mediaToken(draftMedia)}`.trim()
    const localId = `local-${Date.now()}`
    const optimistic: Comment = {
      id: localId,
      content,
      created_at: new Date().toISOString(),
      like_count: 0,
      is_liked: false,
      author: {
        id: user.id,
        username: (user as any).username,
        display_name: (user as any).display_name,
        avatar_url: (user as any).avatar_url,
      },
      replies: [],
    }

    if (replyTo) {
      const parentId = replyTo.id
      setComments((current) =>
        updateComment(current, parentId, (item) => ({ ...item, replies: [...(item.replies || []), optimistic] })),
      )
      setExpanded((current) => new Set(current).add(parentId))
    } else {
      setComments((current) => [...current, optimistic])
    }
    setDraft("")
    setDraftMedia(null)
    setReplyTo(null)
    onCountChange?.(1)

    try {
      const res = await fetch(`/api/reels/${reelId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ content, parent_comment_id: replyTo?.id || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not post comment")
      if (json.comment) {
        patch(localId, () => ({ ...json.comment, replies: json.comment.replies || [] }))
      }
    } catch (err: any) {
      setComments((current) => removeComment(current, localId))
      onCountChange?.(-1)
      toast({ title: "Comment failed", description: err.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const insert = (emoji: string) => setDraft((value) => value + emoji)

  const composer = (
    <div className="border-t border-white/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      {replyTo && (
        <div className="mb-1.5 flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-white/55">
          <span className="truncate">Replying to @{replyTo.author?.username || "user"}</span>
          <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {draftMedia && (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draftMedia.url} alt={draftMedia.kind} className="h-10 w-10 rounded-md object-contain" />
          <span className="flex-1 text-[11px] text-white/60">{draftMedia.kind} ready to send</span>
          <button type="button" onClick={() => setDraftMedia(null)} aria-label="Remove media">
            <X className="h-3.5 w-3.5 text-white/60" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <CommentMediaPicker
          onSelectEmoji={insert}
          onSelectGif={(url) => setDraftMedia({ url, kind: "GIF" })}
          onSelectSticker={(url) => setDraftMedia({ url, kind: "Sticker" })}
          triggerClassName="text-white/60 hover:bg-white/10 hover:text-white"
        />
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
          placeholder={replyTo ? `Reply to @${replyTo.author?.username || "user"}…` : user ? "Add a comment…" : "Sign in to comment"}
          disabled={!user}
          maxLength={1000}
          className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={(!draft.trim() && !draftMedia) || sending || !user}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition disabled:opacity-30"
          aria-label="Post comment"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )

  const renderComment = (comment: Comment, depth = 0): ReactNode => {
    const replies = comment.replies || []
    const isExpanded = expanded.has(comment.id)
    return (
      <div key={comment.id} className="group/comment">
        <div className="flex gap-2.5">
          <Link href={comment.author?.username ? `/profile/${comment.author.username}` : "#"} className="shrink-0">
            <Avatar className={cn("border border-white/10", depth ? "h-7 w-7" : "h-9 w-9")}>
              <AvatarImage src={comment.author?.avatar_url} />
              <AvatarFallback className="text-xs">{(comment.author?.display_name || "U").charAt(0)}</AvatarFallback>
            </Avatar>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[12px] font-semibold text-white/70">
                @{comment.author?.username || "user"}
              </span>
              <span className="shrink-0 text-[10px] text-white/35">{relativeTime(comment.created_at)}</span>
            </div>

            <div
              onDoubleClick={() => {
                if (!comment.is_liked) void toggleLike(comment)
              }}
              className="mt-0.5 cursor-default select-none"
            >
              {comment.content ? (
                <RichContent text={comment.content} className="text-[13.5px] leading-relaxed text-white/90" />
              ) : null}
            </div>

            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setReplyTo(comment)
                  inputRef.current?.focus()
                }}
                className="text-[11px] font-medium text-white/40 transition-colors hover:text-white/75"
              >
                Reply
              </button>
              {depth === 0 && replies.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current)
                      if (next.has(comment.id)) next.delete(comment.id)
                      else next.add(comment.id)
                      return next
                    })
                  }
                  className="text-[11px] font-semibold text-white/45 transition-colors hover:text-white/80"
                >
                  {isExpanded ? "Hide replies" : `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
                </button>
              )}
            </div>
          </div>

          <div className="relative flex shrink-0 flex-col items-center gap-0.5 pt-1">
            <button
              type="button"
              onClick={() => void toggleLike(comment)}
              aria-pressed={Boolean(comment.is_liked)}
              aria-label="Like comment"
              className={cn("text-white/35 transition-colors", comment.is_liked && "text-rose-500")}
            >
              <Heart className={cn("h-4 w-4", comment.is_liked && "fill-current")} />
            </button>
            <span className="text-[10px] tabular-nums text-white/35">{comment.like_count || 0}</span>

            <AnimatePresence>
              {burstId === comment.id && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.4, y: 0 }}
                  animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.5, 1.2, 1.4], y: [-4, -18, -26] }}
                  transition={{ duration: 0.65 }}
                  className="pointer-events-none absolute right-0 top-0 text-rose-500"
                >
                  <Heart className="h-5 w-5 fill-current" />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {depth === 0 && replies.length > 0 && isExpanded && (
          <div className="ml-6 mt-3 space-y-3 border-l border-white/10 pl-3">
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close comments"
        className="absolute inset-0 bg-black/45"
        onClick={() => onOpenChange(false)}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 36 }}
        className="absolute inset-x-0 bottom-0 mx-auto flex h-[78dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0d0d11] text-white shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="flex flex-col items-center pb-1 pt-2">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between border-b border-white/10 px-4 pb-2.5">
          <h2 className="text-sm font-semibold">
            {totalComments(comments) ? `${totalComments(comments)} comments` : "Comments"}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close comments"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-3">
          {loading && comments.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-white/40" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                <MessageCircle className="h-6 w-6 text-white/30" />
              </span>
              <p className="text-sm font-semibold text-white/80">No comments yet</p>
              <p className="max-w-[15rem] text-xs text-white/45">
                Say something nice — or drop a GIF. Comments with media get noticed.
              </p>
            </div>
          ) : (
            comments.map((comment) => renderComment(comment))
          )}
        </div>

        {composer}
      </motion.div>
    </div>
  )
}
