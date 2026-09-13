"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Heart, Lock, MoreHorizontal, Pencil, Reply, Trash2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ReportContentButton } from "@/components/moderation/report-content-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { RichContent } from "@/components/content/rich-content"
import { MediaEmojiPicker } from "@/components/content/media-emoji-picker"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"
import { createClient } from "@/lib/supabase"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { CosmeticAvatar } from "@/components/profile/cosmetic-avatar"
import type { ActiveCosmetics } from "@/lib/cosmetics"

interface CommentAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  video_avatar_url?: string | null
  is_verified?: boolean
  is_premium?: boolean
  active_cosmetics?: ActiveCosmetics | null
  cosmetics?: ActiveCosmetics | null
}

interface Comment {
  id: string
  author_id?: string
  author: CommentAuthor
  content: string
  created_at: string
  like_count?: number
  likes?: number
  is_edited?: boolean
  replies?: Comment[]
  isLiked?: boolean
  parent_comment_id?: string | null
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
)

export function CommentsSection({ loopId, commentsDisabled }: { loopId: string; comments?: Comment[]; commentsDisabled?: boolean }) {
  const [commentsData, setCommentsData] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const token = user?.access_token || user?.token

  const loadComments = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/loops/${loopId}/comments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (response.ok) {
        const data = await response.json()
        setCommentsData(data.comments || [])
      }
    } catch {
      toast({ title: "Couldn't load comments", description: 'Check your connection and try again.', variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [loopId, token, toast])

  useEffect(() => {
    if (loopId) void loadComments()
  }, [loopId, loadComments])

  // Real-time listener for live comments
  useEffect(() => {
    if (!loopId) return

    const channel = supabase
      .channel(`comments:${loopId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `loop_id=eq.${loopId}` },
        () => {
          void loadComments()
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "comments", filter: `loop_id=eq.${loopId}` },
        () => {
          void loadComments()
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments", filter: `loop_id=eq.${loopId}` },
        () => {
          void loadComments()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loopId, loadComments])

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !token || submitting) return
    const submittedContent = newComment
    setSubmitting(true)
    try {
      const response = await fetch(`/api/loops/${loopId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: submittedContent }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast({ title: "Couldn't post comment", description: data.error || 'Try again in a moment.', variant: "destructive" })
        return
      }
      // Dedupe by id — the realtime reload will re-fetch the authoritative list.
      setCommentsData((prev) =>
        data.comment?.id && prev.some((c) => c.id === data.comment.id)
          ? prev
          : [data.comment, ...prev],
      )
      setNewComment("")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim() || !token || submittingReplyId) return
    setSubmittingReplyId(parentId)
    try {
      const response = await fetch(`/api/loops/${loopId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: replyContent, parent_comment_id: parentId }),
      })
      if (!response.ok) {
        toast({ title: "Couldn't post reply", description: 'Try again in a moment.', variant: "destructive" })
        return
      }
      setReplyContent("")
      setReplyingTo(null)
      await loadComments()
    } finally {
      setSubmittingReplyId(null)
    }
  }

  const handleLike = async (commentId: string) => {
    if (!token) return
    const response = await fetch(`/api/loops/${loopId}/comments/${commentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ action: "like" }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return
    setCommentsData((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              isLiked: data.is_active,
              like_count: Math.max((comment.like_count || comment.likes || 0) + (data.is_active ? 1 : -1), 0),
            }
          : comment,
      ),
    )
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim() || !token) return
    const response = await fetch(`/api/loops/${loopId}/comments/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: editContent }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast({ title: "Couldn't edit comment", description: data.error || 'Try again.', variant: "destructive" })
      return
    }
    setCommentsData((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...data.comment } : c)))
    setEditingId(null)
    setEditContent("")
  }

  const handleDelete = async () => {
    if (!deleteId || !token) return
    const removingId = deleteId
    const removeFromTree = (items: Comment[]): Comment[] =>
      items
        .filter((c) => c.id !== removingId)
        .map((c) => ({
          ...c,
          replies: c.replies ? removeFromTree(c.replies) : c.replies,
        }))

    // Optimistic remove (top-level + nested replies)
    setCommentsData((prev) => removeFromTree(prev))
    setDeleteId(null)

    const response = await fetch(`/api/loops/${loopId}/comments/${removingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      toast({ title: "Couldn't delete comment", description: 'Try again.', variant: "destructive" })
      void loadComments()
      return
    }
  }

  const renderComment = (comment: Comment, depth = 0) => {
    const authorId = comment.author_id || comment.author?.id
    const isOwner = user?.id === authorId
    const likes = comment.like_count ?? comment.likes ?? 0
    const isReply = depth > 0

    return (
      <div key={comment.id} className={`space-y-3 ${isReply ? "ml-4 sm:ml-6 border-l-2 border-cyan-500/20 pl-3 sm:pl-4" : ""}`}>
        <div className="flex gap-3">
          <Link href={`/profile/${comment.author?.username || ""}`} className="shrink-0">
            <AvatarWithFrame
              avatarUrl={comment.author?.avatar_url}
              videoAvatarUrl={comment.author?.video_avatar_url || null}
              frameId={(comment.author as any)?.equipped_frame_id ?? null}
              seed={comment.author?.username}
              size={32}
              alt={comment.author?.display_name || ""}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/profile/${comment.author?.username || ""}`}
                  className="font-semibold text-foreground hover:underline"
                >
                  {comment.author?.display_name}
                </Link>
                {comment.author?.is_verified && (
                  <VerifiedSeal size={15} title="Verified Creator" />
 )}
                <Link
                  href={`/profile/${comment.author?.username || ""}`}
                  className="text-muted-foreground text-xs hover:underline"
                >
                  @{comment.author?.username}
                </Link>
                <FreshnessTimestamp date={comment.created_at} showIcon />
                {comment.is_edited && <span className="text-xs text-muted-foreground">(edited)</span>}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-border bg-popover text-foreground">
                  {isOwner && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditContent(comment.content)
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteId(comment.id)} className="text-red-300">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                  <ReportContentButton contentType="comment" contentId={comment.id} />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {editingId === comment.id ? (
              <div className="space-y-2">
                <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="bg-muted border-border text-foreground" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <RichContent text={comment.content} className="text-sm text-foreground" />
            )}

            <div className="mt-2 flex items-center gap-3">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => handleLike(comment.id)}>
                <Heart className={`mr-1 h-3.5 w-3.5 ${comment.isLiked ? "fill-red-500 text-red-500" : ""}`} />
                {likes}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setReplyingTo(comment.id)}>
                <Reply className="mr-1 h-3.5 w-3.5" /> Reply
              </Button>
            </div>

            {replyingTo === comment.id && (
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <MentionTextarea
                    value={replyContent}
                    onChange={setReplyContent}
                    placeholder={`Reply to @${comment.author?.username || "comment"}… use @ to tag`}
                    className="bg-muted border-border text-foreground min-h-[70px] pr-10"
                  />
                  <div className="absolute right-2 bottom-2">
                    <MediaEmojiPicker onSelectEmoji={(emoji) => setReplyContent((prev) => prev + emoji)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
                    onClick={() => handleSubmitReply(comment.id)}
                    disabled={submittingReplyId === comment.id}
                  >
                    {submittingReplyId === comment.id ? "Replying…" : "Reply"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
        {(comment.replies || []).map((reply) => renderComment(reply, depth + 1))}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          Comments <span className="text-xs text-cyan-400 font-normal">({commentsData.length}) • Live</span>
        </h3>
      </div>

      {commentsDisabled ? (
        <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Comments are locked by the author.</span>
        </div>
      ) : user ? (
        <div className="space-y-2">
          <div className="relative">
            <MentionTextarea
              value={newComment}
              onChange={setNewComment}
              placeholder="Share your thoughts… type @ to tag, insert emojis, GIFs or stickers"
              className="min-h-[85px] border-border bg-muted text-foreground pr-12"
            />
            <div className="absolute right-2 bottom-2">
              <MediaEmojiPicker
                onSelectEmoji={(emoji) => setNewComment((prev) => prev + emoji)}
                onSelectGif={(url) => setNewComment((prev) => prev + ` ![GIF](${url}) `)}
                isPro={Boolean((user as any)?.is_premium)}
              />
            </div>
          </div>
          <Button
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
            className="bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400 rounded-xl"
          >
            {submitting ? "Posting…" : "Post comment"}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          <p className="mb-2">Browsing as guest — sign in to reply.</p>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/login">Log in to comment</Link>
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : commentsData.length === 0 ? (
        <EmptyState title="No comments yet" description="Be the first to start the conversation." />
      ) : (
        <div className="space-y-5">{commentsData.map((comment) => renderComment(comment))}</div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete comment?"
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
