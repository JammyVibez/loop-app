"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import {
  Users,
  Loader2,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Heart,
  Share2,
  GitBranch,
  Lock,
  PartyPopper,
} from "lucide-react"

interface OpenCoLoopInviteCardProps {
  post: {
    id: string
    content_text?: string
    content_title?: string
    author_id: string
    author?: {
      id: string
      username: string
      display_name: string
      avatar_url?: string
      is_verified?: boolean
      is_premium?: boolean
      level?: number
      cosmetics?: any
    }
    content_metadata?: {
      is_open_coloop_invite?: boolean
      session_id?: string
      max_collaborators?: number
      topic?: string
      current_participants?: number
      status?: "open" | "full" | "published"
    }
    created_at?: string
    loop_stats?: {
      likes_count: number
      comments_count: number
      branches_count: number
      shares_count: number
    }
    interactions?: string[]
  }
  onJoin?: (sessionId: string) => void
}

const AVATAR_RING_COLORS = [
  "ring-cyan-400",
  "ring-violet-400",
  "ring-emerald-400",
  "ring-amber-400",
  "ring-rose-400",
]

export function OpenCoLoopInviteCard({ post, onJoin }: OpenCoLoopInviteCardProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const mountRef = useRef(true)

  useEffect(() => {
    mountRef.current = true
    return () => { mountRef.current = false }
  }, [])

  const metadata = post.content_metadata || {}
  const sessionId = metadata.session_id || ""
  const maxCollabs = metadata.max_collaborators || 4
  const currentParticipants = metadata.current_participants || 1
  const topic = metadata.topic || post.content_text || ""
  const isCreator = user?.id === post.author_id
  const isAlreadyJoined = post.interactions?.includes("coloop_joined") || false
  const isFull = currentParticipants >= maxCollabs
  const isPublished = metadata.status === "published"
  const isSessionClosed = isPublished || isFull

  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(isAlreadyJoined)
  const [liveCount, setLiveCount] = useState(currentParticipants)
  const [liveStatus, setLiveStatus] = useState<string>(metadata.status || "open")
  const [liked, setLiked] = useState(post.interactions?.includes("like") || false)
  const [likeCount, setLikeCount] = useState(post.loop_stats?.likes_count || 0)
  const [commentCount, setCommentCount] = useState(post.loop_stats?.comments_count || 0)

  // Realtime: listen for participants joining + session status changes + likes/comments
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel("open-coloop-feed:" + sessionId)
      .on("broadcast", { event: "co-author-accepted" }, (payload: any) => {
        if (!mountRef.current) return
        setLiveCount((prev) => {
          const next = prev + 1
          if (next >= maxCollabs) setLiveStatus("full")
          return next
        })
      })
      .on("broadcast", { event: "open_invite_published" }, (payload: any) => {
        if (!mountRef.current) return
        if (payload.payload?.max_collaborators) setLiveCount(1)
      })
      .on("broadcast", { event: "session_ended" }, () => {
        if (!mountRef.current) return
        setLiveStatus("ended")
      })
      .on("broadcast", { event: "coloop_published" }, () => {
        if (!mountRef.current) return
        setLiveStatus("published")
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sessionId, maxCollabs, supabase])

  // Realtime: subscribe to loop_stats changes for this post (likes, comments)
  useEffect(() => {
    if (!post.id) return

    const channel = supabase
      .channel("open-invite-stats:" + post.id)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "loop_stats",
          filter: `loop_id=eq.${post.id}`,
        },
        (payload: any) => {
          if (!mountRef.current) return
          const row = payload.new
          if (row) {
            if (typeof row.likes_count === "number") setLikeCount(row.likes_count)
            if (typeof row.comments_count === "number") setCommentCount(row.comments_count)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [post.id, supabase])

  // Also subscribe to likes table for real-time interactor list
  useEffect(() => {
    if (!post.id || !user) return

    const channel = supabase
      .channel("open-invite-likes:" + post.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "likes", filter: `loop_id=eq.${post.id}` },
        (payload: any) => {
          if (!mountRef.current) return
          if (payload.new?.user_id === user.id) setLiked(true)
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "likes", filter: `loop_id=eq.${post.id}` },
        (payload: any) => {
          if (!mountRef.current) return
          // optimistic — if we haven't toggled, revert
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [post.id, user, supabase])

  const handleJoin = useCallback(async () => {
    if (!user) {
      router.push("/auth?returnTo=" + encodeURIComponent("/"))
      return
    }

    if (isCreator) {
      router.push("/co-loop/studio?session=" + sessionId)
      return
    }

    if (joined || isFull || isPublished) return

    setJoining(true)
    try {
      const res = await fetch("/api/co-loop/open-invite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ session_id: sessionId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to join")

      setJoined(true)
      setLiveCount(data.current_count || liveCount + 1)

      toast({
        title: "You joined the Co-Loop! 🤝",
        description: "Heading to the live studio...",
      })

      if (onJoin) onJoin(sessionId)

      setTimeout(() => {
        router.push(data.studio_url || "/co-loop/studio?session=" + sessionId)
      }, 800)
    } catch (err: any) {
      toast({
        title: "Couldn't join",
        description: err.message || "Try again later",
        variant: "destructive",
      })
    } finally {
      setJoining(false)
    }
  }, [user, isCreator, isFull, isPublished, joined, sessionId, getAuthHeader, router, toast, onJoin, liveCount])

  const handleLike = async () => {
    if (!user) {
      router.push("/auth?returnTo=" + encodeURIComponent("/"))
      return
    }
    setLiked(!liked)
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
    try {
      await fetch("/api/loops/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ loop_id: post.id, interaction_type: "like" }),
      })
    } catch {
      setLiked(liked)
      setLikeCount(post.loop_stats?.likes_count || 0)
    }
  }

  const progressPercent = Math.min(100, (liveCount / maxCollabs) * 100)
  const author = post.author

  // Determine button state
  const renderActionButton = () => {
    if (isCreator) {
      return (
        <Button
          asChild
          className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-white hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/25 text-sm"
        >
          <Link href={"/co-loop/studio?session=" + sessionId}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Enter Studio
          </Link>
        </Button>
      )
    }

    if (isPublished) {
      return (
        <Button
          disabled
          className="flex-1 rounded-xl bg-emerald-700/50 text-emerald-300 text-sm font-bold cursor-not-allowed"
        >
          <PartyPopper className="h-4 w-4 mr-2" />
          Published — Session Complete
        </Button>
      )
    }

    if (isFull) {
      return (
        <Button
          disabled
          className="flex-1 rounded-xl bg-slate-700/50 text-slate-400 text-sm font-bold cursor-not-allowed"
        >
          <Lock className="h-4 w-4 mr-2" />
          Session Full
        </Button>
      )
    }

    if (joined) {
      return (
        <Button
          asChild
          className="flex-1 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/25 text-sm"
        >
          <Link href={"/co-loop/studio?session=" + sessionId}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Enter Studio
          </Link>
        </Button>
      )
    }

    return (
      <Button
        onClick={handleJoin}
        disabled={joining}
        className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-white hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/25 text-sm transition-all"
      >
        {joining ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        {joining ? "Joining..." : "Join Session"}
      </Button>
    )
  }

  return (
    <Card className={"relative overflow-hidden border-2 p-0 shadow-xl " + (
      isPublished
        ? "border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-slate-900/80 to-teal-950/60 shadow-emerald-500/10"
        : isFull
          ? "border-amber-500/30 bg-gradient-to-br from-amber-950/60 via-slate-900/80 to-orange-950/60 shadow-amber-500/10"
          : "border-cyan-500/30 bg-gradient-to-br from-cyan-950/60 via-slate-900/80 to-indigo-950/60 shadow-cyan-500/10"
    )}>
      {/* Decorative top bar */}
      <div className={"h-1 w-full " + (
        isPublished
          ? "bg-gradient-to-r from-emerald-400 via-teal-500 to-green-500"
          : isFull
            ? "bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-500"
            : "bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500"
      )} />

      <div className="p-4 sm:p-5 space-y-4">
        {/* Header: Badge + Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={"flex h-8 w-8 items-center justify-center rounded-lg shadow-lg " + (
              isPublished
                ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20"
                : "bg-gradient-to-br from-cyan-500 to-indigo-600 shadow-cyan-500/20"
            )}>
              {isPublished ? (
                <PartyPopper className="h-4 w-4 text-white" />
              ) : (
                <Sparkles className="h-4 w-4 text-white" />
              )}
            </div>
            <Badge
              variant="outline"
              className={"text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider " + (
                isPublished
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
              )}
            >
              {isPublished ? "Co-Loop Published" : "Open Co-Loop"}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={
                "h-2 w-2 rounded-full " +
                (isPublished
                  ? "bg-emerald-500"
                  : isFull
                    ? "bg-amber-500"
                    : "bg-emerald-500 animate-pulse")
              }
            />
            <span className="text-[11px] font-semibold text-muted-foreground">
              {isPublished
                ? "Published"
                : isFull
                  ? "Session Full"
                  : "Live · Open"}
            </span>
          </div>
        </div>

        {/* Creator */}
        {author && (
          <div className="flex items-center gap-3">
            <Avatar className={"h-10 w-10 ring-2 " + (isPublished ? "ring-emerald-400/60" : "ring-cyan-400/60")}>
              <AvatarImage src={author.avatar_url} alt={author.display_name} />
              <AvatarFallback className={"text-sm font-bold text-white " + (
                isPublished
                  ? "bg-gradient-to-br from-emerald-600 to-teal-600"
                  : "bg-gradient-to-br from-cyan-600 to-indigo-600"
              )}>
                {(author.display_name || author.username || "?")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-foreground truncate">
                  {author.display_name || author.username}
                </span>
                {author.is_verified && (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-cyan-400 fill-cyan-400/20" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                @{author.username} is hosting
              </p>
            </div>
          </div>
        )}

        {/* Topic / Prompt */}
        <div className="space-y-1.5">
          <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
            {post.content_title || "🤝 Open Co-Loop"}
          </h3>
          {topic && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {topic}
            </p>
          )}
        </div>

        {/* Capacity Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className={"h-4 w-4 " + (isPublished ? "text-emerald-400" : "text-cyan-400")} />
              <span className="text-sm font-bold text-foreground">
                {liveCount}/{maxCollabs} joined
              </span>
            </div>
            {isCreator && (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-300">
                You&apos;re hosting
              </Badge>
            )}
          </div>

          {/* Progress bar */}
          <div className="relative h-2 overflow-hidden rounded-full bg-slate-800/80">
            <div
              className={"absolute inset-y-0 left-0 rounded-full transition-all duration-500 " + (
                isPublished
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                  : "bg-gradient-to-r from-cyan-500 to-indigo-500"
              )}
              style={{ width: progressPercent + "%" }}
            />
            {isPublished && (
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/40 to-teal-400/40" />
            )}
            {isFull && !isPublished && (
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/40 to-amber-400/40 animate-pulse" />
            )}
          </div>

          {/* Participant avatars */}
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {Array.from({ length: Math.min(liveCount, 4) }).map((_, i) => (
                <div
                  key={i}
                  className={
                    "h-6 w-6 rounded-full border-2 border-slate-900 bg-gradient-to-br from-cyan-600 to-indigo-600 ring-1 " +
                    AVATAR_RING_COLORS[i % AVATAR_RING_COLORS.length]
                  }
                />
              ))}
            </div>
            <span className="ml-2 text-[11px] text-muted-foreground">
              {isPublished
                ? "Session completed"
                : isFull
                  ? "Session is full"
                  : (maxCollabs - liveCount) + " spot" + (maxCollabs - liveCount !== 1 ? "s" : "") + " left"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {renderActionButton()}
        </div>

        {/* Engagement bar — real-time */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-rose-400 transition-colors"
            >
              <Heart className={"h-4 w-4 " + (liked ? "fill-rose-400 text-rose-400" : "")} />
              <span className="text-xs font-medium">{likeCount}</span>
            </button>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs font-medium">{commentCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <GitBranch className="h-4 w-4" />
              <span className="text-xs font-medium">{post.loop_stats?.branches_count || 0}</span>
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Co-Loop · {liveCount} collaborator{liveCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </Card>
  )
}
