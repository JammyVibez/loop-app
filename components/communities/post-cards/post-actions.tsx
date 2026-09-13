"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/community-engine"
import {
  Heart,
  MessageSquare,
  Send,
  Bookmark,
  MoreHorizontal,
  Pin,
  Trash2,
  Pencil,
  Share2,
  AlertTriangle,
  Clock,
  Check,
  ChevronDown,
  ChevronUp,
  Hourglass,
  Lock,
  ExternalLink,
  Gift,
  Link2,
} from "lucide-react"

export interface PostAuthor {
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

export interface PostPoll {
  id: number
  question: string
  options: Array<{ id: string; text: string; votes: number }>
  total_votes: number
  expires_at?: string
}

export interface CommunityPost {
  id: number
  content: string
  media_urls?: string[] | null
  media_url?: string | null
  media_type?: string | null
  like_count: number
  comment_count: number
  share_count?: number
  view_count?: number
  is_liked?: boolean
  is_saved?: boolean
  is_pinned?: boolean
  space_id?: number | null
  status?: string | null
  post_type?: string | null
  poll?: PostPoll | null
  hashtags?: string[] | null
  tags?: string[] | null
  created_at: string
  author?: PostAuthor
}

interface PostActionsProps {
  post: CommunityPost
  isMember: boolean
  isModerator: boolean
  currentUserId?: string
  onLike: (id: number) => void
  onComment?: (id: number) => void
  onSave?: (id: number) => void
  onShare?: (id: number) => void
  onGift?: (post: CommunityPost) => void
  onPin?: (id: number) => void
  onDelete?: (id: number) => void
  onReport?: (id: number) => void
  onEdit?: (id: number, content: string) => void
  liking?: boolean
  commentCount?: number
  /** Community id — enables the post-detail page link + copy-link action */
  communityId?: string
}

export function PostActions({
  post,
  isMember,
  isModerator,
  currentUserId,
  onLike,
  onComment,
  onSave,
  onShare,
  onGift,
  onPin,
  onDelete,
  onReport,
  onEdit,
  liking,
  commentCount,
  communityId,
}: PostActionsProps) {
  const isAuthor = currentUserId === post.author?.id
  const canModerate = isModerator || isAuthor
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [copied, setCopied] = useState(false)

  if (editing) {
    return (
      <div className="mt-3 space-y-2">
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="min-h-[80px] text-sm rounded-xl resize-none"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" className="rounded-full text-xs" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="rounded-full text-xs"
            onClick={() => {
              if (onEdit && editContent.trim()) {
                onEdit(post.id, editContent.trim())
                setEditing(false)
              }
            }}
            disabled={!editContent.trim()}
          >
            Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 mt-3">
      <Button
        size="sm"
        variant="ghost"
        className={cn(
          "rounded-full text-xs h-8 px-3",
          post.is_liked && "text-red-500 hover:text-red-600",
        )}
        onClick={() => onLike(post.id)}
        disabled={liking || !isMember || post.status === "pending"}
      >
        <Heart className={cn("h-3.5 w-3.5 mr-1", post.is_liked && "fill-current")} />
        {post.like_count || 0}
      </Button>

      {onComment && (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-xs h-8 px-3"
          onClick={() => onComment(post.id)}
          disabled={!isMember || post.status === "pending"}
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1" />
          {commentCount ?? (post.comment_count || 0)}
        </Button>
      )}

      {onShare && (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-xs h-8 px-3"
          onClick={() => onShare(post.id)}
        >
          <Share2 className="h-3.5 w-3.5" />
          {(post as any).share_count > 0 && (
            <span className="ml-1">{(post as any).share_count}</span>
          )}
        </Button>
      )}

      {onSave && (
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            "rounded-full text-xs h-8 px-3",
            post.is_saved && "text-amber-500",
          )}
          onClick={() => onSave(post.id)}
          disabled={!isMember}
        >
          <Bookmark className={cn("h-3.5 w-3.5", post.is_saved && "fill-current")} />
        </Button>
      )}

      {/* Gift the author — members can send community gifts */}
      {onGift && !isAuthor && isMember && post.author?.id && (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-xs h-8 px-3 text-fuchsia-500 hover:text-fuchsia-600"
          onClick={() => onGift(post)}
          title={`Gift ${post.author?.display_name || "the author"}`}
        >
          <Gift className="h-3.5 w-3.5" />
        </Button>
      )}

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="rounded-full h-8 w-8 p-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {communityId && (
              <DropdownMenuItem
                onClick={() => {
                  const url = `${window.location.origin}/communities/${communityId}/posts/${post.id}`
                  void navigator.clipboard.writeText(url).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1600)
                  })
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5 mr-2 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5 mr-2" />}
                {copied ? "Link copied" : "Copy link"}
              </DropdownMenuItem>
            )}
            {communityId && (
              <DropdownMenuItem asChild>
                <Link href={`/communities/${communityId}/posts/${post.id}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  View post
                </Link>
              </DropdownMenuItem>
            )}
            {canModerate && onPin && (
              <DropdownMenuItem onClick={() => onPin(post.id)}>
                <Pin className="h-3.5 w-3.5 mr-2" />
                {post.is_pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
            )}
            {isAuthor && onEdit && (
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {canModerate && onDelete && (
              <DropdownMenuItem onClick={() => onDelete(post.id)} className="text-red-500">
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
            {!isAuthor && onReport && (
              <DropdownMenuItem onClick={() => onReport(post.id)} className="text-red-500">
                <AlertTriangle className="h-3.5 w-3.5 mr-2" />
                Report
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
