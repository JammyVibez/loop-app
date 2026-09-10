"use client"

import { ProtectedMedia } from "@/components/media-protection"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProxyImg } from "@/components/ui/proxy-img"
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { cn } from "@/lib/utils"
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  GitBranch,
  Eye,
  Zap,
  Users,
  ChevronLeft,
  ChevronRight,
  Film,
  BadgeCheck,
  Copy,
  Volume2,
} from "lucide-react"
import { CommentsSection } from "@/components/comments/comments-section"
import { CreateBranchDialog } from "@/components/create-branch-dialog"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"
import { LoopChainDialog } from "@/components/loops/loop-chain-dialog"
import { PollCardWidget } from "@/components/polls/poll-card-widget"
import { LoopDuelCard } from "@/components/duels/loop-duel-card"
import { ClutchDuelCard } from "@/components/duels/clutch-duel-card"
import { RichContent } from "@/components/content/rich-content"
import { LoopDetailCodeBlock } from "@/components/loops/loop-detail-code-block"
import { LoopDetailBoostBar } from "@/components/loops/loop-detail-boost-bar"
import Link from "next/link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase"
import { absoluteAppUrl, shareContent } from "@/lib/share"

type CoAuthor = {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  role?: string
}

interface LoopData {
  id: string
  title: string
  content: string
  author: {
    id: string
    username: string
    displayName: string
    avatar: string
    videoAvatarUrl?: string | null
    verified: boolean
    premium: boolean
    equippedFrameId?: string | number | null
  }
  createdAt: string
  updatedAt: string
  stats: {
    likes: number
    comments: number
    shares: number
    views: number
    branches: number
  }
  tags: string[]
  parentLoop?: {
    id: string
    title: string
    author: string
    author_verified?: boolean
  }
  branches: Array<{
    id: string
    title: string
    author: string
    avatar: string
    createdAt: string
  }>
  media?: {
    type: "image" | "video" | "audio" | "gif"
    url: string
    thumbnail?: string
  }
  mediaUrls: string[]
  mediaType?: string
  postType?: string
  commentsDisabled?: boolean
  poll?: any
  duel?: any
  contentMetadata?: Record<string, any> | null
  codeSnippet?: {
    language: string
    code: string
  }
  isLiked: boolean
  isBookmarked: boolean
  isFollowing: boolean
  isCoLoop: boolean
  coAuthors: CoAuthor[]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
)

const formatCompact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return `${n}`
}

export function LoopDetailClient({ loopId }: { loopId: string }) {
  const [loop, setLoop] = useState<LoopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFullTree, setShowFullTree] = useState(false)
  const [branchOpen, setBranchOpen] = useState(false)
  const [chainOpen, setChainOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  const [reactions, setReactions] = useState<{ [emoji: string]: number }>({})
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [activeReaction, setActiveReaction] = useState<string | null>(null)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const fetchLoop = useCallback(async () => {
    try {
      const response = await fetch(`/api/loops/${loopId}`, {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.loop) {
        setLoop(null)
        return
      }

      const loopData = data.loop
      const mediaUrlsList: string[] = Array.isArray(loopData.media_urls) && loopData.media_urls.length > 0
        ? loopData.media_urls
        : loopData.media_url
        ? [loopData.media_url]
        : []

      setLoop({
        id: loopData.id,
        title: loopData.content_title || "",
        content: loopData.content || "",
        author: {
          id: loopData.author?.id || "",
          username: loopData.author?.username || "",
          displayName: loopData.author?.display_name || "",
          avatar: loopData.author?.avatar_url || null,
          videoAvatarUrl: loopData.author?.video_avatar_url || null,
          verified: Boolean(loopData.author?.is_verified),
          premium: Boolean(loopData.author?.is_premium),
          equippedFrameId: loopData.author?.equipped_frame_id || null,
        },
        createdAt: loopData.created_at,
        updatedAt: loopData.updated_at || loopData.created_at,
        stats: {
          likes: Number(loopData.stats?.likes_count || 0),
          comments: Number(loopData.stats?.comments_count || 0),
          shares: Number(loopData.stats?.shares_count || 0),
          views: Number(loopData.stats?.views_count || 0),
          branches: Number(loopData.stats?.branches_count || data.branches?.length || 0),
        },
        tags: Array.isArray(loopData.hashtags) ? loopData.hashtags : [],
        parentLoop: data.parentLoop || undefined,
        branches: Array.isArray(data.branches) ? data.branches : [],
        media: loopData.media_url
          ? {
              type: (loopData.media_type === "audio" ? "audio" : loopData.media_type === "video" ? "video" : "image") as "image" | "video" | "audio",
              url: loopData.media_url,
            }
          : undefined,
        mediaUrls: mediaUrlsList,
        mediaType: loopData.media_type || undefined,
        postType: loopData.post_type,
        commentsDisabled: Boolean((loopData as any).comments_disabled),
        poll: loopData.poll,
        duel: loopData.duel,
        contentMetadata: loopData.content_metadata || null,
        codeSnippet:
          loopData.content_metadata?.is_code && loopData.content_metadata?.code
            ? { language: loopData.content_metadata.language || "text", code: loopData.content_metadata.code }
            : undefined,
        isLiked: Boolean(loopData.user_interactions?.is_liked),
        isBookmarked: Boolean(loopData.user_interactions?.is_saved),
        isFollowing: false,
        isCoLoop: Boolean(loopData.is_co_loop),
        coAuthors: Array.isArray(loopData.co_authors) ? loopData.co_authors : [],
      })

      // Load persisted Quick React counts + current user's reaction
      try {
        const reactRes = await fetch(`/api/loops/${loopId}/reactions`, {
          headers: user ? { Authorization: `Bearer ${user.access_token || user.token || ""}` } : undefined,
          cache: "no-store",
        })
        if (reactRes.ok) {
          const reactData = await reactRes.json()
          setReactions(reactData.reactions || {})
          setActiveReaction(reactData.my_reaction || null)
        }
      } catch {
        /* soft-fail if reactions table missing */
      }
    } catch (error) {
      console.error("Failed to load loop:", error)
      setLoop(null)
    } finally {
      setLoading(false)
    }
  }, [loopId, user?.id])

  useEffect(() => {
    if (loopId) void fetchLoop()
  }, [loopId, fetchLoop])

  // Follow state — fetch once the author is known (skipped for own posts).
  useEffect(() => {
    if (!loop || !user || loop.author.id === user.id) {
      setIsFollowingAuthor(false)
      return
    }
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(`/api/users/follow?target_user_id=${loop.author.id}`, {
          headers: { ...getAuthHeader() },
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setIsFollowingAuthor(Boolean(data.is_following))
      } catch {}
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [loop?.author.id, user?.id])

  const handleFollowToggle = async () => {
    if (!user || !loop || followLoading) return
    if (loop.author.id === user.id) return
    setFollowLoading(true)
    const next = !isFollowingAuthor
    // Optimistic flip
    setIsFollowingAuthor(next)
    try {
      const res = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ target_user_id: loop.author.id, action: next ? "follow" : "unfollow" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed")
      setIsFollowingAuthor(Boolean(data.is_following))
      toast({
        title: data.requires_approval ? "Request sent" : next ? "Following" : "Unfollowed",
        description: data.requires_approval
          ? `We'll notify you when @${loop.author.username} approves.`
          : undefined,
      })
    } catch (err: any) {
      setIsFollowingAuthor(!next)
      toast({ title: "Action failed", description: err.message, variant: "destructive" })
    } finally {
      setFollowLoading(false)
    }
  }

  // Real-time Supabase subscription for live likes, comments, & reactions
  useEffect(() => {
    if (!loopId) return

    const channel = supabase
      .channel(`loop_page:${loopId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loops", filter: `id=eq.${loopId}` },
        (payload) => {
          const updated = payload.new as any
          if (updated) {
            setLoop((prev) =>
              prev
                ? {
                    ...prev,
                    stats: {
                      ...prev.stats,
                      likes: updated.likes_count ?? prev.stats.likes,
                      comments: updated.comments_count ?? prev.stats.comments,
                      shares: updated.shares_count ?? prev.stats.shares,
                    },
                  }
                : null
            )
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `loop_id=eq.${loopId}` },
        () => {
          setLoop((prev) =>
            prev ? { ...prev, stats: { ...prev.stats, comments: prev.stats.comments + 1 } } : null
          )
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "loops", filter: `id=eq.${loopId}` },
        () => {
          // The post was deleted (author/admin) while someone is viewing it —
          // switch to the "removed" state immediately instead of waiting for
          // a refresh.
          setLoop(null)
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loop_stats", filter: `loop_id=eq.${loopId}` },
        (payload) => {
          const stats = payload.new as any
          if (!stats) return
          setLoop((prev) =>
            prev
              ? {
                  ...prev,
                  stats: {
                    ...prev.stats,
                    likes: stats.likes_count ?? prev.stats.likes,
                    comments: stats.comments_count ?? prev.stats.comments,
                    shares: stats.shares_count ?? prev.stats.shares,
                  },
                }
              : null
          )
        }
      )
      .on("broadcast", { event: "reaction" }, (payload) => {
        if (payload.payload?.emoji) {
          setReactions((prev) => ({
            ...prev,
            [payload.payload.emoji]: (prev[payload.payload.emoji] || 0) + 1,
          }))
        }
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loopId])

  const handleLike = async () => {
    if (!loop || !user) return

    const previous = { isLiked: loop.isLiked, likes: loop.stats.likes }
    const newIsLiked = !loop.isLiked
    const newLikeCount = newIsLiked ? loop.stats.likes + 1 : Math.max(0, loop.stats.likes - 1)

    setLoop((prev) =>
      prev
        ? {
            ...prev,
            isLiked: newIsLiked,
            stats: { ...prev.stats, likes: newLikeCount },
          }
        : null,
    )

    try {
      const res = await fetch(`/api/loops/${loopId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ interaction_type: "like" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Like failed")
      }
      const liked = Boolean(data.is_liked ?? data.is_active)
      setLoop((prev) =>
        prev
          ? {
              ...prev,
              isLiked: liked,
              stats: {
                ...prev.stats,
                likes: Number(data.stats?.likes_count ?? prev.stats.likes),
              },
            }
          : null,
      )
    } catch (error) {
      console.error("Failed to toggle like:", error)
      setLoop((prev) =>
        prev
          ? {
              ...prev,
              isLiked: previous.isLiked,
              stats: { ...prev.stats, likes: previous.likes },
            }
          : null,
      )
      toast({ title: "Couldn't update like", description: "Try again", variant: "destructive" })
    }
  }

  const handleReaction = async (emoji: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Log in to react to loops." })
      return
    }

    const prevReactions = { ...reactions }
    const prevActive = activeReaction

    setReactions((prev) => {
      const copy = { ...prev }
      if (activeReaction === emoji) {
        copy[emoji] = Math.max(0, (copy[emoji] || 0) - 1)
        if (copy[emoji] === 0) delete copy[emoji]
      } else {
        if (activeReaction && copy[activeReaction]) {
          copy[activeReaction] = Math.max(0, (copy[activeReaction] || 0) - 1)
          if (copy[activeReaction] === 0) delete copy[activeReaction]
        }
        copy[emoji] = (copy[emoji] || 0) + 1
      }
      return copy
    })
    setActiveReaction(activeReaction === emoji ? null : emoji)

    try {
      const res = await fetch(`/api/loops/${loopId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ emoji }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data.error || "Reaction failed")
      setReactions(data.reactions || {})
      setActiveReaction(data.my_reaction || null)
    } catch (error: any) {
      setReactions(prevReactions)
      setActiveReaction(prevActive)
      toast({
        title: "Couldn't save reaction",
        description: error?.message || "Try again",
        variant: "destructive",
      })
    }
  }

  const handleBookmark = async () => {
    if (!loop || !user) return

    const previous = loop.isBookmarked
    const next = !previous
    setLoop((prev) => (prev ? { ...prev, isBookmarked: next } : null))

    try {
      const res = await fetch(`/api/loops/${loopId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ interaction_type: "save" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.success === false) throw new Error(data.error || "Bookmark failed")
      const saved = Boolean(data.is_saved ?? data.is_active)
      setLoop((prev) => (prev ? { ...prev, isBookmarked: saved } : null))
      toast({
        title: saved ? "Saved to Bookmarks" : "Removed from Bookmarks",
        description: saved ? "Find it anytime in Bookmarks." : undefined,
      })
    } catch (error) {
      console.error("Failed to toggle bookmark:", error)
      setLoop((prev) => (prev ? { ...prev, isBookmarked: previous } : null))
      toast({ title: "Couldn't update bookmark", variant: "destructive" })
    }
  }

  const handleCopyLink = async () => {
    const url = absoluteAppUrl(`/loop/${loopId}`)
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: "Link copied", description: "Loop URL copied to clipboard" })
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" })
    }
  }

  const handleShare = async () => {
    const url = absoluteAppUrl(`/loop/${loopId}`)
    const result = await shareContent({
      title: loop?.title || "Loop",
      text: loop?.content?.slice(0, 120) || "Check out this loop",
      url,
    })
    if (result === "copied") {
      toast({ title: "Link copied", description: "Loop URL copied to clipboard" })
    }
    if (user && (result === "shared" || result === "copied")) {
      try {
        await fetch(`/api/loops/${loopId}/interactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ interaction_type: "share" }),
        })
      } catch {
        /* non-blocking */
      }
    }
  }

  const handleCommentClick = () => {
    document.getElementById("comments")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
        <div className="h-72 animate-pulse rounded-3xl bg-muted/60" />
        <div className="h-40 animate-pulse rounded-3xl bg-muted/40" />
      </div>
    )
  }

  if (!loop) {
    return (
      <div className="mx-auto w-full max-w-3xl p-8 text-center text-muted-foreground space-y-4">
        <h2 className="text-2xl font-bold">Loop Not Found</h2>
        <p className="text-sm text-muted-foreground">This loop may have been deleted or is private.</p>
        <Button asChild>
          <Link href="/explore">Explore Other Loops</Link>
        </Button>
      </div>
    )
  }

  const postTypePill = (() => {
    switch (loop.postType) {
      case "reel":
        return { label: "Reel", className: "border-rose-500/30 bg-rose-500/10 text-rose-400" }
      case "poll":
        return { label: "Poll", className: "border-violet-500/30 bg-violet-500/10 text-violet-400" }
      case "duel":
        return {
          label: loop.duel?.duel_type === "clutch" ? "Clutch Duel" : "Duel",
          className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        }
      case "moment":
        return { label: "Moment", className: "border-purple-500/30 bg-purple-500/10 text-purple-400" }
      case "co_loop_invite":
        return { label: "Co-Loop", className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" }
      case "clip":
        return { label: "Clip", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" }
      default:
        return null
    }
  })()

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-4 sm:py-4">
      {/* Back button */}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            window.history.back()
          } else {
            router.push("/")
          }
        }}
        className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>
      {/* Loop Container */}
      <Card className="relative overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm">
        {/* subtle top highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <CardHeader className="border-b border-border/30 p-3 sm:p-4">
          {loop.isCoLoop && (              <div className="mb-2 flex items-center justify-between gap-3">
              <Badge className="flex items-center gap-1 border-cyan-400/30 bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 px-2.5 py-1 text-[10px] font-bold text-cyan-300">
                <Zap className="h-3 w-3" />
                Co-Loop Studio Collaboration
              </Badge>
              <button
                type="button"
                onClick={() => setRosterOpen(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 transition hover:text-cyan-300"
              >
                <Users className="h-3.5 w-3.5" />
                View {loop.coAuthors.length + 1} co-authors
              </button>
            </div>
          )}

          {/* Branch origin banner — who did you branch from? */}
          {loop.parentLoop && (
            <Link
              href={`/loop/${loop.parentLoop.id}`}
              className="mb-2 flex w-fit max-w-full items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-foreground"
            >
              <GitBranch className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="truncate">
                Branch from{" "}
                {loop.parentLoop.author ? (
                  <span className="inline-flex items-center gap-1 font-bold text-foreground">
                    @{loop.parentLoop.author}
                    {loop.parentLoop.author_verified && <BadgeCheck className="h-3.5 w-3.5 fill-sky-500 text-background" />}
                  </span>
                ) : (
                  <span className="font-bold text-foreground">a branched post</span>
                )}
              </span>
            </Link>
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              {loop.isCoLoop ? (
                <div
                  onClick={() => setRosterOpen(true)}
                  className="flex cursor-pointer items-center"
                  title="Click to view Co-Authors roster"
                >
                  <div className="relative z-10">
                    <AvatarWithFrame
                      avatarUrl={loop.author.avatar}
                      videoAvatarUrl={loop.author.videoAvatarUrl}
                      frameId={loop.author.equippedFrameId}
                      seed={loop.author.username}
                      alt={loop.author.displayName}
                      size={48}
                      className="rounded-full ring-2 ring-cyan-400/60 ring-offset-2 ring-offset-background transition-transform group-hover:scale-105"
                    />
                  </div>
                  {loop.coAuthors.slice(0, 3).map((ca, i) => (
                    <div key={ca.id || i} className="-ml-3 relative z-[9]" style={{ zIndex: 8 - i }}>
                      <VideoAvatar
                        src={ca.avatar_url}
                        videoSrc={(ca as any).video_avatar_url}
                        alt={ca.display_name || ca.username}
                        fallback={(ca.display_name || ca.username || "C").charAt(0)}
                        size="lg"
                        className="ring-2 ring-cyan-400/60 ring-offset-2 ring-offset-background"
                      />
                    </div>
                  ))}
                  {loop.coAuthors.length > 3 && (
                    <div className="-ml-3 relative z-0 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-950 text-xs font-bold text-cyan-300 ring-2 ring-cyan-400/60">
                      +{loop.coAuthors.length - 3}
                    </div>
                  )}
                </div>
              ) : (
                <Link href={`/profile/${loop.author.username}`} className="shrink-0 transition-opacity hover:opacity-90">
                  <AvatarWithFrame
                    avatarUrl={loop.author.avatar}
                    videoAvatarUrl={loop.author.videoAvatarUrl}
                    frameId={loop.author.equippedFrameId}
                    seed={loop.author.username}
                    alt={loop.author.displayName}
                    size={48}
                    className="rounded-full ring-1 ring-white/10"
                  />
                </Link>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <Link
                    href={`/profile/${loop.author.username}`}
                    className="truncate text-[15px] font-bold text-foreground transition hover:underline"
                  >
                    {loop.author.displayName}
                  </Link>
                  {loop.author.verified && (
                    <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-background" />
                  )}
                  {loop.author.premium && (
                    <span className="inline-flex items-center rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-1.5 py-px text-[9px] font-extrabold tracking-wider text-black">
                      PRO
                    </span>
                  )}
                  {loop.isCoLoop && loop.coAuthors.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ×{" "}
                      {loop.coAuthors.map((ca, i) => (
                        <span key={ca.id || ca.username}>
                          {i > 0 ? " × " : null}
                          <Link href={`/profile/${ca.username}`} className="font-semibold text-primary hover:underline">
                            @{ca.username}
                          </Link>
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <Link href={`/profile/${loop.author.username}`} className="hover:underline">
                    @{loop.author.username}
                  </Link>
                  <span className="text-border-foreground/30">·</span>
                  <FreshnessTimestamp date={loop.createdAt} showIcon />
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {formatCompact(loop.stats.views)} views
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {user && loop.author.id !== user.id && (
                <Button
                  size="sm"
                  disabled={followLoading}
                  onClick={handleFollowToggle}
                  className={cn(
                    "h-8 rounded-full px-3.5 text-xs font-bold transition-all",
                    isFollowingAuthor
                      ? "border border-border bg-transparent text-foreground hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                      : "bg-foreground text-background hover:bg-foreground/90",
                  )}
                >
                  {followLoading ? "..." : isFollowingAuthor ? "Following" : "Follow"}
                </Button>
              )}
              {postTypePill && (
                <Badge
                  variant="outline"
                  className={cn("px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", postTypePill.className)}
                >
                  {postTypePill.label}
                </Badge>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-border bg-popover text-foreground">
                  <DropdownMenuItem onClick={handleBookmark} className="cursor-pointer">
                    <Bookmark className="h-4 w-4 mr-2" /> {loop.isBookmarked ? "Remove Bookmark" : "Save Bookmark"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
                    <Copy className="h-4 w-4 mr-2" /> Copy Link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-3 sm:p-4">
          {loop.title ? (
            <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">{loop.title}</h1>
          ) : null}
          <RichContent text={loop.content} className="text-[15px] leading-relaxed text-foreground/90" />

          {/* Full Media Set Carousel */}
          {loop.mediaUrls && loop.mediaUrls.length > 0 && (
            <div className="space-y-3">
              <div className="group relative flex max-h-[520px] items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-black/70">
                {(() => {
                  const currentUrl = loop.mediaUrls[activeMediaIndex] || ""
                  const isVideo = /\.(mp4|webm|ogg|mov|m4v|m3u8)$/i.test(currentUrl) || /video/.test(loop.mediaType || "")
                  const isAudio = /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(currentUrl) || loop.mediaType === "audio"

                  if (isAudio) {
                    return (
                      <div className="flex w-full flex-col items-center gap-4 p-8">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-500/30 ring-2 ring-violet-500/40">
                          <Volume2 className="h-10 w-10 text-violet-300" />
                        </div>
                        <audio
                          controls
                          controlsList="nodownload"
                          className="w-full max-w-md rounded-xl"
                          src={currentUrl}
                          preload="metadata"
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          Your browser does not support audio playback.
                        </audio>
                      </div>
                    )
                  }

                  if (isVideo) {
                    return <ProtectedMedia type="video" src={currentUrl} className="max-h-[520px] w-full object-contain" />
                  }

                  return (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={currentUrl}
                      alt={`${loop.title} - Media ${activeMediaIndex + 1}`}
                      className="max-h-[520px] w-full object-contain"
                    />
                  )
                })()}

                {loop.mediaUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : loop.mediaUrls.length - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/10 p-2 text-white opacity-0 backdrop-blur-md transition-all hover:bg-white/20 group-hover:opacity-100"
                      aria-label="Previous media"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMediaIndex((prev) => (prev < loop.mediaUrls.length - 1 ? prev + 1 : 0))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/10 p-2 text-white opacity-0 backdrop-blur-md transition-all hover:bg-white/20 group-hover:opacity-100"
                      aria-label="Next media"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
                      {activeMediaIndex + 1} / {loop.mediaUrls.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail Strip */}
              {loop.mediaUrls.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {loop.mediaUrls.map((url, idx) => {
                    const isVid = url.match(/\.(mp4|webm|ogg|mov)$/i)
                    return (
                      <button
                        key={url + idx}
                        type="button"
                        onClick={() => setActiveMediaIndex(idx)}
                        className={cn(
                          "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all",
                          activeMediaIndex === idx
                            ? "scale-105 border-violet-500/70 shadow-md shadow-violet-500/20"
                            : "border-border/60 opacity-60 hover:opacity-100"
                        )}
                      >
                        {isVid ? (
                          <div className="flex h-full w-full items-center justify-center bg-slate-900 text-violet-400">
                            <Film className="h-5 w-5" />
                          </div>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <ProxyImg src={url} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Code Snippet Block */}
          {loop.codeSnippet && (
            <div className="pt-2">
              <LoopDetailCodeBlock
                language={loop.codeSnippet.language}
                code={loop.codeSnippet.code}
                title={loop.contentMetadata?.code_filename}
              />
            </div>
          )}

          {/* Boost / Funding Progress Bar */}
          <LoopDetailBoostBar loopId={loop.id} />

          {/* Reel Video Player */}
          {loop.postType === "reel" && loop.mediaUrls.length > 0 && (
            <div className="pt-2">
              <div className="relative mx-auto aspect-[9/16] max-h-[600px] overflow-hidden rounded-2xl border border-border/60 bg-black">
                <video
                  src={loop.mediaUrls[0]}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                  poster={loop.mediaUrls[1] || undefined}
                />
                <div className="absolute left-3 top-3">
                  <Badge className="bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                    <Film className="h-3 w-3 mr-1" /> Reel
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Moment Card (disappearing content) */}
          {loop.postType === "moment" && (
            <div className="pt-2">
              <div className="rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-500/[0.08] via-transparent to-indigo-500/[0.08] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge className="bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-400">Moment</Badge>
                  <span className="text-[11px] text-muted-foreground">Temporary content</span>
                </div>
                <p className="text-xs italic text-muted-foreground">This is a moment — it may disappear after being viewed.</p>
              </div>
            </div>
          )}

          {/* Co-Loop Invite Card */}
          {loop.postType === "co_loop_invite" && (
            <div className="pt-2">
              <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.08] via-transparent to-indigo-500/[0.08] p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-500/15 p-3">
                    <Users className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Co-Loop Invite</p>
                    <p className="text-xs text-muted-foreground">Join this collaborative session</p>
                  </div>
                </div>
                {loop.contentMetadata?.session_id && (
                  <Button
                    asChild
                    size="sm"
                    className="mt-3 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-xs font-bold text-white"
                  >
                    <Link href={`/coloop?session=${loop.contentMetadata.session_id}`}>
                      <Zap className="h-3.5 w-3.5 mr-1.5" /> Join Co-Loop Session
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Poll Full Widget Rendering */}
          {(loop.postType === "poll" || loop.poll) && (
            <div className="pt-2">
              <PollCardWidget loopId={loop.id} poll={loop.poll} />
            </div>
          )}

          {/* Duel Full Widget Rendering — Clutch Duels get the themed gaming card */}
          {(loop.postType === "duel" || loop.duel) &&
            (loop.duel?.duel_type === "clutch" ? (
              <div className="pt-2">
                <ClutchDuelCard loopId={loop.id} duel={loop.duel} />
              </div>
            ) : (
              <div className="pt-2">
                <LoopDuelCard loopId={loop.id} duel={loop.duel} />
              </div>
            ))}

          {/* Tags */}
          {loop.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {loop.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/explore?q=%23${encodeURIComponent(tag)}`}
                  className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-foreground"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Interactive Reactions */}
          <div className="flex flex-wrap items-center gap-1 border-t border-border/30 pt-3">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">React</span>
            {["🔥", "❤️", "🚀", "💡", "👏", "💯"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-all hover:scale-105",
                  activeReaction === emoji
                    ? "border-violet-500/50 bg-violet-500/15"
                    : "border-border/60 bg-muted/40 hover:border-violet-500/30 hover:bg-violet-500/10"
                )}
              >
                <span>{emoji}</span>
                {reactions[emoji] ? (
                  <span className="text-[10px] font-bold text-primary">{formatCompact(reactions[emoji])}</span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Stats & Actions — segmented social bar */}
          <div className="grid grid-cols-5 divide-x divide-border/40 overflow-hidden rounded-xl border border-border/40 bg-muted/20">
            <button
              type="button"
              onClick={handleLike}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 text-sm transition-colors",
                loop.isLiked ? "bg-rose-500/10 text-rose-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Heart className={cn("h-4 w-4", loop.isLiked && "fill-rose-500")} />
              <span className="font-semibold">{formatCompact(loop.stats.likes)}</span>
            </button>

            <button
              type="button"
              onClick={handleCommentClick}
              className="flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="font-semibold">{formatCompact(loop.stats.comments)}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Share2 className="h-4 w-4" />
              <span className="font-semibold">{formatCompact(loop.stats.shares)}</span>
            </button>

            <button
              type="button"
              onClick={handleBookmark}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 text-sm transition-colors",
                loop.isBookmarked
                  ? "bg-sky-500/10 text-sky-500"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Bookmark className={cn("h-4 w-4", loop.isBookmarked && "fill-current")} />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <GitBranch className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-border bg-popover text-foreground">
                <DropdownMenuItem onClick={() => setBranchOpen(true)} className="cursor-pointer hover:bg-muted">
                  <GitBranch className="h-4 w-4 mr-2 text-emerald-400" /> Branch this Loop
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setChainOpen(true)} className="cursor-pointer hover:bg-muted">
                  <Zap className="h-4 w-4 mr-2 text-violet-400" /> View Loop Chain Map
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Comments Section */}
      <section id="comments" className="mt-4 scroll-mt-20">
        <CommentsSection loopId={loop.id} commentsDisabled={loop.commentsDisabled} />
      </section>

      {/* Branch Loop Dialog */}
      <CreateBranchDialog
        open={branchOpen}
        onOpenChange={setBranchOpen}
        parentLoop={loop}
      />

      {/* Visual Loop Chain Tree Map Dialog */}
      <LoopChainDialog
        loopId={loop.id}
        open={chainOpen}
        onOpenChange={setChainOpen}
      />

      {/* Co-Loop Contributors Roster Dialog */}
      {loop.isCoLoop && (
        <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
          <DialogContent className="rounded-3xl border-border/60 bg-card p-5 text-foreground sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Zap className="h-5 w-5 text-cyan-400" />
                Co-Loop Contributors Roster
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.08] p-3">
                <div className="flex items-center gap-3">
                  <AvatarWithFrame
                    avatarUrl={loop.author.avatar}
                    videoAvatarUrl={loop.author.videoAvatarUrl}
                    frameId={loop.author.equippedFrameId}
                    seed={loop.author.username}
                    alt={loop.author.displayName}
                    size={40}
                    className="rounded-full ring-2 ring-cyan-400/60"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold sm:text-sm">{loop.author.displayName}</p>
                      <Badge className="bg-cyan-500 px-1.5 py-0 text-[9px] font-bold text-black">CREATOR</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">@{loop.author.username}</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="h-8 rounded-xl text-xs">
                  <Link href={`/profile/${loop.author.username}`}>Profile</Link>
                </Button>
              </div>

              {loop.coAuthors.map((ca, idx) => (
                <div
                  key={ca.id || idx}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    <VideoAvatar
                      src={ca.avatar_url}
                      videoSrc={(ca as any).video_avatar_url}
                      alt={ca.display_name || ca.username}
                      fallback={(ca.display_name || ca.username)?.charAt(0) || "C"}
                      size="md"
                      className="ring-2 ring-violet-500/60"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold sm:text-sm">{ca.display_name || ca.username}</p>
                        <Badge variant="secondary" className="px-1.5 py-0 text-[9px] font-bold">
                          {ca.role || "CO-AUTHOR"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">@{ca.username}</p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="h-8 rounded-xl text-xs">
                    <Link href={`/profile/${ca.username}`}>Profile</Link>
                  </Button>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" className="w-full rounded-xl" onClick={() => setRosterOpen(false)}>
                Close Roster
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}