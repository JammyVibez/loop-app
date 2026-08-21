"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import {
  Users,
  Loader2,
  CheckCircle2,
  Zap,
  ExternalLink,
  MessageSquare,
  Heart,
  Share2,
  GitBranch,
  Lock,
  PartyPopper,
  Send,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

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
      status?: "open" | "full" | "published" | "ended"
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

interface Comment {
  id: string
  content: string
  author_id: string
  created_at: string
  author?: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_verified?: boolean
  }
  like_count?: number
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
  const isEnded = metadata.status === "ended" || isPublished
  const isSessionClosed = isEnded || isFull

  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(isAlreadyJoined)
  const [liveCount, setLiveCount] = useState(currentParticipants)
  const [liveStatus, setLiveStatus] = useState<string>(metadata.status || "open")
  const [liked, setLiked] = useState(post.interactions?.includes("like") || false)
  const [likeCount, setLikeCount] = useState(post.loop_stats?.likes_count || 0)
  const [commentCount, setCommentCount] = useState(post.loop_stats?.comments_count || 0)

  // Comments state
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)

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

  // Realtime: new comments
  useEffect(() => {
    if (!post.id || !showComments) return

    const channel = supabase
      .channel("open-invite-comments:" + post.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `loop_id=eq.${post.id}` },
        async (payload: any) => {
          if (!mountRef.current) return
          // Fetch the full comment with author info
          try {
            const res = await fetch(`/api/loops/${post.id}/comments?limit=1`, {
              headers: getAuthHeader(),
            })
            if (res.ok) {
              const data = await res.json()
              const newComment = data.comments?.find((c: Comment) => c.id === payload.new?.id)
              if (newComment) {
                setComments((prev) => {
                  if (prev.some((c) => c.id === newComment.id)) return prev
                  return [...prev, newComment]
                })
              }
            }
          } catch { /* ignore */ }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [post.id, showComments, supabase, getAuthHeader])

  // Load comments when expanded
  useEffect(() => {
    if (!showComments || !post.id) return
    let cancelled = false
    setCommentsLoading(true)

    fetch(`/api/loops/${post.id}/comments?limit=50`, {
      headers: getAuthHeader(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setComments(data.comments || [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCommentsLoading(false)
      })

    return () => { cancelled = true }
  }, [showComments, post.id, getAuthHeader])

  const handleJoin = useCallback(async () => {
    if (!user) {
      router.push("/auth?returnTo=" + encodeURIComponent("/"))
      return
    }

    if (isCreator) {
      router.push("/co-loop/studio?session=" + sessionId)
      return
    }

    if (joined || isFull || isEnded) return

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
  }, [user, isCreator, isFull, isEnded, joined, sessionId, getAuthHeader, router, toast, onJoin, liveCount])

  const handleLike = async () => {
    if (!user) {
      router.push("/auth?returnTo=" + encodeURIComponent("/"))
      return
    }
    setLiked(!liked)
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
    try {
      await fetch(`/api/loops/${post.id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ interaction_type: "like" }),
      })
    } catch {
      setLiked(liked)
      setLikeCount(post.loop_stats?.likes_count || 0)
    }
  }

  const handleComment = async () => {
    if (!user) {
      router.push("/auth?returnTo=" + encodeURIComponent("/"))
      return
    }
    if (!commentText.trim() || submittingComment) return

    setSubmittingComment(true)
    const text = commentText.trim()
    setCommentText("")

    try {
      const res = await fetch(`/api/loops/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ content: text }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.comment) {
          setComments((prev) => [...prev, data.comment])
        }
        setCommentCount((prev) => prev + 1)
      } else {
        const data = await res.json().catch(() => ({}))
        toast({ title: "Failed to post comment", description: data.error || "Try again", variant: "destructive" })
        setCommentText(text)
      }
    } catch {
      toast({ title: "Failed to post comment", description: "Network error", variant: "destructive" })
      setCommentText(text)
    } finally {
      setSubmittingComment(false)
    }
  }

  const progressPercent = Math.min(100, (liveCount / maxCollabs) * 100)
  const author = post.author

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

    if (isEnded) {
      return (
        <Button
          disabled
          className="flex-1 rounded-xl bg-slate-700/50 text-slate-400 text-sm font-bold cursor-not-allowed"
        >
          <Lock className="h-4 w-4 mr-2" />
          Session Ended
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
          <Zap className="h-4 w-4 mr-2" />
        )}
        {joining ? "Joining..." : "Join Session"}
      </Button>
    )
  }

  return (
    <Card className={"relative overflow-hidden border-2 p-0 shadow-xl " + (
      isPublished
        ? "border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-slate-900/80 to-teal-950/60 shadow-emerald-500/10"
        : isEnded
          ? "border-slate-500/30 bg-gradient-to-br from-slate-800/60 via-slate-900/80 to-slate-800/60 shadow-slate-500/10"
          : isFull
            ? "border-amber-500/30 bg-gradient-to-br from-amber-950/60 via-slate-900/80 to-orange-950/60 shadow-amber-500/10"
            : "border-cyan-500/30 bg-gradient-to-br from-cyan-950/60 via-slate-900/80 to-indigo-950/60 shadow-cyan-500/10"
    )}>
      {/* Decorative top bar */}
      <div className={"h-1 w-full " + (
        isPublished
          ? "bg-gradient-to-r from-emerald-400 via-teal-500 to-green-500"
          : isEnded
            ? "bg-gradient-to-r from-slate-400 via-slate-500 to-slate-600"
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
                : isEnded
                  ? "bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/20"
                  : "bg-gradient-to-br from-cyan-500 to-indigo-600 shadow-cyan-500/20"
            )}>
              {isPublished ? (
                <PartyPopper className="h-4 w-4 text-white" />
              ) : isEnded ? (
                <Clock className="h-4 w-4 text-white" />
              ) : (
                <Zap className="h-4 w-4 text-white" />
              )}
            </div>
            <Badge
              variant="outline"
              className={"text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider " + (
                isPublished
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : isEnded
                    ? "border-slate-500/40 bg-slate-500/10 text-slate-300"
                    : "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
              )}
            >
              {isPublished ? "Co-Loop Published" : isEnded ? "Session Ended" : "Open Co-Loop"}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={
                "h-2 w-2 rounded-full " +
                (isPublished
                  ? "bg-emerald-500"
                  : isEnded
                    ? "bg-slate-500"
                    : isFull
                      ? "bg-amber-500"
                      : "bg-emerald-500 animate-pulse")
              }
            />
            <span className="text-[11px] font-semibold text-muted-foreground">
              {isPublished
                ? "Published"
                : isEnded
                  ? "Ended"
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
              <Users className={"h-4 w-4 " + (isPublished || isEnded ? "text-slate-400" : "text-cyan-400")} />
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
                  : isEnded
                    ? "bg-gradient-to-r from-slate-500 to-slate-400"
                    : "bg-gradient-to-r from-cyan-500 to-indigo-500"
              )}
              style={{ width: progressPercent + "%" }}
            />
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
              {isPublished || isEnded
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
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-cyan-400 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs font-medium">{commentCount}</span>
              {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <GitBranch className="h-4 w-4" />
              <span className="text-xs font-medium">{post.loop_stats?.branches_count || 0}</span>
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Co-Loop · {liveCount} collaborator{liveCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="border-t border-white/5 pt-3 space-y-3">
            {commentsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2 p-2 rounded-lg bg-white/[0.03]">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={comment.author?.avatar_url} alt={comment.author?.display_name} />
                      <AvatarFallback className="text-[10px] bg-gradient-to-br from-cyan-600 to-indigo-600 text-white">
                        {(comment.author?.display_name || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">
                          {comment.author?.display_name || comment.author?.username}
                        </span>
                        {comment.author?.is_verified && (
                          <CheckCircle2 className="h-2.5 w-2.5 text-cyan-400 fill-cyan-400/20" />
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/90 leading-relaxed mt-0.5 break-words">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comment Input */}
            {user && (
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={user.avatar_url} alt={user.display_name} />
                  <AvatarFallback className="text-[10px] bg-gradient-to-br from-violet-600 to-cyan-600 text-white">
                    {(user.display_name || user.username || "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex items-center gap-2 bg-white/[0.05] rounded-xl px-3 py-1.5">
                  <Input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="bg-transparent border-none text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleComment()
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-transparent"
                    onClick={handleComment}
                    disabled={!commentText.trim() || submittingComment}
                  >
                    {submittingComment ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
