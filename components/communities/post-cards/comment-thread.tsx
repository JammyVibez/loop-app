"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Lock } from "lucide-react"
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/community-engine"
import {
  Heart,
  MessageSquare,
  Send,
  
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Trash2,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { UserBadges } from "@/components/user-badge"
import { useVerificationBadges } from "@/hooks/use-verification-badges"
import { Spinner } from "@/components/ui/skeletons"

interface Comment {
  id: string | number
  content: string
  author_id: string
  parent_comment_id?: string | null
  created_at: string
  like_count?: number
  is_liked?: boolean
  author?: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string | null
    video_avatar_url?: string | null
    is_verified?: boolean
    is_team_member?: boolean
    is_sponsor?: boolean
    is_organization?: boolean
    is_premium?: boolean
    badge_id?: string | null
    equipped_frame_id?: string | number | null
  }
}

import type { VerificationBadge } from "@/hooks/use-verification-badges"

/** Small helper rendering every badge type a comment author may have. */
function CommentBadges({ author }: { author?: Comment["author"] }) {
  const badges = useVerificationBadges()
  return (
    <UserBadges
      is_verified={author?.is_verified}
      is_team_member={author?.is_team_member}
      is_sponsor={author?.is_sponsor}
      is_organization={author?.is_organization}
      is_premium={Boolean(author?.is_premium)}
      badge={author?.badge_id ? (badges[author.badge_id] as VerificationBadge | undefined) || null : null}
      size="sm"
    />
  )
}

interface CommentThreadProps {
  communityId: string
  postId: number
  isMember: boolean
  currentUserId?: string
  isModerator?: boolean
  initialCommentCount?: number
  onCommented?: () => void
  /** Replies are closed by a moderator — the thread stays readable. */
  locked?: boolean
}

export function CommentThread({
  communityId,
  postId,
  isMember,
  currentUserId,
  isModerator,
  initialCommentCount,
  onCommented,
  locked = false,
}: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<string | number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState("")

  const loadComments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/circles/${communityId}/posts/${postId}/comments`)
      const data = await res.json()
      if (data.success && Array.isArray(data.comments)) {
        setComments(data.comments)
      }
    } catch (e) {
      console.error("Failed to load comments:", e)
    } finally {
      setLoading(false)
    }
  }, [communityId, postId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  const rootComments = comments.filter((c) => !c.parent_comment_id)
  const childMap = new Map<string | number, Comment[]>()
  for (const c of comments) {
    if (c.parent_comment_id) {
      const children = childMap.get(c.parent_comment_id) || []
      children.push(c)
      childMap.set(c.parent_comment_id, children)
    }
  }

  const visibleRoots = expanded ? rootComments : rootComments.slice(0, 3)
  const hasMore = rootComments.length > 3

  const submitComment = async (parentId?: string | number | null) => {
    if (!newComment.trim() || submitting) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`/api/circles/${communityId}/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment.trim(),
          parent_comment_id: parentId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to comment")
      if (data.comment) {
        setComments((prev) => [...prev, data.comment])
        setNewComment("")
        setReplyTo(null)
        onCommented?.()
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteComment = async (commentId: string | number) => {
    try {
      await fetch(`/api/circles/${communityId}/posts/${postId}/comments?commentId=${commentId}`, {
        method: "DELETE",
      })
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch { /* intentionally silent */ }
  }

  const toggleLike = async (commentId: string | number) => {
    if (!currentUserId) return
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              is_liked: !c.is_liked,
              like_count: (c.like_count || 0) + (c.is_liked ? -1 : 1),
            }
          : c,
      ),
    )
    try {
      await fetch(`/api/circles/${communityId}/posts/${postId}/comments?commentId=${commentId}&action=like`, {
        method: "POST",
      })
    } catch { /* intentionally silent */ }
  }

  function CommentItem({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
    const children = childMap.get(comment.id) || []
    const [showChildren, setShowChildren] = useState(depth < 2)
    const isAuthor = currentUserId === comment.author_id

    return (
      <div className={cn("py-2.5", depth > 0 && "ml-8 border-l-2 border-border pl-4")}>
        <div className="flex items-start gap-2.5">
          <Link href={`/profile/${comment.author?.username}`}>
            <AvatarWithFrame
              avatarUrl={comment.author?.avatar_url}
              videoAvatarUrl={comment.author?.video_avatar_url || null}
              frameId={comment.author?.equipped_frame_id ?? null}
              seed={comment.author?.username}
              size={28}
              alt={comment.author?.display_name || comment.author?.username || ""}
              className="shrink-0"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link href={`/profile/${comment.author?.username}`} className="text-xs font-semibold hover:underline">
                {comment.author?.display_name || comment.author?.username}
              </Link>
              <CommentBadges author={comment.author} />
              <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
            </div>
            <p className="text-sm mt-0.5 whitespace-pre-wrap">{comment.content}</p>
            <div className="flex items-center gap-2 mt-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] rounded-full"
                onClick={() => toggleLike(comment.id)}
              >
                <Heart className={cn("h-3 w-3 mr-1", comment.is_liked && "fill-red-500 text-red-500")} />
                {comment.like_count || 0}
              </Button>
              {isMember && depth < 3 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] rounded-full"
                  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Reply
                </Button>
              )}
              {(isAuthor || isModerator) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={() => deleteComment(comment.id)} className="text-red-500">
                      <Trash2 className="h-3 w-3 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {replyTo === comment.id && (
              <div className="mt-2 flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[60px] text-sm rounded-xl resize-none"
                  autoFocus
                />
                <Button
                  size="sm"
                  className="rounded-full self-end"
                  onClick={() => submitComment(comment.id)}
                  disabled={submitting || !newComment.trim()}
                >
                  {submitting ? <Spinner className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                </Button>
              </div>
            )}
          </div>
        </div>

        {children.length > 0 && (
          <>
            {!showChildren && depth < 3 && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-8 mt-1 h-6 px-2 text-[11px] text-muted-foreground"
                onClick={() => setShowChildren(true)}
              >
                <ChevronDown className="h-3 w-3 mr-1" />
                {children.length} {children.length === 1 ? "reply" : "replies"}
              </Button>
            )}
            {showChildren && (
              <div className="space-y-0">
                {children.map((child) => (
                  <CommentItem key={child.id} comment={child} depth={depth + 1} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      {loading ? (
        <div className="space-y-3 py-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-2 animate-pulse">
              <div className="h-7 w-7 rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-3 w-full bg-muted/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {visibleRoots.length > 0 && (
            <div className="space-y-0">
              {visibleRoots.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          )}

          {hasMore && !expanded && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground mt-2"
              onClick={() => setExpanded(true)}
            >
              View all {rootComments.length} comments
            </Button>
          )}

          {expanded && rootComments.length > 3 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground mt-2"
              onClick={() => setExpanded(false)}
            >
              Show less
            </Button>
          )}

          {locked && !isModerator ? (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Replies are closed on this discussion.
            </p>
          ) : null}

          {isMember && !(locked && !isModerator) && (
            <div className="mt-3 flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="min-h-[44px] text-sm rounded-xl resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    submitComment()
                  }
                }}
              />
              <Button
                size="sm"
                className="rounded-full self-end shrink-0"
                onClick={() => submitComment()}
                disabled={submitting || !newComment.trim()}
              >
                {submitting ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </>
      )}
    </div>
  )
}
