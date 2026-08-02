"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  Sparkles,
} from "lucide-react"
import { CommentsSection } from "@/components/comments/comments-section"
import { CreateBranchDialog } from "@/components/create-branch-dialog"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"
import { LoopChainDialog } from "@/components/loops/loop-chain-dialog"
import Link from "next/link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@supabase/supabase-js"

interface LoopData {
  id: string
  title: string
  content: string
  author: {
    id: string
    username: string
    displayName: string
    avatar: string
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
  codeSnippet?: {
    language: string
    code: string
  }
  isLiked: boolean
  isBookmarked: boolean
  isFollowing: boolean
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
  const [reactions, setReactions] = useState<{ [emoji: string]: number }>({})
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
      setLoop({
        id: loopData.id,
        title: loopData.content_title || "Untitled Loop",
        content: loopData.content || "",
        author: {
          id: loopData.author?.id || "",
          username: loopData.author?.username || "",
          displayName: loopData.author?.display_name || "",
          avatar: loopData.author?.avatar_url || "/placeholder.svg",
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
        isLiked: Boolean(loopData.user_interactions?.is_liked),
        isBookmarked: Boolean(loopData.user_interactions?.is_saved),
        isFollowing: false,
      })
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

    try {
      const newIsLiked = !loop.isLiked
      const newLikeCount = newIsLiked ? loop.stats.likes + 1 : Math.max(0, loop.stats.likes - 1)

      setLoop((prev) =>
        prev
          ? {
              ...prev,
              isLiked: newIsLiked,
              stats: { ...prev.stats, likes: newLikeCount },
            }
          : null
      )

      await fetch(`/api/loops/${loopId}/like`, {
        method: "POST",
        headers: { ...getAuthHeader() },
      })
    } catch (error) {
      console.error("Failed to toggle like:", error)
    }
  }

  const [activeReaction, setActiveReaction] = useState<string | null>(null)

  const handleReaction = async (emoji: string) => {
    let nextEmoji: string | null = emoji
    setReactions((prev) => {
      const copy = { ...prev }
      if (activeReaction === emoji) {
        // Toggle off
        copy[emoji] = Math.max(0, (copy[emoji] || 0) - 1)
        nextEmoji = null
      } else {
        // Replace previous active reaction if any
        if (activeReaction && copy[activeReaction]) {
          copy[activeReaction] = Math.max(0, copy[activeReaction] - 1)
        }
        copy[emoji] = (copy[emoji] || 0) + 1
      }
      return copy
    })

    setActiveReaction(nextEmoji)

    const channel = supabase.channel(`loop_page:${loopId}`)
    await channel.send({
      type: "broadcast",
      event: "reaction",
      payload: { emoji: nextEmoji, loopId, user_id: user?.id },
    })
  }

  const handleBookmark = async () => {
    if (!loop || !user) return

    try {
      const newIsBookmarked = !loop.isBookmarked
      setLoop((prev) => (prev ? { ...prev, isBookmarked: newIsBookmarked } : null))

      await fetch(`/api/loops/${loopId}/save`, {
        method: "POST",
        headers: { ...getAuthHeader() },
      })
    } catch (error) {
      console.error("Failed to toggle bookmark:", error)
    }
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: loop?.title,
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        toast({ title: "Link copied", description: "Loop URL copied to clipboard" })
      }
    } catch (error) {
      console.error("Failed to share:", error)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      </div>
    )
  }

  if (!loop) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center text-slate-300 space-y-4">
        <h2 className="text-2xl font-bold">Loop Not Found</h2>
        <p className="text-sm text-slate-400">This loop may have been deleted or is private.</p>
        <Button asChild>
          <Link href="/explore">Explore Other Loops</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 text-slate-100">
      {/* Loop Container */}
      <Card className="border border-white/10 bg-[#0b1329]/80 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="p-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-cyan-500/40">
                <AvatarImage src={loop.author.avatar} />
                <AvatarFallback>{loop.author.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-white">{loop.author.displayName}</span>
                  {loop.author.verified && (
                    <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300 text-[10px]">
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>@{loop.author.username}</span>
                  <span>•</span>
                  <FreshnessTimestamp date={loop.createdAt} showIcon />
                  <span className="inline-flex items-center gap-1 text-cyan-400 text-[10px]">
                    <Sparkles className="h-3 w-3" /> Real-time active
                  </span>
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white">
                <DropdownMenuItem onClick={handleShare}>
                  <Copy className="h-4 w-4 mr-2" /> Copy link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBookmark}>
                  <Bookmark className="h-4 w-4 mr-2" /> {loop.isBookmarked ? "Remove Bookmark" : "Save Bookmark"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <h1 className="text-2xl font-extrabold text-white leading-tight">{loop.title}</h1>
          <p className="text-base text-slate-200 leading-relaxed whitespace-pre-wrap">{loop.content}</p>

          {/* Media Display */}
          {loop.media && (
            <div className="rounded-xl overflow-hidden border border-white/10 max-h-[450px]">
              {loop.media.type === "video" ? (
                <video src={loop.media.url} controls className="w-full h-full object-cover" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={loop.media.url} alt={loop.title} className="w-full h-full object-cover" />
              )}
            </div>
          )}

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
          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
            <span className="text-xs text-slate-400 font-medium mr-2">Quick React:</span>
            {["🔥", "❤️", "🚀", "💡", "👏", "💯"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs hover:bg-cyan-500/20 hover:border-cyan-400 transition-all"
              >
                <span>{emoji}</span>
                {reactions[emoji] ? (
                  <span className="text-[10px] font-bold text-cyan-300">{reactions[emoji]}</span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Stats & Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={`gap-2 ${loop.isLiked ? "text-rose-400 bg-rose-500/10" : "text-slate-400 hover:text-white"}`}
              >
                <Heart className={`h-4 w-4 ${loop.isLiked ? "fill-rose-500" : ""}`} />
                <span className="font-semibold">{loop.stats.likes}</span>
              </Button>

              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <MessageCircle className="h-4 w-4" />
                <span className="font-semibold">{loop.stats.comments}</span>
              </div>

              <Button variant="ghost" size="sm" onClick={handleShare} className="gap-2 text-slate-400 hover:text-white">
                <Share2 className="h-4 w-4" />
                <span>{loop.stats.shares}</span>
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
              <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white">
                <DropdownMenuItem onClick={() => setBranchOpen(true)} className="cursor-pointer hover:bg-slate-800">
                  <GitBranch className="h-4 w-4 mr-2 text-green-400" /> Branch this Loop
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setChainOpen(true)} className="cursor-pointer hover:bg-slate-800">
                  <Sparkles className="h-4 w-4 mr-2 text-cyan-400" /> View Loop Chain Map
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
    </div>
  )
}
