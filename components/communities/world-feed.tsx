"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/community-engine"
import { CommunityPostCard } from "./post-cards"
import type { CommunityPost } from "./post-cards"
import {
  BadgeCheck,
  BarChart3,
  Image as ImageIcon,
  Loader2,
  Lock,
  Globe2,
  Hourglass,
  ShieldCheck,
  Send,
  Clock,
  TrendingUp,
  MessageSquare,
  Hash,
  Flame,
  BookOpen,
  Lightbulb,
  Palette,
  Swords,
  Trophy,
  Calendar,
  Users,
  Gamepad2,
  Compass,
  Library,
  Star,
  Vote,
  LayoutGrid,
  Crown,
  FolderOpen,
  Sparkles,
  Radio,
  Music,
  MapPin,
  Briefcase,
  Building2,
  HelpCircle,
  Handshake,
  Camera,
  LayoutList,
  Wand2,
  Newspaper,
  ListOrdered,
} from "lucide-react"

const SPACE_ICONS: Record<string, typeof MessageSquare> = {
  home: Globe2,
  "message-circle": MessageSquare,
  "messages-square": MessageSquare,
  hash: Hash,
  flame: Flame,
  image: ImageIcon,
  "book-open": BookOpen,
  lightbulb: Lightbulb,
  palette: Palette,
  swords: Swords,
  trophy: Trophy,
  calendar: Calendar,
  users: Users,
  "gamepad-2": Gamepad2,
  compass: Compass,
  library: Library,
  star: Star,
  vote: Vote,
  "layout-grid": LayoutGrid,
  crown: Crown,
  folder: FolderOpen,
  sparkles: Sparkles,
  radio: Radio,
  "list-music": Music,
  "map-pin": MapPin,
  briefcase: Briefcase,
  "building-2": Building2,
  "help-circle": HelpCircle,
  "trending-up": TrendingUp,
  handshake: Handshake,
  camera: Camera,
  "layout-list": LayoutList,
  "wand-2": Wand2,
  newspaper: Newspaper,
  "list-ordered": ListOrdered,
  "bar-chart-3": BarChart3,
  clock: Clock,
}

function SpaceIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = SPACE_ICONS[icon] || MessageSquare
  return <Icon className={className} />
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
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [sortBy, setSortBy] = useState("latest")

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
  const [showComposerPoll, setShowComposerPoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState("")
  const [pollOptions, setPollOptions] = useState(["", ""])
  const [mediaFiles, setMediaFiles] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const loadingMore = useRef(false)

  const load = useCallback(
    async (reset = true) => {
      if (reset) setLoading(true)
      setError("")
      try {
        const params = new URLSearchParams({ limit: "20", offset: reset ? "0" : String(offset), sort: sortBy })
        if (spaceId !== "general") params.set("space_id", spaceId)
        const res = await fetch(`/api/circles/${communityId}/posts?${params}`)
        if (!res.ok) {
          const errText = await res.text().catch(() => "")
          let errMsg = "Failed to load posts"
          try { errMsg = JSON.parse(errText).error || errMsg } catch {}
          throw new Error(errMsg)
        }
        const data = await res.json()
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
    [communityId, spaceId, offset, sortBy],
  )

  useEffect(() => {
    setPosts([])
    setOffset(0)
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, spaceId, sortBy])

  useEffect(() => {
    if (spaceRequest && spaceRequest.id !== spaceId) {
      setSpaceId(spaceRequest.id)
      if (onSpaceHandled) onSpaceHandled()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceRequest?.token])

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

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("type", "loop_media")
        const res = await fetch("/api/upload", { method: "POST", body: formData })
        const data = await res.json()
        if (data.success && data.data?.url) {
          setMediaFiles((prev) => [...prev, data.data.url])
        }
      }
    } catch {}
    setUploading(false)
    e.target.value = ""
  }

  const createPost = async () => {
    if (!composer.trim()) return
    setPosting(true)
    setError("")
    setNotice("")
    try {
      const payload: any = {
        content: composer.trim(),
        space_id: spaceId !== "general" ? spaceId : undefined,
        media_urls: mediaFiles.length > 0 ? mediaFiles : undefined,
      }
      if (showComposerPoll && pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2) {
        payload.poll = {
          question: pollQuestion.trim(),
          options: pollOptions.filter((o) => o.trim()),
        }
      }
      const res = await fetch(`/api/circles/${communityId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to post")
      setComposer("")
      setShowComposerPoll(false)
      setPollQuestion("")
      setPollOptions(["", ""])
      setMediaFiles([])
      if (data.post?.status === "pending") {
        setNotice("Your post was submitted and is awaiting moderator review.")
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
            : p,
        ),
      )
    } catch {}
    setLiking(null)
  }

  const toggleSave = async (postId: number) => {
    if (!user) return
    try {
      const res = await fetch(`/api/circles/${communityId}/posts/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save" }),
      })
      const data = await res.json()
      if (!res.ok) return
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, is_saved: data.is_active } : p)))
    } catch {}
  }

  const deletePost = async (postId: number) => {
    try {
      const res = await fetch(`/api/circles/${communityId}/posts/${communityId}?postId=${postId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId))
      }
    } catch {}
  }

  const editPost = async (postId: number, content: string) => {
    try {
      const res = await fetch(`/api/circles/${communityId}/posts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content }),
      })
      if (res.ok) {
        const data = await res.json()
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, content, ...data.post } : p)))
      }
    } catch {}
  }

  const togglePin = async (postId: number) => {
    try {
      const post = posts.find((p) => p.id === postId)
      const res = await fetch(`/api/circles/${communityId}/posts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, is_pinned: !post?.is_pinned }),
      })
      if (res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, is_pinned: !p.is_pinned } : p)))
      }
    } catch {}
  }

  const approvalOn = Boolean(moderationSettings?.post_approval) && !isModerator
  const pendingCount = posts.filter((p) => p.status === "pending").length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {/* Composer */}
        {isMember ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            {approvalOn && (
              <p className="mb-2 flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                <Hourglass className="h-3 w-3" /> Posts are reviewed by moderators before they appear.
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
                placeholder="Share something with the community..."
                className="min-h-[80px] rounded-xl resize-none"
                maxLength={2000}
              />
            </div>

            {showComposerPoll && (
              <div className="mt-3 ml-12 space-y-2 p-3 rounded-xl border border-border bg-muted/30">
                <Input
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Poll question"
                  className="h-9 text-sm rounded-lg"
                />
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions]
                        next[i] = e.target.value
                        setPollOptions(next)
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="h-9 text-sm rounded-lg"
                    />
                    {i >= 2 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-9 w-9 p-0 text-muted-foreground"
                        onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                      >
                        x
                      </Button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                  >
                    + Add option
                  </Button>
                )}
              </div>
            )}

            {/* Media preview */}
            {mediaFiles.length > 0 && (
              <div className="mt-2 ml-12 flex flex-wrap gap-2">
                {mediaFiles.map((url, i) => (
                  <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden bg-muted">
                    <Image src={url} alt="" fill className="object-cover" unoptimized />
                    <button
                      onClick={() => setMediaFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px]"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Posting to <strong>{visibleSpaces.find((s) => String(s.id) === spaceId)?.name || "General"}</strong>
                </span>
                <label className="flex items-center gap-1 h-7 px-2 text-[11px] rounded-full border border-border bg-card text-muted-foreground cursor-pointer hover:text-foreground transition">
                  <ImageIcon className="h-3 w-3" />
                  {uploading ? "Uploading..." : "Media"}
                  <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} disabled={uploading} />
                </label>
                <Button
                  size="sm"
                  variant={showComposerPoll ? "secondary" : "ghost"}
                  className="h-7 px-2 text-[11px] rounded-full"
                  onClick={() => setShowComposerPoll(!showComposerPoll)}
                >
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Poll
                </Button>
              </div>
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

        {/* Sort bar */}
        <div className="flex items-center gap-2">
          {[
            { id: "latest", label: "Latest", icon: Clock },
            { id: "top", label: "Top", icon: TrendingUp },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                sortBy === s.id
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <s.icon className="h-3 w-3" />
              {s.label}
            </button>
          ))}
        </div>

        {/* Posts */}
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
              <CommunityPostCard
                key={p.id}
                post={p}
                communityId={communityId}
                spaces={spaces}
                isMember={isMember}
                isModerator={isModerator}
                currentUserId={user?.id}
                onLike={toggleLike}
                onSave={toggleSave}
                onDelete={deletePost}
                onPin={togglePin}
                onEdit={editPost}
                liking={liking}
                flashId={flashId}
              />
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
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">Spaces</p>
        {visibleSpaces.map((s: any) => (
          <button
            key={s.id}
            onClick={() => setSpaceId(String(s.id))}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition",
              String(s.id) === spaceId
                ? "border-indigo-500/50 bg-indigo-500/10"
                : "border-border bg-card hover:border-indigo-500/30",
            )}
          >
            <SpaceIcon icon={s.icon || "home"} className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{s.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{s.type}</p>
            </div>
          </button>
        ))}
        {isModerator && (
          <p className="flex items-center gap-1 px-1 pt-1 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-500" /> Moderator
            {pendingCount > 0 && ` - ${pendingCount} pending`}
          </p>
        )}
      </div>
    </div>
  )
}
