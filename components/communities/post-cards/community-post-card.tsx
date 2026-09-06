"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/community-engine"
import { PostActions, type CommunityPost } from "./post-actions"
import { PollCard } from "./poll-card"
import { CommentThread } from "./comment-thread"
import {
  BadgeCheck,
  Clock,
  Eye,
  Pin,
  Share2,
  ExternalLink,
  Newspaper,
  MessageCircle,
  Image as ImageIcon,
  BarChart3,
  Calendar,
  FolderOpen,
  Trophy,
  Swords,
  BookOpen,
  Flame,
  FileText,
} from "lucide-react"

const POST_TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  discussion: { label: "Discussion", icon: MessageCircle, color: "text-indigo-500" },
  media: { label: "Media", icon: ImageIcon, color: "text-fuchsia-500" },
  poll: { label: "Poll", icon: BarChart3, color: "text-amber-500" },
  announcement: { label: "Announcement", icon: Newspaper, color: "text-red-500" },
  event: { label: "Event", icon: Calendar, color: "text-sky-500" },
  project: { label: "Project", icon: FolderOpen, color: "text-emerald-500" },
  challenge: { label: "Challenge", icon: Trophy, color: "text-amber-500" },
  duel: { label: "Duel", icon: Swords, color: "text-rose-500" },
  resource: { label: "Resource", icon: BookOpen, color: "text-cyan-500" },
  question: { label: "Question", icon: Flame, color: "text-orange-500" },
}

interface CommunityPostCardProps {
  post: CommunityPost
  communityId: string
  spaces: Array<{ id: string | number; name: string; icon?: string }>
  isMember: boolean
  isModerator: boolean
  currentUserId?: string
  onLike: (id: number) => void
  onSave?: (id: number) => void
  onShare?: (id: number) => void
  onPin?: (id: number) => void
  onDelete?: (id: number) => void
  onReport?: (id: number) => void
  liking?: number | null
  flashId?: number | null
}

export function CommunityPostCard({
  post,
  communityId,
  spaces,
  isMember,
  isModerator,
  currentUserId,
  onLike,
  onSave,
  onShare,
  onPin,
  onDelete,
  onReport,
  liking,
  flashId,
}: CommunityPostCardProps) {
  const [showComments, setShowComments] = useState(false)
  const [voting, setVoting] = useState(false)

  const author = post.author
  const postType = (post.post_type || "discussion").toLowerCase()
  const typeConfig = POST_TYPE_CONFIG[postType] || POST_TYPE_CONFIG.discussion
  const TypeIcon = typeConfig.icon
  const spaceName = post.space_id
    ? spaces.find((s) => String(s.id) === String(post.space_id))?.name || null
    : null

  const handleVote = async (pollId: number, optionId: string) => {
    if (voting) return
    setVoting(true)
    try {
      await fetch(`/api/circles/${communityId}/posts/${post.id}/poll/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_id: optionId }),
      })
    } catch {}
    setVoting(false)
  }

  const mediaUrls = post.media_urls && post.media_urls.length > 0
    ? post.media_urls
    : post.media_url
    ? [post.media_url]
    : []

  return (
    <div
      id={`world-post-${post.id}`}
      className={cn(
        "rounded-2xl border bg-card overflow-hidden scroll-mt-24 transition-all duration-500",
        flashId === post.id
          ? "border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-900/20"
          : "border-border",
      )}
    >
      {/* Pinned indicator */}
      {post.is_pinned && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500/10 border-b border-indigo-500/20">
          <Pin className="h-3 w-3 text-indigo-500" />
          <span className="text-[11px] font-semibold text-indigo-500">Pinned</span>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/profile/${author?.username}`}>
            <Avatar className="h-9 w-9">
              <AvatarImage src={author?.avatar_url || ""} alt="" />
              <AvatarFallback className="text-xs font-bold">
                {(author?.display_name || author?.username || "U").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/profile/${author?.username}`} className="text-sm font-semibold truncate hover:underline">
                {author?.display_name || author?.username}
              </Link>
              {author?.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
              {author?.is_premium && (
                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  PRO
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">@{author?.username}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {timeAgo(post.created_at)}
              <span className={cn("flex items-center gap-1", typeConfig.color)}>
                <TypeIcon className="h-3 w-3" />
                {typeConfig.label}
              </span>
              {spaceName && (
                <span className="flex items-center gap-1">
                  in {spaceName}
                </span>
              )}
            </div>
          </div>

          {post.status === "pending" && (
            <Badge className="gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold">
              <Clock className="h-2.5 w-2.5" /> Pending
            </Badge>
          )}
        </div>

        {/* Content */}
        {post.content && (
          <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
        )}

        {/* Media */}
        {mediaUrls.length > 0 && (
          <div className={cn("mt-3 grid gap-2", mediaUrls.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {mediaUrls.map((url, i) => (
              <div key={i} className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                <Image src={url} alt="" fill className="object-cover" unoptimized />
              </div>
            ))}
          </div>
        )}

        {/* Poll */}
        {post.poll && (
          <PollCard
            pollId={post.poll.id}
            question={post.poll.question}
            options={post.poll.options}
            totalVotes={post.poll.total_votes}
            expiresAt={post.poll.expires_at}
            isMember={isMember}
            onVote={handleVote}
            voting={voting}
          />
        )}

        {/* Tags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.hashtags.map((tag, i) => (
              <span key={i} className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <PostActions
          post={post}
          isMember={isMember}
          isModerator={isModerator}
          currentUserId={currentUserId}
          onLike={onLike}
          onComment={() => setShowComments(!showComments)}
          onSave={onSave}
          onShare={onShare}
          onPin={onPin}
          onDelete={onDelete}
          onReport={onReport}
          liking={liking != null && liking === post.id ? true : undefined}
        />

        {/* Comments */}
        {showComments && (
          <CommentThread
            communityId={communityId}
            postId={post.id}
            isMember={isMember}
            currentUserId={currentUserId}
            isModerator={isModerator}
            initialCommentCount={post.comment_count}
          />
        )}
      </div>
    </div>
  )
}
