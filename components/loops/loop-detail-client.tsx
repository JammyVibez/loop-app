"use client"

import { ProtectedMedia } from "@/components/media-protection"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProxyImg } from "@/components/ui/proxy-img"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  TreePine,
  GitBranch,
  Eye,
  Tag,
  Flag,
  Copy,
  ExternalLink,
  Zap,
  Users,
  ChevronLeft,
  ChevronRight,
  Film,
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
    type: "image" | "video" | "gif"
    url: string
    thumbnail?: string
  }
  mediaUrls: string[]
  postType?: string
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

export function LoopDetailClient({ loopId }: { loopId: string }) {
  const [loop, setLoop] = useState<LoopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFullTree, setShowFullTree] = useState(false)
  const [branchOpen, setBranchOpen] = useState(false)
  const [chainOpen, setChainOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  const [reactions, setReactions] = useState<{ [emoji: string]: number }>({})
  const [activeReaction, setActiveReaction] = useState<string | null>(null)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

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
              type: (loopData.media_type === "video" ? "video" : "image") as "image" | "video",
              url: loopData.media_url,
            }
          : undefined,
        mediaUrls: mediaUrlsList,
        postType: loopData.post_type,
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

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  if (!loop) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center text-muted-foreground space-y-4">
        <h2 className="text-2xl font-bold">Loop Not Found</h2>
        <p className="text-sm text-muted-foreground">This loop may have been deleted or is private.</p>
        <Button asChild>
          <Link href="/explore">Explore Other Loops</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 text-foreground">
      {/* Loop Container */}
      <Card
        className={`border bg-card/80 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden ${
          loop.isCoLoop ? "border-cyan-500/40" : "border-border"
        }`}
      >
        <CardHeader className="p-6 border-b border-border">
          {loop.isCoLoop && (
            <div className="mb-3 flex items-center justify-between">
              <Badge className="bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-600 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-md shadow-cyan-500/20 border border-cyan-400/40 flex items-center gap-1">
                <Zap className="h-3 w-3 animate-pulse text-cyan-200" />
                Co-Loop Studio Collaboration
              </Badge>
              <button
                type="button"
                onClick={() => setRosterOpen(true)}
                className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                <Users className="h-3 w-3" />
                View {loop.coAuthors.length + 1} Co-Authors
              </button>
            </div>
          )}

          {/* Branch origin banner — who did you branch from? */}
          {loop.parentLoop && (
            <Link
              href={`/loop/${loop.parentLoop.id}`}
              className="mb-3 flex w-fit max-w-full items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-muted-foreground transition hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-foreground"
            >
              <GitBranch className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="truncate">
                Branch from{" "}
                {loop.parentLoop.author ? (
                  <span className="inline-flex items-center gap-1 font-bold text-foreground">
                    @{loop.parentLoop.author}
                    {loop.parentLoop.author_verified && <span className="font-bold text-blue-500">✓</span>}
                  </span>
                ) : (
                  <span className="font-bold text-foreground">a branched post</span>
                )}
                {loop.parentLoop.title && loop.parentLoop.title !== "Untitled Loop" ? (
                  <span className="text-muted-foreground"> · &ldquo;{(loop.parentLoop.title || "").slice(0, 40)}&rdquo;</span>
                ) : null}
              </span>
            </Link>
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {loop.isCoLoop ? (
                <div
                  onClick={() => setRosterOpen(true)}
                  className="flex items-center cursor-pointer group flex-shrink-0"
                  title="Click to view Co-Authors roster"
                >
                  <div className="relative z-10">
                    <VideoAvatar
                      src={loop.author.avatar}
                      videoSrc={loop.author.videoAvatarUrl}
                      alt={loop.author.displayName}
                      fallback={loop.author.displayName.charAt(0)}
                      size="lg"
                      className="ring-2 ring-cyan-500 ring-offset-2 ring-offset-background group-hover:scale-105 transition-transform"
                    />
                  </div>
                  {loop.coAuthors.slice(0, 3).map((ca, i) => (
                    <div key={ca.id || i} className="-ml-3 relative z-[9] transition-transform group-hover:scale-105" style={{ zIndex: 8 - i }}>
                      <VideoAvatar
                        src={ca.avatar_url}
                        videoSrc={(ca as any).video_avatar_url}
                        alt={ca.display_name || ca.username}
                        fallback={(ca.display_name || ca.username || "C").charAt(0)}
                        size="lg"
                        className="ring-2 ring-cyan-400 ring-offset-2 ring-offset-background"
                      />
                    </div>
                  ))}
                  {loop.coAuthors.length > 3 && (
                    <div className="-ml-3 relative z-0 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-950 text-xs font-bold text-cyan-300 ring-2 ring-cyan-400">
                      +{loop.coAuthors.length - 3}
                    </div>
                  )}
                </div>
              ) : (
                <Link href={`/profile/${loop.author.username}`} className="shrink-0">
                  <VideoAvatar
                    src={loop.author.avatar}
                    videoSrc={loop.author.videoAvatarUrl}
                    alt={loop.author.displayName}
                    fallback={loop.author.displayName.charAt(0)}
                    size="lg"
                    className="border-2 border-cyan-500/40"
                  />
                </Link>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/profile/${loop.author.username}`} className="font-bold text-lg text-foreground hover:underline">
                    {loop.author.displayName}
                  </Link>
                  {loop.isCoLoop && loop.coAuthors.length > 0 && (
                    <span className="text-muted-foreground font-normal text-sm">
                      {" "}
                      ×{" "}
                      {loop.coAuthors.map((ca, i) => (
                        <span key={ca.id || ca.username}>
                          {i > 0 ? " × " : null}
                          <Link href={`/profile/${ca.username}`} className="hover:underline text-primary">
                            @{ca.username}
                          </Link>
                        </span>
                      ))}
                    </span>
                  )}
                  {loop.author.verified && (
                    <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-[10px]">
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Link href={`/profile/${loop.author.username}`} className="hover:underline">@{loop.author.username}</Link>
                  <span>•</span>
                  <FreshnessTimestamp date={loop.createdAt} showIcon />
                  <span className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 text-[10px]">
                    <Zap className="h-3 w-3" /> Real-time active
                  </span>
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border text-foreground">
                <DropdownMenuItem onClick={handleBookmark}>
                  <Bookmark className="h-4 w-4 mr-2" /> {loop.isBookmarked ? "Remove Bookmark" : "Save Bookmark"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {loop.title ? (
            <h1 className="text-2xl font-extrabold text-foreground leading-tight">{loop.title}</h1>
          ) : null}
          <RichContent text={loop.content} className="text-base text-foreground leading-relaxed" />

          {/* Full Media Set Carousel */}
          {loop.mediaUrls && loop.mediaUrls.length > 0 && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-border bg-black/60 group max-h-[520px] flex items-center justify-center">
                {loop.mediaUrls[activeMediaIndex]?.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                  <ProtectedMedia type="video" src={loop.mediaUrls[activeMediaIndex]} className="w-full max-h-[520px] object-contain" />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={loop.mediaUrls[activeMediaIndex]}
                    alt={`${loop.title} - Media ${activeMediaIndex + 1}`}
                    className="w-full max-h-[520px] object-contain"
                  />
                )}

                {loop.mediaUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : loop.mediaUrls.length - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 text-white p-2 hover:bg-black/80 transition-all opacity-80 group-hover:opacity-100"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMediaIndex((prev) => (prev < loop.mediaUrls.length - 1 ? prev + 1 : 0))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 text-white p-2 hover:bg-black/80 transition-all opacity-80 group-hover:opacity-100"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/20">
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
                        className={`relative rounded-xl overflow-hidden border-2 h-16 w-16 shrink-0 transition-all ${
                          activeMediaIndex === idx
                            ? "border-cyan-500 scale-105 shadow-md shadow-cyan-500/30 ring-2 ring-cyan-500/50"
                            : "border-border opacity-60 hover:opacity-100"
                        }`}
                      >
                        {isVid ? (
                          <div className="flex h-full w-full items-center justify-center bg-slate-900 text-cyan-400">
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
              <div className="relative rounded-2xl overflow-hidden border border-border bg-black aspect-[9/16] max-h-[600px] mx-auto">
                <video
                  src={loop.mediaUrls[0]}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                  poster={loop.mediaUrls[1] || undefined}
                />
                <div className="absolute top-3 left-3">
                  <Badge className="bg-rose-500/90 text-white text-[10px] font-bold px-2 py-0.5 backdrop-blur-sm">
                    <Film className="h-3 w-3 mr-1" /> Reel
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Moment Card (disappearing content) */}
          {loop.postType === "moment" && (
            <div className="pt-2">
              <div className="relative rounded-2xl overflow-hidden border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-indigo-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-purple-500/20 text-purple-400 text-[10px] font-bold px-2 py-0.5">
                    Moment
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">Temporary content</span>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  This is a moment — it may disappear after being viewed.
                </p>
              </div>
            </div>
          )}

          {/* Co-Loop Invite Card */}
          {loop.postType === "co_loop_invite" && (
            <div className="pt-2">
              <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-teal-500/5 to-indigo-500/10 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-500/20 p-3">
                    <Users className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">Co-Loop Invite</p>
                    <p className="text-xs text-muted-foreground">Join this collaborative session</p>
                  </div>
                </div>
                {loop.contentMetadata?.session_id && (
                  <Button
                    asChild
                    size="sm"
                    className="mt-3 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-bold text-xs"
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
            <div className="flex flex-wrap gap-2 pt-2">
              {loop.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Interactive Reactions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-xs text-muted-foreground font-medium mr-2">Quick React:</span>
            {["🔥", "❤️", "🚀", "💡", "👏", "💯"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-all ${
                  activeReaction === emoji
                    ? "bg-primary/15 border-primary/40 text-foreground"
                    : "bg-muted border-border hover:bg-primary/10 hover:border-primary/30"
                }`}
              >
                <span>{emoji}</span>
                {reactions[emoji] ? (
                  <span className="text-[10px] font-bold text-primary">{reactions[emoji]}</span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Stats & Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={`gap-2 ${loop.isLiked ? "text-rose-500 bg-rose-500/10" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Heart className={`h-4 w-4 ${loop.isLiked ? "fill-rose-500" : ""}`} />
                <span className="font-semibold">{loop.stats.likes}</span>
              </Button>

              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <MessageCircle className="h-4 w-4" />
                <span className="font-semibold">{loop.stats.comments}</span>
              </div>

              <Button variant="ghost" size="sm" onClick={handleShare} className="gap-2 text-muted-foreground hover:text-foreground">
                <Share2 className="h-4 w-4" />
                <span>{loop.stats.shares}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleBookmark}
                className={`gap-2 ${loop.isBookmarked ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Bookmark className={`h-4 w-4 ${loop.isBookmarked ? "fill-current" : ""}`} />
                <span className="hidden sm:inline">{loop.isBookmarked ? "Saved" : "Save"}</span>
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 rounded-xl text-xs gap-1.5 font-bold"
                >
                  <GitBranch className="h-3.5 w-3.5" /> Branch / Chain
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border text-foreground">
                <DropdownMenuItem onClick={() => setBranchOpen(true)} className="cursor-pointer hover:bg-muted">
                  <GitBranch className="h-4 w-4 mr-2 text-green-400" /> Branch this Loop
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setChainOpen(true)} className="cursor-pointer hover:bg-muted">
                  <Zap className="h-4 w-4 mr-2 text-cyan-400" /> View Loop Chain Map
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Comments Section */}
      <CommentsSection loopId={loop.id} />

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
          <DialogContent className="border-border/60 bg-card text-foreground sm:max-w-md rounded-2xl p-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Zap className="h-5 w-5 text-cyan-400" />
                Co-Loop Contributors Roster
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
                <div className="flex items-center gap-3">
                  <VideoAvatar
                    src={loop.author.avatar}
                    videoSrc={loop.author.videoAvatarUrl}
                    alt={loop.author.displayName}
                    fallback={loop.author.displayName.charAt(0) || "A"}
                    size="md"
                    className="ring-2 ring-cyan-500"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-xs sm:text-sm">{loop.author.displayName}</p>
                      <Badge className="bg-cyan-500 text-[9px] font-bold px-1.5 py-0 text-black">CREATOR</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">@{loop.author.username}</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="rounded-xl text-xs h-8">
                  <Link href={`/profile/${loop.author.username}`}>Profile</Link>
                </Button>
              </div>

              {loop.coAuthors.map((ca, idx) => (
                <div
                  key={ca.id || idx}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    <VideoAvatar
                      src={ca.avatar_url}
                      videoSrc={(ca as any).video_avatar_url}
                      alt={ca.display_name || ca.username}
                      fallback={(ca.display_name || ca.username)?.charAt(0) || "C"}
                      size="md"
                      className="ring-2 ring-purple-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-xs sm:text-sm">{ca.display_name || ca.username}</p>
                        <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0">
                          {ca.role || "CO-AUTHOR"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">@{ca.username}</p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="rounded-xl text-xs h-8">
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
