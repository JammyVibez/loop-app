"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, MessageSquare, Gift, TrendingUp } from "lucide-react"
import { CommunityPostCard } from "@/components/communities/post-cards/community-post-card"
import type { CommunityPost } from "@/components/communities/post-cards/post-actions"
import { CommentThread } from "@/components/communities/post-cards/comment-thread"
import { GiftModal } from "@/components/gifting/gift-modal"
import { useAuth } from "@/hooks/use-auth"
import { Spinner } from "@/components/ui/skeletons"
import { VerifiedSeal } from "@/components/ui/verified-seal"

/**
 * Community post detail — the full-page view behind each post card.
 * Reuses CommunityPostCard for consistent rendering, keeps the comment
 * thread open, and adds a gift-the-author action in the header.
 */
export function CommunityPostDetail({ communityId, postId }: { communityId: string; postId: string }) {
  const { user, getAuthHeader } = useAuth()
  const router = useRouter()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [circle, setCircle] = useState<{ name: string } | null>(null)
  const [spaces, setSpaces] = useState<Array<{ id: string | number; name: string }>>([])
  const [isMember, setIsMember] = useState(false)
  const [isModerator, setIsModerator] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [liking, setLiking] = useState(false)
  const [giftOpen, setGiftOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/circles/${communityId}/posts/${postId}`, {
        headers: user ? getAuthHeader() : undefined,
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Post not found")

      // Normalize the row into the CommunityPost shape the card expects.
      const row = data.post
      const author = Array.isArray(row.author) ? row.author[0] : row.author
      const normalized: CommunityPost = {
        ...row,
        author,
        like_count: Number(row.like_count || 0),
        comment_count: Number(row.comment_count || 0),
      }
      setPost(normalized)

      // Community context for the header + membership gating
      const [circleRes, spacesRes, memberRes] = await Promise.all([
        fetch(`/api/circles/${communityId}`),
        fetch(`/api/communities/${communityId}/spaces`).catch(() => null),
        user
          ? fetch(`/api/circles/${communityId}/members?user_id=${user.id}`, { headers: getAuthHeader() }).catch(() => null)
          : Promise.resolve(null),
      ])
      if (circleRes.ok) {
        const cd = await circleRes.json()
        setCircle({ name: cd.circle?.name || cd.name || "Community" })
      }
      if (spacesRes && spacesRes.ok) {
        const sd = await spacesRes.json()
        setSpaces(sd.spaces || [])
      }
      if (memberRes && memberRes.ok) {
        const md = await memberRes.json()
        const membership = md.members?.[0] || md.member || null
        const role = membership?.role || membership?.status
        setIsMember(Boolean(membership))
        setIsModerator(role === "owner" || role === "admin" || role === "moderator")
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [communityId, postId, user, getAuthHeader])

  useEffect(() => {
    load()
  }, [load])

  const handleLike = async (id: number) => {
    if (!user || liking) return
    setLiking(true)
    // Optimistic
    setPost((prev: CommunityPost | null) =>
      prev ? { ...prev, is_liked: !prev.is_liked, like_count: (prev.like_count || 0) + (prev.is_liked ? -1 : 1) } : prev,
    )
    try {
      await fetch(`/api/circles/${communityId}/posts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ action: "like" }),
      })
    } catch {
      load()
    } finally {
      setLiking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <p className="mb-1 text-lg font-semibold">This post isn&apos;t available</p>
        <p className="mb-5 text-sm text-muted-foreground">{error || "It may have been removed."}</p>
        <Link href={`/communities/${communityId}`} className="text-sm font-semibold text-primary hover:underline">
          Back to the community
        </Link>
      </div>
    )
  }

  const author = post.author

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        {circle && (
          <Link
            href={`/communities/${communityId}`}
            className="min-w-0 truncate text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            {circle.name}
          </Link>
        )}
      </div>

      {/* Author summary header */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <Link href={`/profile/${author?.username}`} className="flex min-w-0 items-center gap-2.5">
          <span className="text-sm font-bold hover:underline">{author?.display_name || author?.username}</span>
          {author?.is_verified && <VerifiedSeal size={16} title="Verified Creator" />}
          <span className="truncate text-xs text-muted-foreground">@{author?.username}</span>
        </Link>
        {user && author?.id !== user.id && author?.id && (
          <button
            type="button"
            onClick={() => setGiftOpen(true)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-500 px-3 text-xs font-bold text-white transition hover:opacity-90"
          >
            <Gift className="h-3.5 w-3.5" />
            Gift
          </button>
        )}
      </div>

      {/* The post — same card component as the feed, detail context */}
      <CommunityPostCard
        post={post}
        communityId={communityId}
        spaces={spaces}
        isMember={isMember}
        isModerator={isModerator}
        currentUserId={user?.id}
        onLike={handleLike}
        liking={liking ? post.id : null}
      />

      {/* Comments — always open on the detail page */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Comments
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {post.comment_count || 0}
          </span>
        </h2>
        <CommentThread
          communityId={communityId}
          postId={post.id}
          isMember={isMember}
          currentUserId={user?.id}
          isModerator={isModerator}
          initialCommentCount={post.comment_count}
          onCommented={() =>
            setPost((prev: CommunityPost | null) => (prev ? { ...prev, comment_count: (prev.comment_count || 0) + 1 } : prev))
          }
        />
      </div>

      {/* Gift modal — gifts a giftable shop item to the post author */}
      {author?.id && (
        <GiftModal
          open={giftOpen}
          onOpenChange={setGiftOpen}
          recipient={{
            id: author.id,
            username: author.username || "",
            display_name: author.display_name || author.username || "Member",
            avatar_url: author.avatar_url || undefined,
            is_premium: author.is_premium,
          }}
          context={{ type: "post", id: String(post.id), title: post.content?.slice(0, 40) }}
        />
      )}
    </div>
  )
}
