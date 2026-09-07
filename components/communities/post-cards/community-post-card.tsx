"use client"

import { useState, useRef } from "react"
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
import { ReportModal } from "./report-modal"
import { PostReactions } from "./post-reactions"
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { isVideoUrl } from "@/components/communities/device-media-picker"

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
  onEdit?: (id: number, content: string) => void
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
  onEdit,
  liking,
  flashId,
}: CommunityPostCardProps) {
  const [showComments, setShowComments] = useState(false)
  const [voting, setVoting] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reactions, setReactions] = useState<Array<{type: string; count: number; reacted: boolean}>>([])
  const [mediaIndex, setMediaIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const author = post.author
  const postType = (post.post_type || "discussion").toLowerCase()
  const typeConfig = POST_TYPE_CONFIG[postType] || POST_TYPE_CONFIG.discussion
  const TypeIcon = typeConfig.icon
  const spaceName = post.space_id
    ? spaces.find((s) => String(s.id) === String(post.space_id))?.name || null
    : null

  const handleReact = async (postId: number, type: string) => {
    try {
      const res = await fetch(`/api/circles/${communityId}/posts/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "react", reaction_type: type }),
      })
      if (res.ok) {
        const data = await res.json()
        setReactions((prev) => {
          const existing = prev.find((r) => r.type === type)
          if (existing) {
            return prev.map((r) => r.type === type ? { ...r, count: r.count + (data.reacted ? 1 : -1), reacted: data.reacted } : r)
          }
          return [...prev, { type, count: 1, reacted: true }]
        })
      }
    } catch {}
  }

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

  // ---- Defensive normalization -------------------------------------------------
  // Legacy/oddly-shaped rows must never crash the feed render: some older writers
  // stored media_urls / hashtags / poll options as JSON strings instead of arrays.
  const toArray = (v: unknown): any[] => {
    if (Array.isArray(v)) return v
    if (typeof v === "string" && v.trim()) {
      try {
        const parsed = JSON.parse(v)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }
  const mediaUrls = (toArray(post.media_urls).length > 0 ? toArray(post.media_urls) : toArray(post.media_url)).filter(Boolean)
  const hashtags = toArray(post.hashtags).filter(Boolean)
  const pollOptions = post.poll ? toArray((post.poll as any).options).map((o: any, i: number) =>
    typeof o === "object" && o !== null
      ? { id: String(o.id ?? i), text: String(o.text ?? o.label ?? ""), votes: Number(o.votes || 0) }
      : { id: String(i), text: String(o), votes: 0 },
  ) : []

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

        {/* Media — carousel with arrows (swipe on touch) so multi-media posts are browsable */}
        {mediaUrls.length > 0 && (() => {
          const idx = Math.min(mediaIndex, mediaUrls.length - 1)
          const activeUrl = mediaUrls[idx]
          const isVideo = isVideoUrl(activeUrl)
          const step = (dir: 1 | -1) => {
            setMediaIndex((prev) => (prev + dir + mediaUrls.length) % mediaUrls.length)
          }
          return (
            <div className="mt-3">
              <div
                className={cn("relative aspect-video overflow-hidden rounded-xl bg-muted select-none", mediaUrls.length > 1 && "cursor-grab")}
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0]?.clientX ?? null
                }}
                onTouchEnd={(e) => {
                  if (touchStartX.current === null) return
                  const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
                  touchStartX.current = null
                  if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1)
                }}
              >
                {isVideo ? (
                  <video src={activeUrl} controls playsInline className="h-full w-full bg-black object-contain" />
                ) : (
                  <Image src={activeUrl} alt="" fill className="object-cover" unoptimized />
                )}
                {mediaUrls.length > 1 && (
                  <>
                    <button
                      onClick={() => step(-1)}
                      aria-label="Previous media"
                      className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => step(1)}
                      aria-label="Next media"
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                      {idx + 1} / {mediaUrls.length}
                    </span>
                  </>
                )}
              </div>
              {mediaUrls.length > 1 && (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {mediaUrls.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setMediaIndex(i)}
                      aria-label={`Go to media ${i + 1}`}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === idx ? "w-5 bg-indigo-500" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Poll */}
        {post.poll && pollOptions.length >= 2 && (
          <PollCard
            pollId={post.poll.id}
            question={post.poll.question}
            options={pollOptions}
            totalVotes={Number(post.poll.total_votes || 0)}
            expiresAt={post.poll.expires_at}
            isMember={isMember}
            onVote={handleVote}
            voting={voting}
          />
        )}

        {/* Tags */}
        {hashtags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {hashtags.map((tag, i) => (
              <span key={i} className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Reactions */}
        <PostReactions
          postId={post.id}
          reactions={reactions.length > 0 ? reactions : [
            { type: "like", count: post.like_count || 0, reacted: post.is_liked || false },
          ]}
          onReact={handleReact}
          isMember={isMember}
        />

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
          onReport={() => setShowReport(true)}
          onEdit={onEdit}
          liking={liking != null && liking === post.id ? true : undefined}
        />

        {/* Report Modal */}
        <ReportModal
          open={showReport}
          onOpenChange={setShowReport}
          postId={post.id}
          communityId={communityId}
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
