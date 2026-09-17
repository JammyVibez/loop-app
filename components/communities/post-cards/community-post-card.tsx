"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/community-engine"
import { RichContent } from "@/components/content/rich-content"
import { PostActions, type CommunityPost } from "./post-actions"
import { PollCard } from "./poll-card"
import { CommentThread } from "./comment-thread"
import { ReportModal } from "./report-modal"
import { PostReactions } from "./post-reactions"
import { GiftModal } from "@/components/gifting/gift-modal"
import { ShareToDmModal } from "@/components/messages/share-to-dm-modal"
import { ShareToCircleModal } from "@/components/messages/share-to-circle-modal"
import { ShareAsImageModal } from "@/components/engagement/share-as-image-modal"
import {
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
  Gift,
  Flame,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import { isVideoUrl } from "@/components/communities/device-media-picker"
import { UserBadges } from "@/components/user-badge"
import { useVerificationBadges } from "@/hooks/use-verification-badges"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { useAuth } from "@/hooks/use-auth"

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
  /** Optional custom vote handler (detail page supplies one that syncs results). */
  onVote?: (pollId: number, optionId: string) => void
  /** Post id currently processing a vote — mirrors the `liking` pattern. */
  voting?: number | null
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
  onVote,
  voting,
  onSave,
  onShare,
  onPin,
  onDelete,
  onReport,
  onEdit,
  liking,
  flashId,
}: CommunityPostCardProps) {
  const badges = useVerificationBadges()
  const [showComments, setShowComments] = useState(false)
  const [localVoting, setLocalVoting] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reactions, setReactions] = useState<Array<{type: string; count: number; reacted: boolean}>>([])
  // Hydrate the fire/clap/etc. chips from the server-provided counts. We can't
  // know which types the viewer personally reacted to from the list payload,
  // so counts render un-highlighted; a tap toggles via the react action.
  useEffect(() => {
    const counts = (post as any).reaction_counts as Record<string, number> | undefined
    if (!counts || typeof counts !== "object") return
    setReactions((prev) => {
      const merged = new Map(prev.map((r) => [r.type, r]))
      for (const [type, count] of Object.entries(counts)) {
        const n = Number(count || 0)
        if (n <= 0) continue
        const existing = merged.get(type)
        merged.set(type, existing ? { ...existing, count: n } : { type, count: n, reacted: false })
      }
      return Array.from(merged.values())
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(post as any).reaction_counts])
  const [mediaIndex, setMediaIndex] = useState(0)
  const [extraComments, setExtraComments] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [giftOpen, setGiftOpen] = useState(false)
  const [shareDmOpen, setShareDmOpen] = useState(false)
  const [shareCircleOpen, setShareCircleOpen] = useState(false)
  const [shareImageOpen, setShareImageOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const viewerTouchStartX = useRef<number | null>(null)
  const { getAuthHeader } = useAuth()
  const authHeaders = getAuthHeader()

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
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ action: "react", reaction_type: type }),
      })
      if (res.ok) {
        const data = await res.json()
        setReactions((prev) => {
          const existing = prev.find((r) => r.type === type)
          if (existing) {
            return prev.map((r) => r.type === type ? { ...r, count: Math.max(0, r.count + (data.reacted ? 1 : -1)), reacted: data.reacted } : r)
          }
          return [...prev, { type, count: 1, reacted: data.reacted !== false }]
        })
      }
    } catch { /* intentionally silent */ }
  }

  const handleVote = async (pollId: number, optionId: string) => {
    if (voting) return
    // Detail page supplies its own syncing handler; feed falls back to the
    // built-in POST + local vote bump.
    if (onVote) {
      await onVote(pollId, optionId)
      return
    }
    setLocalVoting(true)
    try {
      const optIdx = (post.poll?.options || []).findIndex((o: any) => String(o.id) === String(optionId))
      const res = await fetch(`/api/circles/${communityId}/posts/${post.id}/poll/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeaders || {}) },
        body: JSON.stringify({ optionId, optionIndex: optIdx >= 0 ? optIdx : undefined }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && (data as any)?.poll) {
        // Sync the authoritative poll row (options with new vote counts) so
        // results render correctly for everyone viewing after a refresh.
        ;(post as any).poll = (data as any).poll
      }
    } catch { /* intentionally silent */ }
    setLocalVoting(false)
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
  // Hashtags must ALWAYS be plain strings — rows written by older flows stored them as
  // objects like { text: "x" }, and rendering an object as a React child is what caused
  // the "object with keys {text}" feed crash.
  const hashtags = toArray(post.hashtags)
    .map((t: any) =>
      typeof t === "object" && t !== null
        ? String(t.text ?? t.value ?? t.name ?? "")
        : String(t ?? ""),
    )
    .filter(Boolean)
  // Poll option text must ALWAYS end up a plain string: legacy writers stored
  // options as { text: "x" } objects AND nested { text: { text: "x" } } shapes,
  // and String()-ing an object produces the old "[object Object]" option bug.
  const optionText = (o: any): string => {
    const raw = o && typeof o === "object" ? (o.text ?? o.label ?? o.name ?? "") : o
    if (raw && typeof raw === "object") {
      return String(raw.text ?? raw.value ?? raw.label ?? raw.name ?? "")
    }
    return String(raw ?? "")
  }
  const pollOptions = post.poll ? toArray((post.poll as any).options).map((o: any, i: number) =>
    typeof o === "object" && o !== null
      ? {
          id: String(o.id ?? i),
          text: optionText(o),
          votes: Number(o.votes || 0),
          image_url: o.image_url || o.media_url ? String(o.image_url || o.media_url) : null,
        }
      : { id: String(i), text: String(o ?? ""), votes: 0, image_url: null },
  ) : []

  return (
    <div
      id={`world-post-${post.id}`}
      className={cn(
        // Borderless, X-style post: no card chrome or shadow — community posts
        // sit directly on the page background, separated by the feed's
        // hairline divider, with a whisper-quiet row hover.
        "relative bg-transparent scroll-mt-24 transition-colors duration-300 hover:bg-foreground/[0.02]",
        flashId === post.id && "bg-indigo-500/[0.07] ring-1 ring-inset ring-indigo-500/30",
      )}
    >
      {/* Pinned indicator */}
      {post.is_pinned && (
        <div className="flex items-center gap-1.5 px-1.5 py-1">
          <Pin className="h-3 w-3 text-indigo-500" />
          <span className="text-[11px] font-semibold text-indigo-500">Pinned</span>
        </div>
      )}

      <div className="px-1.5 py-3 sm:px-2">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/profile/${author?.username}`} className="shrink-0">
            <AvatarWithFrame
              avatarUrl={author?.avatar_url}
              videoAvatarUrl={author?.video_avatar_url || null}
              frameId={author?.equipped_frame_id ?? null}
              size={36}
              alt={author?.display_name || author?.username || ""}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/profile/${author?.username}`} className="text-sm font-semibold truncate hover:underline">
                {author?.display_name || author?.username}
              </Link>
              <UserBadges
                is_verified={author?.is_verified}
                is_team_member={author?.is_team_member}
                is_sponsor={author?.is_sponsor}
                is_organization={author?.is_organization}
                is_premium={Boolean(author?.is_premium)}
                badge={author?.badge_id ? badges[author.badge_id] || null : null}
                size="sm"
              />
              {author?.is_premium && (
                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  PRO
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">@{author?.username}</span>
              {(post as any).gift_count > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-fuchsia-500 bg-fuchsia-500/10 px-1.5 py-0.5 rounded" title={`${(post as any).gift_count} gifts received`}>
                  <Gift className="h-2.5 w-2.5" /> {(post as any).gift_count}
                </span>
              )}
            </div>              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <Link
                href={`/communities/${communityId}/posts/${post.id}`}
                className="transition hover:text-foreground hover:underline"
                title="Open post"
              >
                {timeAgo(post.created_at)}
              </Link>
              <span className={cn("flex items-center gap-1", typeConfig.color)}>
                <TypeIcon className="h-3 w-3" />
                {typeConfig.label}
              </span>
              {spaceName && (
                <span className="flex items-center gap-1">
                  in {spaceName}
                </span>
              )}
              {(post as any).view_count > 0 && (
                <span className="flex items-center gap-0.5">
                  <Eye className="h-3 w-3" /> {(post as any).view_count}
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

        {/* Content — rich rendering: #hashtags, @mentions, stickers/GIFs and
            auto link-preview cards, matching the main loop feed (#20). Clicking
            the body opens the post detail page, matching social-app conventions. */}
        {post.content && (
          <div
            role="link"
            tabIndex={0}
            className="cursor-pointer rounded-lg transition hover:opacity-90"
            onClick={(e) => {
              // Don't hijack clicks on hashtags/mentions/link previews inside the body.
              const t = e.target as HTMLElement
              if (t.closest("a, button")) return
              window.location.href = `/communities/${communityId}/posts/${post.id}`
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") window.location.href = `/communities/${communityId}/posts/${post.id}`
            }}
          >
            <RichContent text={post.content} showPreviewCard className="text-[15px] leading-relaxed" />
          </div>
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
                className={cn("group relative aspect-video overflow-hidden rounded-2xl bg-muted select-none", mediaUrls.length > 1 && "cursor-grab")}
                onClick={() => {
                  setViewerIndex(idx)
                  setViewerOpen(true)
                }}
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
                <span className="absolute right-2 top-2 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                  View full screen
                </span>
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
            voting={Boolean(voting != null ? voting === post.id : localVoting)}
          />
        )}

        {/* Tags */}
        {hashtags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {hashtags.map((tag, i) => (
              <span key={i} className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full ring-1 ring-inset ring-primary/20">
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
          onGift={() => setGiftOpen(true)}
          onPin={onPin}
          onDelete={onDelete}
          onReport={() => setShowReport(true)}
          onEdit={onEdit}
          onShareSuite={(p, kind) => {
            if (kind === "dm") setShareDmOpen(true)
            else if (kind === "circle") setShareCircleOpen(true)
            else setShareImageOpen(true)
          }}
          liking={liking != null && liking === post.id ? true : undefined}
          commentCount={(post.comment_count || 0) + extraComments}
        />

        {/* Report Modal */}
        <ReportModal
          open={showReport}
          onOpenChange={setShowReport}
          postId={post.id}
          communityId={communityId}
        />

        {/* Share suite — same set as the feed loop card, scoped to this post */}
        <ShareToDmModal
          open={shareDmOpen}
          onOpenChange={setShareDmOpen}
          item={{
            id: String(post.id),
            type: "loop",
            title: post.content?.slice(0, 60),
            text: post.content,
            authorName: author?.display_name || author?.username,
            mediaUrl: mediaUrls[0] || undefined,
            url: `/communities/${communityId}/posts/${post.id}`,
            shareLabel: "Post",
          }}
        />
        <ShareToCircleModal
          open={shareCircleOpen}
          onOpenChange={setShareCircleOpen}
          item={{
            id: String(post.id),
            type: "loop",
            title: post.content?.slice(0, 60),
            text: post.content,
            authorName: author?.display_name || author?.username,
            mediaUrl: mediaUrls[0] || undefined,
            url: `/communities/${communityId}/posts/${post.id}`,
            shareLabel: "Post",
          }}
        />
        <ShareAsImageModal
          open={shareImageOpen}
          onOpenChange={setShareImageOpen}
          post={{
            id: String(post.id),
            content: post.content || "",
            created_at: post.created_at,
            author: {
              username: author?.username || "member",
              display_name: author?.display_name || author?.username || "Member",
              avatar_url: author?.avatar_url || undefined,
              is_verified: author?.is_verified,
              is_premium: Boolean(author?.is_premium),
              is_sponsor: author?.is_sponsor,
              is_team: author?.is_team_member,
              badge_id: author?.badge_id ?? null,
            },
            media_url: mediaUrls[0] || undefined,
            stats: {
              likes_count: post.like_count || 0,
              comments_count: post.comment_count || 0,
              shares_count: (post as any).share_count || 0,
            },
          }}
        />

        {/* Gift the author (members) */}
        {post.author?.id && currentUserId !== post.author.id && (
          <GiftModal
            open={giftOpen}
            onOpenChange={setGiftOpen}
            recipient={{
              id: post.author.id,
              username: post.author.username,
              display_name: post.author.display_name || post.author.username,
              avatar_url: (post.author as any).avatar_url,
              is_premium: Boolean((post.author as any).is_premium),
            }}
            context={{ type: "post", id: String(post.id) }}
          />
        )}

        {/* Full-screen media viewer (lightbox) */}
        {viewerOpen && mediaUrls.length > 0 && (() => {
          const vIdx = Math.min(viewerIndex, mediaUrls.length - 1)
          const vUrl = mediaUrls[vIdx]
          const vIsVideo = isVideoUrl(vUrl)
          const vStep = (dir: 1 | -1) => {
            setViewerIndex((prev) => (prev + dir + mediaUrls.length) % mediaUrls.length)
          }
          return (
            <div
              className="fixed inset-0 z-[120] flex flex-col bg-black/95 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label="Media viewer"
              onClick={() => setViewerOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setViewerOpen(false)
                if (e.key === "ArrowLeft") vStep(-1)
                if (e.key === "ArrowRight") vStep(1)
              }}
              tabIndex={-1}
              onTouchStart={(e) => {
                viewerTouchStartX.current = e.touches[0]?.clientX ?? null
              }}
              onTouchEnd={(e) => {
                if (viewerTouchStartX.current === null) return
                const dx = (e.changedTouches[0]?.clientX ?? viewerTouchStartX.current) - viewerTouchStartX.current
                viewerTouchStartX.current = null
                if (Math.abs(dx) > 48) vStep(dx < 0 ? 1 : -1)
              }}
            >
              {/* Top bar */}
              <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold backdrop-blur">
                  {vIdx + 1} / {mediaUrls.length}
                </span>
                <button
                  onClick={() => setViewerOpen(false)}
                  aria-label="Close viewer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Media */}
              <div
                className="relative flex min-h-0 flex-1 items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                {vIsVideo ? (
                  <video
                    src={vUrl}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-full max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <Image src={vUrl} alt="" fill className="object-contain" unoptimized />
                )}

                {mediaUrls.length > 1 && (
                  <>
                    <button
                      onClick={() => vStep(-1)}
                      aria-label="Previous media"
                      className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => vStep(1)}
                      aria-label="Next media"
                      className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {mediaUrls.length > 1 && (
                <div
                  className="flex items-center justify-center gap-2 p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {mediaUrls.map((u, i) => (
                    <button
                      key={u + i}
                      onClick={() => setViewerIndex(i)}
                      aria-label={`Go to media ${i + 1}`}
                      className={cn(
                        "relative h-12 w-12 overflow-hidden rounded-lg border-2 transition",
                        i === vIdx ? "border-indigo-500" : "border-white/10 opacity-50 hover:opacity-100"
                      )}
                    >
                      {isVideoUrl(u) ? (
                        <span className="flex h-full w-full items-center justify-center bg-slate-800 text-[9px] font-bold text-white">
                          VID
                        </span>
                      ) : (
                        <Image src={u} alt="" fill className="object-cover" unoptimized />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Comments */}
        {showComments && (
          <CommentThread
            communityId={communityId}
            postId={post.id}
            isMember={isMember}
            currentUserId={currentUserId}
            isModerator={isModerator}
            initialCommentCount={post.comment_count}
            onCommented={() => setExtraComments((c) => c + 1)}
          />
        )}
      </div>
    </div>
  )
}
