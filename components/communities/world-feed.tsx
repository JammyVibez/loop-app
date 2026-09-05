"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatNumber, timeAgo } from "@/lib/community-engine"
import { Heart, MessageSquare, Send, Loader2, Lock, BadgeCheck, Globe2, Hourglass, ShieldCheck } from "lucide-react"

interface Post {
  id: number
  content: string
  media_urls?: string[] | null
  media_url?: string | null
  media_type?: string | null
  like_count: number
  comment_count: number
  is_liked?: boolean
  space_id?: number | null
  status?: string | null
  author?: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string | null
    is_verified?: boolean
  }
  created_at: string
}

export function WorldFeed({
  communityId,
  spaces,
  isMember,
  isModerator = false,
  moderationSettings = {},
  focusId,
  spaceRequest,
  onSpaceHandled,
  onFocused,
}: {
  communityId: string
  spaces: any[]
  isMember: boolean
  isModerator?: boolean
  moderationSettings?: Record<string, any>
  focusId?: number
  spaceRequest?: { id: string; token: number } | null
  onSpaceHandled?: () => void
  onFocused?: () => void
}) {
  const { user } = useAuth()
  const [spaceId, setSpaceId] = useState<string>("general")
  const [posts, setPosts] = useState<Post[]>([])

  const visibleSpaces = [{ id: "general", name: "General", icon: "home", type: "discussion" }, ...spaces]

  const [loading, setLoading] = useState(true)
  const [composer, setComposer] = useState("")
  const [posting, setPosting] = useState(false)
  const [liking, setLiking] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [flashId, setFlashId] = useState<number | null>(null)
  const loadingMore = useRef(false)

  const load = useCallback(
    async (reset = true) => {
      if (reset) setLoading(true)
      setError("")
      try {
        const params = new URLSearchParams({ limit: "20", offset: reset ? "0" : String(offset) })
        if (spaceId !== "general") params.set("space_id", spaceId)
        const res = await fetch(`/api/circles/${communityId}/posts?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load posts")
        setPosts((prev) => (reset ? data.posts || [] : [...prev, ...(data.posts || [])]))
        setHasMore(Boolean(data.hasMore))
        setOffset((data.posts || []).length)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
        loadingMore.current = false
      }
    },
    [communityId, spaceId, offset]
  )

  useEffect(() => {
    setPosts([])
    setOffset(0)
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, spaceId])

  // Space jump from the mobile sheet.
  useEffect(() => {
    if (spaceRequest && spaceRequest.id !== spaceId) {
      setSpaceId(spaceRequest.id)
      if (onSpaceHandled) onSpaceHandled()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceRequest?.token])

  // Deep-link: scroll a specific post into view and flash a ring around it.
  useEffect(() => {
    if (!focusId) return
    let attempts = 0
    const tryScroll = () => {
      attempts += 1
      const el = document.getElementById(`world-post-${focusId}`)
      if (el) {
        setFlashId(focusId)
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        setTimeout(() => {
          setFlashId(null)
          if (onFocused) onFocused()
        }, 2400)
      } else if (attempts < 10) {
        setTimeout(tryScroll, 180)
      } else if (onFocused) {
        onFocused()
      }
    }
    tryScroll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, posts.length])

  const loadMore = () => {
    if (loadingMore.current || !hasMore) return
    loadingMore.current = true
    load(false)
  }

  const createPost = async () => {
    if (!composer.trim()) return
    setPosting(true)
    setError("")
    setNotice("")
    try {
      const res = await fetch(`/api/circles/${communityId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: composer.trim(),
          space_id: spaceId !== "general" ? spaceId : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to post")
      setComposer("")
      if (data.post?.status === "pending") {
        setNotice("Your post was submitted and is awaiting a moderator's review. ✨")
      } else {
        setPosts((prev) => [data.post, ...prev])
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPosting(false)
    }
  }

  const toggleLike = async (postId: number) => {
    if (!user) return
    setLiking(postId)
    try {
      const res = await fetch(`/api/circles/${communityId}/posts/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "like" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_liked: data.is_liked, like_count: Math.max(0, p.like_count + (data.is_liked ? 1 : -1)) }
            : p
        )
      )
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLiking(null)
    }
  }

  const approvalOn = Boolean(moderationSettings?.post_approval) && !isModerator
  const blockedWords: string[] = Array.isArray(moderationSettings?.blocked_words) ? moderationSettings.blocked_words : []
  const pendingCount = posts.filter((p) => p.status === "pending").length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {/* Composer */}
        {isMember ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            {approvalOn && (
              <p className="mb-2 flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                <Hourglass className="h-3 w-3" /> New posts are reviewed by moderators before they appear.
              </p>
            )}
            <div className="flex gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.avatar_url || ""} alt="" />
                <AvatarFallback>{(user?.display_name || user?.username || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Textarea
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="Share something with the world…"
                className="min-h-[80px] rounded-xl resize-none"
                maxLength={2000}
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Posting to <strong>{visibleSpaces.find((s) => String(s.id) === spaceId)?.name || "General"}</strong>
              </span>
              <Button size="sm" className="rounded-full" onClick={createPost} disabled={posting || !composer.trim()}>
                {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Post
              </Button>
            </div>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            {notice && <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">{notice}</p>}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <Lock className="mx-auto h-5 w-5 mb-2" />
            Join the community to post and interact.
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Globe2 className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold">No posts here yet</p>
            <p className="text-xs text-muted-foreground mt-1">Be the first to start the conversation.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <div
                key={p.id}
                id={`world-post-${p.id}`}
                className={`rounded-2xl border bg-card p-4 scroll-mt-24 transition-all duration-500 ${
                  flashId === p.id ? "border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-900/20" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Link href={`/profile/${p.author?.username}`}>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={p.author?.avatar_url || ""} alt="" />
                      <AvatarFallback>{(p.author?.display_name || p.author?.username || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/profile/${p.author?.username}`} className="text-sm font-semibold truncate hover:underline">
                        {p.author?.display_name || p.author?.username}
                      </Link>
                      {p.author?.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                      <span className="text-[11px] text-muted-foreground truncate">@{p.author?.username}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(p.created_at)}</p>
                  </div>
                  {p.status === "pending" && (
                    <Badge className="gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                      <Hourglass className="h-2.5 w-2.5" /> Pending review
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-sm whitespace-pre-wrap">{p.content}</p>
                {p.media_urls && p.media_urls.length > 0 && (
                  <div className={`mt-3 grid gap-2 ${p.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {p.media_urls.map((url, i) => (
                      <div key={i} className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                        <Image src={url} alt="" fill className="object-cover" unoptimized />
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-xs"
                    onClick={() => toggleLike(p.id)}
                    disabled={liking === p.id || !user || !isMember || p.status === "pending"}
                  >
                    <Heart className={`h-3.5 w-3.5 mr-1.5 ${p.is_liked ? "fill-red-500 text-red-500" : ""}`} />
                    {p.like_count || 0}
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-full text-xs" disabled>
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    {p.comment_count || 0}
                  </Button>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {p.space_id ? (spaces.find((s) => String(s.id) === String(p.space_id))?.name || "Space") : "General"}
                  </span>
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="text-center pt-2">
                <Button variant="outline" size="sm" className="rounded-full" onClick={loadMore} disabled={loadingMore.current}>
                  {loadingMore.current ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Space filter rail */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
          Spaces {blockedWords.length > 0 && isModerator ? "· filtered" : ""}
        </p>
        {visibleSpaces.map((s: any) => (
          <button
            key={s.id}
            onClick={() => setSpaceId(String(s.id))}
            className={`w-full flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
              String(s.id) === spaceId
                ? "border-indigo-500/50 bg-indigo-500/10"
                : "border-border bg-card hover:border-indigo-500/30"
            }`}
          >
            <span className="text-base">{s.icon === "home" ? "🏠" : iconForSpace(s.icon)}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{s.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{s.type}</p>
            </div>
          </button>
        ))}
        {isModerator && approvalOn === false && (
          <p className="flex items-center gap-1 px-1 pt-1 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-500" /> You're a moderator — {pendingCount > 0 ? `${pendingCount} post${pendingCount === 1 ? "" : "s"} pending` : "no pending posts"}
          </p>
        )}
      </div>
    </div>
  )
}

function iconForSpace(icon: string) {
  const map: Record<string, string> = {
    "message-circle": "💬",
    "messages-square": "💬",
    hash: "#️⃣",
    flame: "🔥",
    image: "🖼️",
    "book-open": "📖",
    lightbulb: "💡",
    palette: "🎨",
    swords: "⚔️",
    trophy: "🏆",
    calendar: "📅",
    users: "👥",
    "gamepad-2": "🎮",
    compass: "🧭",
    library: "📚",
    star: "⭐",
    vote: "🗳️",
    "layout-grid": "🔲",
    crown: "👑",
    home: "🏠",
    folder: "📁",
    sparkles: "✨",
    radio: "📻",
    "list-music": "🎵",
    "map-pin": "📍",
    briefcase: "💼",
    "building-2": "🏢",
    "help-circle": "❓",
    "trending-up": "📈",
    handshake: "🤝",
    camera: "📷",
    "layout-list": "📋",
    "wand-2": "🪄",
    newspaper: "📰",
    "list-ordered": "🔢",
    "bar-chart-3": "📊",
    clock: "⏰",
  }
  return map[icon] || "💬"
}
