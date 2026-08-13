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
  MoreHorizontal,
  Pencil,
  Trash2,
  Clock3,
  Send,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { ShareToDmModal } from "@/components/messages/share-to-dm-modal"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { RichContent } from "@/components/content/rich-content"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { parseJsonResponse } from "@/lib/parse-json-response"

function timeAgo(iso?: string) {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`
  if (ms < 86_400_000 * 7) return `${Math.floor(ms / 86_400_000)}d`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

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
  const [dmShareOpen, setDmShareOpen] = useState(false)
  const [dmShareItem, setDmShareItem] = useState<{ id: string; type: "reel" | "loop"; title?: string; text?: string; authorName?: string; mediaUrl?: string; mediaType?: string } | null>(null)
  const [editReel, setEditReel] = useState<Reel | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editHashtags, setEditHashtags] = useState("")
  const [editEffect, setEditEffect] = useState("none")
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
      const mediaType = uploadFile.type.startsWith("video") ? "video" : "image"
      const uploaded = await uploadMediaFile(uploadFile, {
        type: mediaType,
        folder: "reels",
        authHeaders: getAuthHeader(),
      })
      const url = uploaded.url

      const response = await fetch(`/api/reels/${duetReel.id}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: createTitle.trim() || `Duet with @${duetReel.author?.username || "creator"}`,
          description: createTitle.trim() || null,
          type: mediaType,
          content_url: url,
          hashtags: ["duet", ...(duetReel.hashtags || []).slice(0, 3)],
        }),
      })
      const { data } = await parseJsonResponse<any>(response)
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
    setDmShareItem({
      id: reel.id,
      type: "reel",
      title: reel.title,
      text: reel.description || reel.title,
      authorName: reel.author?.display_name || reel.author?.username,
      mediaUrl: reel.content_url,
      mediaType: reel.content_type || reel.type,
    })
    setDmShareOpen(true)
  }

  const openEdit = (reel: Reel) => {
    setEditReel(reel)
    setEditTitle(reel.title || "")
    setEditDescription(reel.description || "")
    setEditHashtags((reel.hashtags || []).join(" "))
    setEditEffect(reel.effects?.filter || "none")
  }

  const saveEdit = async () => {
    if (!editReel) return
    setSavingEdit(true)
    try {
      const response = await fetch(`/api/reels/${editReel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          hashtags: editHashtags
            .split(/[\s,#]+/)
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
          effects: editEffect !== "none" ? { filter: editEffect } : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to edit reel")
      const updated = data.data?.reel
      if (updated) {
        setReels((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated, type: updated.content_type } : r)))
      }
      toast({ title: "Reel updated" })
      setEditReel(null)
    } catch (error: any) {
      toast({ title: "Edit failed", description: error.message, variant: "destructive" })
    } finally {
      setSavingEdit(false)
    }
  }

  const deleteReel = async (reel: Reel) => {
    if (!window.confirm("Delete this reel? This can't be undone.")) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/reels/${reel.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to delete reel")
      setReels((prev) => prev.filter((r) => r.id !== reel.id))
      setActiveIndex((i) => Math.min(i, reels.length - 2))
      toast({ title: "Reel deleted" })
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
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

  const toggleCommentLike = async (comment: any) => {
    if (!user) {
      toast({ title: "Sign in to like comments" })
      return
    }
    if (!commentOpen) return

    const liked = !comment.is_liked
    const nextCount = Math.max(0, Number(comment.like_count || 0) + (liked ? 1 : -1))
    // Optimistic update
    const updateComment = (c: any): any =>
      c.id === comment.id ? { ...c, is_liked: liked, like_count: nextCount } : c
    setComments((prev) =>
      prev.map((c) =>
        c.id === comment.id
          ? updateComment(c)
          : { ...c, replies: (c.replies || []).map(updateComment) },
      ),
    )

    try {
      const res = await fetch(`/api/reels/${commentOpen.id}/comments/${comment.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      })
      const data = await res.json()
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Failed to update like")
      }
      // Sync authoritative counts
      const sync = (c: any): any =>
        c.id === comment.id ? { ...c, is_liked: data.liked, like_count: Number(data.like_count) } : c
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? sync(c) : { ...c, replies: (c.replies || []).map(sync) })),
      )
    } catch (err: any) {
      // Roll back
      const rollback = (c: any): any =>
        c.id === comment.id ? { ...c, is_liked: !liked, like_count: Number(comment.like_count || 0) } : c
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? rollback(c) : { ...c, replies: (c.replies || []).map(rollback) })),
      )
      toast({ title: "Couldn't like comment", description: err.message, variant: "destructive" })
    }
  }

  const createReel = async () => {
    if (!user || !uploadFile || !createTitle.trim()) {
      toast({ title: "Title and media required", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      const mediaType = uploadFile.type.startsWith("video") ? "video" : "image"
      const uploaded = await uploadMediaFile(uploadFile, {
        type: mediaType,
        folder: "reels",
        authHeaders: getAuthHeader(),
      })
      const url = uploaded.url

      const response = await fetch("/api/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: createTitle.trim(),
          description: createTitle.trim(),
          content_type: mediaType,
          content_url: url,
          hashtags: createHashtags
            .split(/[\s,#]+/)
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
          effects: createEffect !== "none" ? { filter: createEffect } : null,
        }),
      })
      const { data } = await parseJsonResponse<any>(response)
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

              <div className="absolute bottom-28 right-3 z-20 flex flex-col items-center gap-3 sm:right-5">
                <button className="pointer-events-auto flex flex-col items-center gap-1" onClick={() => interact(reel, "like")}>
                  <span className={cn("rounded-full bg-black/35 p-2.5 backdrop-blur", reel.is_liked && "text-rose-400")}>
                    <Heart className={cn("h-6 w-6", reel.is_liked && "fill-current")} />
                  </span>
                  <span className="text-xs">{reel.like_count || 0}</span>
                </button>
                <button className="pointer-events-auto flex flex-col items-center gap-1" onClick={() => openComments(reel)}>
                  <span className="rounded-full bg-black/35 p-2.5 backdrop-blur">
                    <MessageCircle className="h-6 w-6" />
                  </span>
                  <span className="text-xs">{reel.comment_count || 0}</span>
                </button>
                <button className="pointer-events-auto flex flex-col items-center gap-1" onClick={() => share(reel)}>
                  <span className="rounded-full bg-black/35 p-2.5 backdrop-blur">
                    <Share2 className="h-6 w-6" />
                  </span>
                  <span className="text-xs">Share</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="pointer-events-auto flex flex-col items-center gap-1" title="More">
                      <span className="rounded-full bg-black/35 p-2.5 backdrop-blur">
                        <MoreHorizontal className="h-6 w-6" />
                      </span>
                      <span className="text-xs">More</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="left" className="w-44 bg-black/85 backdrop-blur">
                    <DropdownMenuItem
                      onClick={() => interact(reel, "save")}
                      className={cn(reel.is_saved && "text-amber-300")}
                    >
                      <Bookmark className={cn("h-4 w-4 mr-2", reel.is_saved && "fill-current")} />
                      {reel.is_saved ? "Saved" : "Save reel"}
                    </DropdownMenuItem>
                    {reel.source !== "loop" && (
                      <DropdownMenuItem
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
                        <GitBranch className="h-4 w-4 mr-2" />
                        Duet this reel
                      </DropdownMenuItem>
                    )}
                    {user && reel.author?.id === user.id && reel.source !== "loop" && (
                      <>
                        <DropdownMenuItem onClick={() => openEdit(reel)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit reel
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-rose-400"
                          onClick={() => void deleteReel(reel)}
                          disabled={deleting}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete reel
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
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
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden bg-background p-0 sm:max-w-md">
          {/* Header with reel preview */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-black">
              {commentOpen?.content_url && (
                <video src={commentOpen.content_url} className="h-full w-full object-cover" muted playsInline />
              )}
              <div className="absolute inset-0 bg-black/10" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">
                {comments.length} comment{comments.length === 1 ? "" : "s"}
              </DialogTitle>
              <p className="truncate text-xs text-muted-foreground">@{commentOpen?.author?.username || "creator"} · {commentOpen?.title}</p>
            </div>
          </div>

          {/* Comment list */}
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {comments.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No comments yet. Start the conversation!</p>
              </div>
            )}
            {comments.map((comment: any) => {
              const author = comment.author || comment.user || {}
              return (
                <div key={comment.id || comment.created_at}>
                  <div className="flex gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={author.avatar_url} />
                      <AvatarFallback>{(author.username || "U").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold">
                          {author.display_name || author.username || "user"}
                        </span>
                        <span className="text-xs text-muted-foreground">@{author.username || "user"}</span>
                        <span className="text-xs text-muted-foreground/70">· {timeAgo(comment.created_at)}</span>
                      </div>
                      <div className="mt-0.5 text-sm leading-relaxed">
                        <RichContent text={comment.content} as="p" />
                      </div>
                      <div className="mt-1 flex items-center gap-3">
                        <button
                          type="button"
                          className="text-xs font-semibold text-violet-500 transition hover:text-violet-400"
                          onClick={() =>
                            setReplyTo({
                              id: comment.id,
                              username: author.username,
                            })
                          }
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "flex items-center gap-1 text-xs font-medium transition",
                            comment.is_liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-400",
                          )}
                          onClick={() => void toggleCommentLike(comment)}
                          title={comment.is_liked ? "Unlike comment" : "Like comment"}
                        >
                          <Heart className={cn("h-3.5 w-3.5", comment.is_liked && "fill-current")} />
                          {Number(comment.like_count || 0) > 0 && comment.like_count}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Nested replies */}
                  {(comment.replies || []).length > 0 && (
                    <div className="mt-3 space-y-3 border-l-2 border-border/60 pl-4 ml-[18px]">
                      {(comment.replies || []).map((reply: any) => {
                        const rAuthor = reply.author || reply.user || {}
                        return (
                          <div key={reply.id} className="flex gap-3">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarImage src={rAuthor.avatar_url} />
                              <AvatarFallback>{(rAuthor.username || "U").charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="text-sm font-semibold">
                                  {rAuthor.display_name || rAuthor.username || "user"}
                                </span>
                                <span className="text-xs text-muted-foreground">@{rAuthor.username || "user"}</span>
                                <span className="text-xs text-muted-foreground/70">· {timeAgo(reply.created_at)}</span>
                              </div>
                              <div className="mt-0.5 text-sm leading-relaxed">
                                <RichContent text={reply.content} as="p" />
                              </div>
                              <div className="mt-1 flex items-center gap-3">
                                <button
                                  type="button"
                                  className="text-xs font-semibold text-violet-500 transition hover:text-violet-400"
                                  onClick={() =>
                                    setReplyTo({
                                      id: reply.id,
                                      username: rAuthor.username,
                                    })
                                  }
                                >
                                  Reply
                                </button>
                                <button
                                  type="button"
                                  className={cn(
                                    "flex items-center gap-1 text-xs font-medium transition",
                                    reply.is_liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-400",
                                  )}
                                  onClick={() => void toggleCommentLike(reply)}
                                  title={reply.is_liked ? "Unlike comment" : "Like comment"}
                                >
                                  <Heart className={cn("h-3.5 w-3.5", reply.is_liked && "fill-current")} />
                                  {Number(reply.like_count || 0) > 0 && reply.like_count}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Composer */}
          <div className="border-t bg-muted/20 px-4 py-3">
            {replyTo && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-violet-500/10 px-3 py-1.5 text-xs">
                <span className="text-violet-400">Replying to @{replyTo.username || "user"}</span>
                <button type="button" onClick={() => setReplyTo(null)} className="font-semibold text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <MentionTextarea
                value={commentText}
                onChange={setCommentText}
                rows={1}
                className="min-h-[42px] flex-1 rounded-2xl border-border/60 bg-background"
                placeholder={replyTo ? `Reply to @${replyTo.username || "user"}...` : "Add a comment…"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void sendComment()
                  }
                }}
              />
              <Button
                size="icon"
                className="h-[42px] w-[42px] shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-400"
                onClick={sendComment}
                disabled={!commentText.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
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

      <ShareToDmModal
        open={dmShareOpen}
        onOpenChange={setDmShareOpen}
        item={dmShareItem}
      />
    </div>
  )
}
