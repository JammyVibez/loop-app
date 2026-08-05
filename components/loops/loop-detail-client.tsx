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
  Users,
} from "lucide-react"
import { CommentsSection } from "@/components/comments/comments-section"
import { CreateBranchDialog } from "@/components/create-branch-dialog"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"
import { LoopChainDialog } from "@/components/loops/loop-chain-dialog"
import Link from "next/link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@supabase/supabase-js"

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
        isCoLoop: Boolean(loopData.is_co_loop),
        coAuthors: Array.isArray(loopData.co_authors) ? loopData.co_authors : [],
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
                <Sparkles className="h-3 w-3 animate-pulse text-cyan-200" />
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

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {loop.isCoLoop ? (
                <div
                  onClick={() => setRosterOpen(true)}
                  className="flex items-center cursor-pointer group flex-shrink-0"
                  title="Click to view Co-Authors roster"
                >
                  <div className="relative z-10">
                    <Avatar className="h-12 w-12 ring-2 ring-cyan-500 ring-offset-2 ring-offset-background group-hover:scale-105 transition-transform">
                      <AvatarImage src={loop.author.avatar} />
                      <AvatarFallback>{loop.author.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                  {loop.coAuthors.slice(0, 3).map((ca, i) => (
                    <div key={ca.id || i} className="-ml-3 relative z-[9] transition-transform group-hover:scale-105" style={{ zIndex: 8 - i }}>
                      <Avatar className="h-12 w-12 ring-2 ring-cyan-400 ring-offset-2 ring-offset-background">
                        <AvatarImage src={ca.avatar_url} />
                        <AvatarFallback>{(ca.display_name || ca.username || "C").charAt(0)}</AvatarFallback>
                      </Avatar>
                    </div>
                  ))}
                  {loop.coAuthors.length > 3 && (
                    <div className="-ml-3 relative z-0 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-950 text-xs font-bold text-cyan-300 ring-2 ring-cyan-400">
                      +{loop.coAuthors.length - 3}
                    </div>
                  )}
                </div>
              ) : (
                <Avatar className="h-12 w-12 border-2 border-cyan-500/40">
                  <AvatarImage src={loop.author.avatar} />
                  <AvatarFallback>{loop.author.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-foreground">
                    {loop.author.displayName}
                    {loop.isCoLoop && loop.coAuthors.length > 0 && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        × {loop.coAuthors.map((ca) => `@${ca.username}`).join(" × ")}
                      </span>
                    )}
                  </span>
                  {loop.author.verified && (
                    <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300 text-[10px]">
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border text-foreground">
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
          <h1 className="text-2xl font-extrabold text-foreground leading-tight">{loop.title}</h1>
          <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">{loop.content}</p>

          {/* Media Display */}
          {loop.media && (
            <div className="rounded-xl overflow-hidden border border-border max-h-[450px]">
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
          <div className="flex items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-xs text-muted-foreground font-medium mr-2">Quick React:</span>
            {["🔥", "❤️", "🚀", "💡", "👏", "💯"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                className="flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-xs hover:bg-cyan-500/20 hover:border-cyan-400 transition-all"
              >
                <span>{emoji}</span>
                {reactions[emoji] ? (
                  <span className="text-[10px] font-bold text-cyan-300">{reactions[emoji]}</span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Stats & Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                className={`gap-2 ${loop.isLiked ? "text-rose-400 bg-rose-500/10" : "text-muted-foreground hover:text-foreground"}`}
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

      {/* Co-Loop Contributors Roster Dialog */}
      {loop.isCoLoop && (
        <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
          <DialogContent className="border-border/60 bg-card text-foreground sm:max-w-md rounded-2xl p-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                Co-Loop Contributors Roster
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-cyan-500">
                    <AvatarImage src={loop.author.avatar} />
                    <AvatarFallback>{loop.author.displayName.charAt(0) || "A"}</AvatarFallback>
                  </Avatar>
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
                    <Avatar className="h-10 w-10 ring-2 ring-purple-500">
                      <AvatarImage src={ca.avatar_url} />
                      <AvatarFallback>{(ca.display_name || ca.username)?.charAt(0) || "C"}</AvatarFallback>
                    </Avatar>
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
