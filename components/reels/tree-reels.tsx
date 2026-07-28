"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Heart,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
  Plus,
  Loader2,
  Music2,
  Bookmark,
  GitBranch,
  Gauge,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface ReelAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_verified?: boolean
}

interface Reel {
  id: string
  title: string
  description?: string
  content_type: string
  type?: string
  content_url: string
  thumbnail_url?: string | null
  hashtags?: string[]
  like_count: number
  comment_count: number
  share_count: number
  view_count: number
  is_liked?: boolean
  is_saved?: boolean
  author?: ReelAuthor
  source?: string
  effects?: any
  parent_reel_id?: string | null
}

interface TreeReelsProps {
  category?: string
}

export function TreeReels({ category = "trending" }: TreeReelsProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [reels, setReels] = useState<Reel[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [commentOpen, setCommentOpen] = useState<Reel | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState("")
  const [replyTo, setReplyTo] = useState<{ id: string; username?: string } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [createTitle, setCreateTitle] = useState("")
  const [createHashtags, setCreateHashtags] = useState("")
  const [createEffect, setCreateEffect] = useState("none")
  const [playbackRate, setPlaybackRate] = useState(1)
  const [progress, setProgress] = useState(0)
  const [heartBurst, setHeartBurst] = useState(false)
  const [duetReel, setDuetReel] = useState<Reel | null>(null)
  const [dueting, setDueting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const viewed = useRef<Set<string>>(new Set())
  const lastTapRef = useRef(0)

  const fetchReels = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/reels?category=${category}&limit=30`, {
        headers: user ? getAuthHeader() : undefined,
        cache: "no-store",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load reels")
      setReels(data.data?.reels || [])
    } catch (error: any) {
      toast({ title: "Reels unavailable", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [category, user, getAuthHeader, toast])

  useEffect(() => {
    fetchReels()
  }, [fetchReels])

  // Deep-link focus: /reels?focus=<id>
  useEffect(() => {
    if (!reels.length || typeof window === "undefined") return
    const focusId = new URLSearchParams(window.location.search).get("focus")
    if (!focusId) return
    const idx = reels.findIndex((r) => r.id === focusId)
    if (idx < 0) return
    const el = containerRef.current?.querySelector(`[data-index="${idx}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
    setActiveIndex(idx)
  }, [reels])

  // Realtime public reels channel
  useEffect(() => {
    const channel = supabase.channel("reels:public", {
      config: { broadcast: { self: false } },
    })

    channel
      .on("broadcast", { event: "reel:liked" }, ({ payload }) => {
        if (!payload?.reel_id) return
        setReels((prev) =>
          prev.map((r) =>
            r.id === payload.reel_id
              ? { ...r, like_count: payload.like_count ?? r.like_count, is_liked: payload.user_id === user?.id ? !!payload.liked : r.is_liked }
              : r,
          ),
        )
      })
      .on("broadcast", { event: "reel:created" }, ({ payload }) => {
        if (payload?.reel) setReels((prev) => [payload.reel, ...prev])
      })
      .on("broadcast", { event: "reel:commented" }, ({ payload }) => {
        if (!payload?.reel_id) return
        setReels((prev) =>
          prev.map((r) =>
            r.id === payload.reel_id ? { ...r, comment_count: payload.comment_count ?? r.comment_count + 1 } : r,
          ),
        )
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Snap scroll + autoplay active reel
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number((entry.target as HTMLElement).dataset.index)
          if (entry.isIntersecting && entry.intersectionRatio > 0.65) {
            setActiveIndex(index)
          }
        })
      },
      { root, threshold: [0.65] },
    )

    root.querySelectorAll("[data-reel-slide]").forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [reels.length])

  useEffect(() => {
    const active = reels[activeIndex]
    videoRefs.current.forEach((video, id) => {
      if (active && id === active.id) {
        video.muted = muted
        video.playbackRate = playbackRate
        void video.play().catch(() => null)
        if (!viewed.current.has(id) && active.source !== "loop") {
          viewed.current.add(id)
          void fetch(`/api/reels/${id}/interactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(user ? getAuthHeader() : {}) },
            body: JSON.stringify({ type: "view", action: "add" }),
          }).catch(() => null)
        }
      } else {
        video.pause()
        try {
          video.currentTime = 0
        } catch {}
      }
    })
  }, [activeIndex, muted, playbackRate, reels, user, getAuthHeader])

  useEffect(() => {
    const active = reels[activeIndex]
    if (!active) return
    const video = videoRefs.current.get(active.id)
    if (!video) return
    const onTime = () => {
      if (!video.duration) return
      setProgress((video.currentTime / video.duration) * 100)
    }
    video.addEventListener("timeupdate", onTime)
    return () => video.removeEventListener("timeupdate", onTime)
  }, [activeIndex, reels])

  const cycleSpeed = () => {
    const rates = [1, 1.25, 1.5, 2, 0.75]
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length]
    setPlaybackRate(next)
  }

  const doubleTapLike = (reel: Reel) => {
    const now = Date.now()
    if (now - lastTapRef.current < 320) {
      setHeartBurst(true)
      window.setTimeout(() => setHeartBurst(false), 650)
      if (!reel.is_liked) void interact(reel, "like")
      lastTapRef.current = 0
      return
    }
    lastTapRef.current = now
  }

  const createDuet = async () => {
    if (!user || !duetReel || !uploadFile) {
      toast({ title: "Pick a clip to duet with", variant: "destructive" })
      return
    }
    setDueting(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("type", uploadFile.type.startsWith("video") ? "video" : "image")
      formData.append("folder", "reels")
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      })
      const uploadData = await uploadRes.json()
      const url = uploadData.url || uploadData.data?.url
      if (!uploadRes.ok || !url) throw new Error(uploadData.error || "Upload failed")

      const response = await fetch(`/api/reels/${duetReel.id}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: createTitle.trim() || `Duet with @${duetReel.author?.username || "creator"}`,
          description: createTitle.trim() || null,
          type: uploadFile.type.startsWith("video") ? "video" : "image",
          content_url: url,
          hashtags: ["duet", ...(duetReel.hashtags || []).slice(0, 3)],
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Duet failed")
      toast({ title: "Duet published" })
      setDuetReel(null)
      setUploadFile(null)
      setCreateTitle("")
      await fetchReels()
    } catch (error: any) {
      toast({ title: "Duet failed", description: error.message, variant: "destructive" })
    } finally {
      setDueting(false)
    }
  }

  const interact = async (reel: Reel, type: "like" | "save") => {
    if (!user) {
      toast({ title: "Sign in to interact" })
      return
    }
    if (reel.source === "loop") {
      toast({ title: "Convert to a Reel to like this clip" })
      return
    }

    const liked = type === "like" ? !reel.is_liked : reel.is_liked
    const saved = type === "save" ? !reel.is_saved : reel.is_saved
    const nextCount =
      type === "like" ? Math.max(0, (reel.like_count || 0) + (reel.is_liked ? -1 : 1)) : reel.like_count

    setReels((prev) =>
      prev.map((r) =>
        r.id === reel.id
          ? {
              ...r,
              is_liked: type === "like" ? !r.is_liked : r.is_liked,
              is_saved: type === "save" ? !r.is_saved : r.is_saved,
              like_count: type === "like" ? nextCount : r.like_count,
            }
          : r,
      ),
    )

    const response = await fetch(`/api/reels/${reel.id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({
        type,
        action: type === "like" ? (reel.is_liked ? "remove" : "add") : reel.is_saved ? "remove" : "add",
      }),
    })

    if (response.ok && type === "like") {
      await supabase.channel("reels:public").send({
        type: "broadcast",
        event: "reel:liked",
        payload: { reel_id: reel.id, like_count: nextCount, liked, user_id: user.id },
      })
    }
  }

  const share = async (reel: Reel) => {
    const url = `${window.location.origin}/reels?focus=${reel.id}`
    try {
      if (navigator.share) await navigator.share({ title: reel.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast({ title: "Link copied" })
      }
    } catch {}
  }

  const openComments = async (reel: Reel) => {
    setCommentOpen(reel)
    setComments([])
    setReplyTo(null)
    if (reel.source === "loop") return
    const response = await fetch(`/api/reels/${reel.id}/comments`)
    if (response.ok) {
      const data = await response.json()
      setComments(data.comments || data.data?.comments || [])
    }
  }

  const sendComment = async () => {
    if (!user || !commentOpen || !commentText.trim()) return
    const response = await fetch(`/api/reels/${commentOpen.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({
        content: commentText.trim(),
        parent_comment_id: replyTo?.id || null,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      toast({ title: "Comment failed", description: data.error, variant: "destructive" })
      return
    }

    const created = data.comment || data.data?.comment
    if (replyTo?.id) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), created] } : c,
        ),
      )
    } else {
      setComments((prev) => [...prev, { ...created, replies: [] }])
    }

    setCommentText("")
    setReplyTo(null)
    const nextCount = (commentOpen.comment_count || 0) + 1
    setReels((prev) =>
      prev.map((r) => (r.id === commentOpen.id ? { ...r, comment_count: nextCount } : r)),
    )
    setCommentOpen((prev) => (prev ? { ...prev, comment_count: nextCount } : prev))
  }

  const createReel = async () => {
    if (!user || !uploadFile || !createTitle.trim()) {
      toast({ title: "Title and media required", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("type", uploadFile.type.startsWith("video") ? "video" : "image")
      formData.append("folder", "reels")
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      })
      const uploadData = await uploadRes.json()
      const url = uploadData.url || uploadData.data?.url
      if (!uploadRes.ok || !url) throw new Error(uploadData.error || "Upload failed")

      const response = await fetch("/api/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createTitle.trim(),
          content_type: uploadFile.type.startsWith("video") ? "video" : "image",
          content_url: url,
          hashtags: createHashtags
            .split(/[\s,#]+/)
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
          effects: createEffect !== "none" ? { filter: createEffect } : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create reel")
      toast({ title: "Reel published" })
      setCreateOpen(false)
      setCreateTitle("")
      setCreateHashtags("")
      setCreateEffect("none")
      setUploadFile(null)
      await fetchReels()
    } catch (error: any) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!reels.length) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <Music2 className="h-10 w-10 text-cyan-300" />
        <h2 className="text-2xl font-semibold">No reels yet</h2>
        <p className="max-w-sm text-sm text-white/70">Be the first to publish a vertical clip for the feed.</p>
        {user && (
          <Button className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Reel
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="relative h-[100dvh] bg-black text-white">
      <div className="absolute left-3 top-3 z-30 flex items-center gap-2 sm:left-4 sm:top-4">
        <Link href="/" className="rounded-full bg-black/40 px-3 py-1.5 text-sm backdrop-blur">
          Loop
        </Link>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.2em]">Reels</span>
      </div>
      <div className="absolute right-3 top-3 z-30 flex gap-2 sm:right-4 sm:top-4">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full bg-black/40 px-3 text-white hover:bg-black/60"
          onClick={cycleSpeed}
        >
          <Gauge className="mr-1 h-4 w-4" />
          {playbackRate}x
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full bg-black/40 text-white hover:bg-black/60"
          onClick={() => setMuted((m) => !m)}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
        {user && (
          <Button
            size="icon"
            className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div
        ref={containerRef}
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {reels.map((reel, index) => {
          const mediaType = reel.content_type || reel.type || "video"
          const active = index === activeIndex
          return (
            <section
              key={reel.id}
              data-reel-slide
              data-index={index}
              className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center overflow-hidden"
            >
              {mediaType === "image" ? (
                <img
                  src={reel.content_url}
                  alt={reel.title}
                  className="h-full w-full object-cover"
                  onClick={() => doubleTapLike(reel)}
                />
              ) : (
                <video
                  ref={(el) => {
                    if (el) videoRefs.current.set(reel.id, el)
                    else videoRefs.current.delete(reel.id)
                  }}
                  src={reel.content_url}
                  poster={reel.thumbnail_url || undefined}
                  className="h-full w-full object-cover"
                  style={
                    reel.effects?.filter === "vivid"
                      ? { filter: "saturate(1.4) contrast(1.1)" }
                      : reel.effects?.filter === "noir"
                        ? { filter: "grayscale(1) contrast(1.2)" }
                        : reel.effects?.filter === "warm"
                          ? { filter: "sepia(0.25) saturate(1.2)" }
                          : undefined
                  }
                  playsInline
                  loop
                  muted={muted}
                  preload={Math.abs(index - activeIndex) <= 1 ? "auto" : "metadata"}
                  onClick={() => doubleTapLike(reel)}
                />
              )}

              {active && heartBurst && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                  <Heart className="h-24 w-24 fill-white text-white drop-shadow-xl animate-in zoom-in-50 fade-in duration-300" />
                </div>
              )}

              {active && (
                <div className="absolute inset-x-0 top-0 z-20 h-0.5 bg-white/15">
                  <div className="h-full bg-white/80 transition-[width] duration-150" style={{ width: `${progress}%` }} />
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

              <div className="absolute bottom-24 left-4 right-20 z-20 space-y-3 sm:bottom-28 sm:left-6">
                <Link href={`/profile/${reel.author?.username || ""}`} className="pointer-events-auto inline-flex items-center gap-3">
                  <Avatar className="h-11 w-11 border-2 border-white/40">
                    <AvatarImage src={reel.author?.avatar_url} />
                    <AvatarFallback>{(reel.author?.display_name || "U").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">@{reel.author?.username || "creator"}</p>
                    <p className="text-xs text-white/70">{reel.author?.display_name}</p>
                  </div>
                </Link>
                <p className="text-base font-medium leading-snug">{reel.title}</p>
                {reel.description && reel.description !== reel.title && (
                  <p className="line-clamp-2 text-sm text-white/80">{reel.description}</p>
                )}
                {!!reel.hashtags?.length && (
                  <p className="text-sm text-cyan-200">{reel.hashtags.map((t) => `#${t}`).join(" ")}</p>
                )}
              </div>

              <div className="absolute bottom-28 right-3 z-20 flex flex-col items-center gap-4 sm:right-5">
                <button className="pointer-events-auto flex flex-col items-center gap-1" onClick={() => interact(reel, "like")}>
                  <span className={cn("rounded-full bg-black/35 p-3 backdrop-blur", reel.is_liked && "text-rose-400")}>
                    <Heart className={cn("h-6 w-6", reel.is_liked && "fill-current")} />
                  </span>
                  <span className="text-xs">{reel.like_count || 0}</span>
                </button>
                <button className="pointer-events-auto flex flex-col items-center gap-1" onClick={() => openComments(reel)}>
                  <span className="rounded-full bg-black/35 p-3 backdrop-blur">
                    <MessageCircle className="h-6 w-6" />
                  </span>
                  <span className="text-xs">{reel.comment_count || 0}</span>
                </button>
                <button className="pointer-events-auto flex flex-col items-center gap-1" onClick={() => interact(reel, "save")}>
                  <span className={cn("rounded-full bg-black/35 p-3 backdrop-blur", reel.is_saved && "text-amber-300")}>
                    <Bookmark className={cn("h-6 w-6", reel.is_saved && "fill-current")} />
                  </span>
                  <span className="text-xs">Save</span>
                </button>
                <button className="pointer-events-auto flex flex-col items-center gap-1" onClick={() => share(reel)}>
                  <span className="rounded-full bg-black/35 p-3 backdrop-blur">
                    <Share2 className="h-6 w-6" />
                  </span>
                  <span className="text-xs">Share</span>
                </button>
                {reel.source !== "loop" && (
                  <button
                    className="pointer-events-auto flex flex-col items-center gap-1"
                    onClick={() => {
                      if (!user) {
                        toast({ title: "Sign in to duet" })
                        return
                      }
                      setDuetReel(reel)
                      setCreateTitle("")
                      setUploadFile(null)
                    }}
                  >
                    <span className="rounded-full bg-black/35 p-3 backdrop-blur">
                      <GitBranch className="h-6 w-6" />
                    </span>
                    <span className="text-xs">Duet</span>
                  </button>
                )}
              </div>

              {!active && <div className="absolute inset-0 bg-black/20" />}
            </section>
          )
        })}
      </div>

      <Dialog
        open={!!commentOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCommentOpen(null)
            setReplyTo(null)
          }
        }}
      >
        <DialogContent className="max-h-[80vh] overflow-hidden bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          <div className="max-h-72 space-y-3 overflow-y-auto">
            {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
            {comments.map((comment: any) => (
              <div key={comment.id || comment.created_at} className="space-y-2 rounded-xl border p-3 text-sm">
                <p className="font-medium">@{comment.author?.username || comment.user?.username || "user"}</p>
                <p className="text-muted-foreground">{comment.content}</p>
                <button
                  type="button"
                  className="text-xs font-semibold text-sky-500"
                  onClick={() =>
                    setReplyTo({
                      id: comment.id,
                      username: comment.author?.username || comment.user?.username,
                    })
                  }
                >
                  Reply
                </button>
                {(comment.replies || []).map((reply: any) => (
                  <div key={reply.id} className="ml-4 rounded-lg border border-border/60 bg-muted/30 p-2">
                    <p className="font-medium">@{reply.author?.username || "user"}</p>
                    <p className="text-muted-foreground">{reply.content}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {replyTo && (
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
              <span>Replying to @{replyTo.username || "user"}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="font-semibold">
                Cancel
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={replyTo ? `Reply to @${replyTo.username || "user"}...` : "Add a comment..."}
              onKeyDown={(e) => e.key === "Enter" && sendComment()}
            />
            <Button onClick={sendComment}>Send</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a Reel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Caption / title" />
            <Input
              value={createHashtags}
              onChange={(e) => setCreateHashtags(e.target.value)}
              placeholder="hashtags (music vibe travel)"
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={createEffect}
              onChange={(e) => setCreateEffect(e.target.value)}
            >
              <option value="none">No filter</option>
              <option value="vivid">Vivid</option>
              <option value="noir">Noir</option>
              <option value="warm">Warm</option>
            </select>
            <Input
              type="file"
              accept="video/*,image/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
            <Button className="w-full rounded-full" disabled={creating} onClick={createReel}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish Reel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!duetReel} onOpenChange={(open) => !open && setDuetReel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duet with @{duetReel?.author?.username || "creator"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Upload your side of the duet — Loop stitches it as a branch.</p>
            <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Duet caption" />
            <Input
              type="file"
              accept="video/*,image/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
            <Button className="w-full rounded-full" disabled={dueting} onClick={createDuet}>
              {dueting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish Duet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
