"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Heart, MoreHorizontal, Pencil, Reply, Trash2 } from "lucide-react"
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
import { formatDistanceToNow } from "date-fns"
import { EmptyState } from "@/components/ui/empty-state"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { RichContent } from "@/components/content/rich-content"

interface CommentAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_verified?: boolean
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
}

export function CommentsSection({ loopId }: { loopId: string; comments?: Comment[] }) {
  const [commentsData, setCommentsData] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const token = user?.access_token || user?.token

  const loadComments = async () => {
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
      toast({ title: "Error", description: "Failed to load comments", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loopId) void loadComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopId, token])

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !token) return
    const response = await fetch(`/api/loops/${loopId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: newComment }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast({ title: "Error", description: data.error || "Failed to add comment", variant: "destructive" })
      return
    }
    setCommentsData((prev) => [data.comment, ...prev])
    setNewComment("")
  }

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim() || !token) return
    const response = await fetch(`/api/loops/${loopId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: replyContent, parent_comment_id: parentId }),
    })
    if (!response.ok) {
      toast({ title: "Error", description: "Failed to reply", variant: "destructive" })
      return
    }
    setReplyContent("")
    setReplyingTo(null)
    await loadComments()
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
      toast({ title: "Error", description: data.error || "Failed to edit", variant: "destructive" })
      return
    }
    setCommentsData((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...data.comment } : c)))
    setEditingId(null)
    setEditContent("")
  }

  const handleDelete = async () => {
    if (!deleteId || !token) return
    const response = await fetch(`/api/loops/${loopId}/comments/${deleteId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      toast({ title: "Error", description: "Failed to delete comment", variant: "destructive" })
      return
    }
    setCommentsData((prev) => prev.filter((c) => c.id !== deleteId))
    setDeleteId(null)
  }

  const renderComment = (comment: Comment, isReply = false) => {
    const authorId = comment.author_id || comment.author?.id
    const isOwner = user?.id === authorId
    const likes = comment.like_count ?? comment.likes ?? 0

    return (
      <div key={comment.id} className={`space-y-3 ${isReply ? "ml-10 border-l border-white/10 pl-4" : ""}`}>
        <div className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.author?.avatar_url || "/placeholder.svg"} />
            <AvatarFallback>{comment.author?.display_name?.charAt(0) || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-white">{comment.author?.display_name}</span>
                <span className="text-slate-500">@{comment.author?.username}</span>
                <span className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
                {comment.is_edited && <span className="text-xs text-slate-500">(edited)</span>}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-white/10 bg-[#0a1020] text-slate-100">
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
                <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="bg-white/5" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <RichContent text={comment.content} className="text-sm text-slate-200" />
            )}

            <div className="mt-2 flex items-center gap-3">
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleLike(comment.id)}>
                <Heart className={`mr-1 h-3.5 w-3.5 ${comment.isLiked ? "fill-red-500 text-red-500" : ""}`} />
                {likes}
              </Button>
              {!isReply && (
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setReplyingTo(comment.id)}>
                  <Reply className="mr-1 h-3.5 w-3.5" /> Reply
                </Button>
              )}
            </div>

            {replyingTo === comment.id && (
              <div className="mt-3 space-y-2">
                <MentionTextarea
                  value={replyContent}
                  onChange={setReplyContent}
                  placeholder="Write a reply… use @ to tag someone"
                  className="bg-white/5"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSubmitReply(comment.id)}>Reply</Button>
                  <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
        {(comment.replies || []).map((reply) => renderComment(reply, true))}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-lg font-semibold text-white">Comments</h3>

      {user ? (
        <div className="space-y-2">
          <MentionTextarea
            value={newComment}
            onChange={setNewComment}
            placeholder="Share your thoughts… type @ to tag someone"
            className="min-h-[80px] border-white/10 bg-white/5"
          />
          <Button onClick={handleSubmitComment} disabled={!newComment.trim()}>
            Post comment
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-slate-300">
          <p className="mb-2">Browsing as guest — sign in to reply.</p>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/login">Log in to comment</Link>
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
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
