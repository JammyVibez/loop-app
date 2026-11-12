"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Heart, Loader2, MessageCircle, Send, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  author?: { id?: string; username?: string; display_name?: string; avatar_url?: string }
}

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

/**
 * TikTok-style comments drawer: anchored to the bottom, keeps the video
 * visible above it, optimistic posting and per-comment likes.
 */
export function ReelCommentsSheet({ reelId, open, onOpenChange, onCountChange }: ReelCommentsSheetProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !reelId) return
    let cancelled = false
    setLoading(true)
    setReplyTo(null)
    fetch(`/api/reels/${reelId}/comments?limit=60`, { headers: { ...getAuthHeader() } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setComments(json?.comments || json?.data?.comments || [])
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, reelId, getAuthHeader])

  const submit = useCallback(async () => {
    const content = draft.trim()
    if (!content || !reelId) return
    if (!user) {
      toast({ title: "Sign in to comment" })
      return
    }
    setSending(true)
    const optimistic: Comment = {
      id: `local-${Date.now()}`,
      content,
      created_at: new Date().toISOString(),
      like_count: 0,
      is_liked: false,
      author: { id: user.id, username: (user as any).username, display_name: (user as any).display_name, avatar_url: (user as any).avatar_url },
    }
    setComments((current) => [...current, optimistic])
    setDraft("")
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
        setComments((current) => current.map((item) => (item.id === optimistic.id ? { ...json.comment, author: json.comment.author || optimistic.author } : item)))
      }
      setReplyTo(null)
    } catch (err: any) {
      setComments((current) => current.filter((item) => item.id !== optimistic.id))
      onCountChange?.(-1)
      toast({ title: "Comment failed", description: err.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }, [draft, reelId, user, toast, getAuthHeader, onCountChange, replyTo])

  const toggleLike = async (comment: Comment) => {
    if (!reelId || !user) return
    const liked = !comment.is_liked
    setComments((current) =>
      current.map((item) =>
        item.id === comment.id
          ? { ...item, is_liked: liked, like_count: Math.max(0, Number(item.like_count || 0) + (liked ? 1 : -1)) }
          : item,
      ),
    )
    // This endpoint toggles, so the same call adds or removes the like.
    await fetch(`/api/reels/${reelId}/comments/${comment.id}/like`, {
      method: "POST",
      headers: { ...getAuthHeader() },
    }).catch(() => undefined)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close comments"
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="absolute inset-x-0 bottom-0 mx-auto flex h-[72dvh] w-full max-w-lg flex-col rounded-t-3xl border-t border-white/10 bg-[#111111] text-white shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3">
          <h2 className="text-sm font-semibold">{comments.length ? `${comments.length} comments` : "Comments"}</h2>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {loading && comments.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-white/50" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <MessageCircle className="h-7 w-7 text-white/25" />
              <p className="text-sm text-white/60">No comments yet. Start the conversation.</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Link href={comment.author?.username ? `/profile/${comment.author.username}` : "#"} className="shrink-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={comment.author?.avatar_url} />
                    <AvatarFallback className="text-xs">{(comment.author?.display_name || "U").charAt(0)}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white/60">
                    {comment.author?.username ? `@${comment.author.username}` : "user"}
                    {comment.created_at ? <span className="ml-1.5 font-normal text-white/35">{relativeTime(comment.created_at)}</span> : null}
                  </p>
                  <p className="mt-0.5 break-words text-sm leading-relaxed text-white/90">{comment.content}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(comment)
                      inputRef.current?.focus()
                    }}
                    className="mt-1 text-[11px] font-medium text-white/40 hover:text-white/70"
                  >
                    Reply
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleLike(comment)}
                  className={cn("flex shrink-0 flex-col items-center gap-0.5 text-white/40", comment.is_liked && "text-rose-400")}
                >
                  <Heart className={cn("h-4 w-4", comment.is_liked && "fill-current")} />
                  <span className="text-[10px] tabular-nums">{comment.like_count || 0}</span>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          {replyTo && (
            <div className="mb-1 flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-white/50">
              <span className="truncate">Replying to @{replyTo.author?.username || "user"}</span>
              <button type="button" onClick={() => setReplyTo(null)}>
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
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
              placeholder={user ? "Add a comment…" : "Sign in to comment"}
              disabled={!user}
              maxLength={1000}
              className="h-10 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!draft.trim() || sending || !user}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition disabled:opacity-30"
              aria-label="Post comment"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
