"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
  Bookmark,
  ChevronRight,
  Compass,
  EyeOff,
  Flag,
  Heart,
  Link2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Play,
  Plus,
  Repeat2,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ReelCommentsSheet } from "./reel-comments-sheet"
import { ReelShareSheet } from "./reel-share-sheet"

type ReelAuthor = {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  is_verified?: boolean
}

export type FeedReel = {
  id: string
  title: string
  description?: string
  content_type?: string
  type?: string
  content_url: string
  thumbnail_url?: string | null
  hashtags?: string[]
  like_count?: number
  comment_count?: number
  share_count?: number
  view_count?: number
  is_liked?: boolean
  is_saved?: boolean
  is_following?: boolean
  author?: ReelAuthor
  author_id?: string
  source?: string
}

type Category = "trending" | "following"

function formatCount(value?: number) {
  const n = Number(value || 0)
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0).replace(/\.0$/, "")}M`
}

export function ReelsFeed() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [category, setCategory] = useState<Category>("trending")
  const [reels, setReels] = useState<FeedReel[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [burstKey, setBurstKey] = useState(0)
  const [commentsFor, setCommentsFor] = useState<FeedReel | null>(null)
  const [shareFor, setShareFor] = useState<FeedReel | null>(null)
  const [actionsFor, setActionsFor] = useState<FeedReel | null>(null)
  const [followPending, setFollowPending] = useState<Set<string>>(new Set())
  const [captionExpanded, setCaptionExpanded] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const videosRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const pageRef = useRef(1)
  const seenViewsRef = useRef<Set<string>>(new Set())
  const tapTimerRef = useRef<number | null>(null)
  const lastTapRef = useRef(0)
  const pressTimerRef = useRef<number | null>(null)
  const longPressFiredRef = useRef(false)
  const tapStartRef = useRef<{ x: number; y: number } | null>(null)
  const tapMovedRef = useRef(false)
  const focusHandledRef = useRef(false)
  const focusIdRef = useRef<string | null>(null)
  const categoryRef = useRef<Category>("trending")
  const progressRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    focusIdRef.current = new URLSearchParams(window.location.search).get("focus")
  }, [])

  const active = reels[activeIndex]

  /* ---------------------------------------------------------------- data */

  const loadPage = useCallback(
    async (page: number, replace: boolean) => {
      const params = new URLSearchParams({
        category,
        page: String(page),
        limit: "8",
      })
      if (category === "trending") params.set("shuffle", "true")
      if (focusIdRef.current && !focusHandledRef.current) params.set("focus", focusIdRef.current)

      const requestedCategory = category
      const res = await fetch(`/api/reels?${params.toString()}`, { headers: { ...getAuthHeader() } })
      const json = await res.json().catch(() => ({}))
      if (requestedCategory !== categoryRef.current) return
      if (!res.ok) throw new Error(json?.error || "Could not load the feed")
      const next: FeedReel[] = json?.data?.reels || []
      setHasMore(Boolean(json?.data?.has_more ?? next.length > 0))
      setReels((current) => {
        if (replace) return next
        const known = new Set(current.map((item) => item.id))
        return [...current, ...next.filter((item) => !known.has(item.id))]
      })
      if (replace && focusIdRef.current && !focusHandledRef.current) {
        focusHandledRef.current = true
        const index = next.findIndex((item) => item.id === focusIdRef.current)
        if (index > 0) {
          setActiveIndex(index)
          requestAnimationFrame(() => {
            const slide = containerRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)
            slide?.scrollIntoView({ block: "start" })
          })
        }
      }
    },
    [category, getAuthHeader],
  )

  useEffect(() => {
    let cancelled = false
    categoryRef.current = category
    setLoading(true)
    setReels([])
    setActiveIndex(0)
    containerRef.current?.scrollTo({ top: 0 })
    pageRef.current = 1
    focusHandledRef.current = false
    loadPage(1, true)
      .catch((err) => {
        if (!cancelled) toast({ title: "Feed unavailable", description: err.message, variant: "destructive" })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = pageRef.current + 1
      await loadPage(nextPage, false)
      pageRef.current = nextPage
    } catch {
      /* keep the current feed; the next scroll retries */
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loadPage, loading, loadingMore])

  useEffect(() => {
    if (activeIndex >= reels.length - 3 && reels.length > 0) void loadMore()
  }, [activeIndex, loadMore, reels.length])

  /* ------------------------------------------------------------ playback */

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-reel-slide]"))
    if (!slides.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } | null = null
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index)
          if (!entry.isIntersecting) continue
          if (!best || entry.intersectionRatio > best.ratio) best = { index, ratio: entry.intersectionRatio }
        }
        if (best && best.ratio >= 0.55) {
          setActiveIndex((current) => (current === best!.index ? current : best!.index))
        }
      },
      { root, threshold: [0.4, 0.55, 0.75, 0.95] },
    )
    slides.forEach((slide) => observer.observe(slide))
    return () => observer.disconnect()
  }, [reels.length, category])

  useEffect(() => {
    setPaused(false)
    setCaptionExpanded(false)
    if (progressRef.current) progressRef.current.style.width = "0%"
    const id = active?.id
    for (const [videoId, video] of videosRef.current) {
      if (videoId !== id) {
        video.pause()
        video.currentTime = 0
      }
    }
    if (!id) return
    const video = videosRef.current.get(id)
    if (!video) return
    video.muted = muted
    if (paused) return
    const playPromise = video.play()
    if (playPromise) playPromise.catch(() => setPaused(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, active?.id, category])

  useEffect(() => {
    for (const video of videosRef.current.values()) video.muted = muted
  }, [muted])

  useEffect(() => {
    const video = active ? videosRef.current.get(active.id) : null
    if (!video) return
    if (paused) video.pause()
    else void video.play().catch(() => setPaused(true))
  }, [paused, active])

  useEffect(() => {
    // The interactions endpoint is authenticated; don't fire guest requests
    // that can only fail.
    if (!active || !user) return
    if (seenViewsRef.current.has(active.id)) return
    seenViewsRef.current.add(active.id)
    void fetch(`/api/reels/${active.id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ type: "view", action: "add" }),
    }).catch(() => undefined)
  }, [active, getAuthHeader, user])

  /* ------------------------------------------------------------- actions */

  const patchReel = (id: string, patch: Partial<FeedReel>) => {
    setReels((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const interact = async (reel: FeedReel, type: "like" | "save" | "share", action: "add" | "remove") => {
    await fetch(`/api/reels/${reel.id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ type, action }),
    }).catch(() => undefined)
  }

  const requireUser = () => {
    if (user) return true
    toast({ title: "Sign in to keep going", description: "Join Loop to like, comment, save and follow." })
    return false
  }

  const toggleLike = (reel: FeedReel, forceLike = false) => {
    if (!requireUser()) return
    const liked = forceLike ? true : !reel.is_liked
    if (forceLike && reel.is_liked) {
      setBurstKey((key) => key + 1)
      return
    }
    patchReel(reel.id, {
      is_liked: liked,
      like_count: Math.max(0, Number(reel.like_count || 0) + (liked ? 1 : -1)),
    })
    if (liked) setBurstKey((key) => key + 1)
    void interact(reel, "like", liked ? "add" : "remove")
  }

  const toggleSave = (reel: FeedReel) => {
    if (!requireUser()) return
    const saved = !reel.is_saved
    patchReel(reel.id, { is_saved: saved })
    toast({ title: saved ? "Saved to your collection" : "Removed from saved" })
    void interact(reel, "save", saved ? "add" : "remove")
  }

  const toggleFollow = async (reel: FeedReel) => {
    const author = reel.author
    if (!author?.id) return
    if (!requireUser()) return
    if (author.id === user?.id) return
    if (followPending.has(author.id)) return
    const following = !reel.is_following
    setFollowPending((current) => new Set(current).add(author.id))
    setReels((current) =>
      current.map((item) =>
        item.author?.id === author.id ? { ...item, is_following: following } : item,
      ),
    )
    try {
      const res = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ target_user_id: author.id, action: following ? "follow" : "unfollow" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Could not update follow")
      if (json?.pending) toast({ title: "Follow request sent" })
      else toast({ title: following ? `Following @${author.username}` : `Unfollowed @${author.username}` })
    } catch (err: any) {
      setReels((current) =>
        current.map((item) =>
          item.author?.id === author.id ? { ...item, is_following: !following } : item,
        ),
      )
      toast({ title: "Follow failed", description: err.message, variant: "destructive" })
    } finally {
      setFollowPending((current) => {
        const next = new Set(current)
        next.delete(author.id)
        return next
      })
    }
  }

  const markShare = (reel: FeedReel) => {
    patchReel(reel.id, { share_count: Number(reel.share_count || 0) + 1 })
    void interact(reel, "share", "add")
  }

  const closeActions = () => {
    setActionsFor(null)
    setPaused(false)
  }

  const notInterested = (reel: FeedReel) => {
    closeActions()
    setReels((current) => current.filter((item) => item.id !== reel.id))
    toast({ title: "Thanks — you'll see fewer reels like this" })
  }

  const copyLink = async (reel: FeedReel) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/reels?focus=${reel.id}`)
      toast({ title: "Link copied" })
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" })
    }
  }

  const report = async (reel: FeedReel) => {
    closeActions()
    try {
      const res = await fetch("/api/moderation/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ contentId: reel.id, contentType: "reel", reason: "other" }),
      })
      if (!res.ok) throw new Error("report failed")
      toast({ title: "Report received", description: "Thanks — our moderation team will review this." })
    } catch {
      toast({ title: "Could not send report", description: "Please try again later.", variant: "destructive" })
    }
  }

  /* ---------------------------------------------------------------- taps */

  const onTap = (reel: FeedReel) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
    const now = Date.now()
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current)
      tapTimerRef.current = null
      toggleLike(reel, true)
      return
    }
    lastTapRef.current = now
    if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current)
    tapTimerRef.current = window.setTimeout(() => {
      setPaused((value) => !value)
    }, 300)
  }

  const startPress = (reel: FeedReel) => {
    longPressFiredRef.current = false
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
    pressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true
      navigator.vibrate?.(8)
      setActionsFor(reel)
    }, 500)
  }

  const endPress = () => {
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
    pressTimerRef.current = null
  }

  const authorIsSelf = Boolean(user && active?.author?.id === user.id)

  /* ---------------------------------------------------------------- view */

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between bg-gradient-to-b from-black/60 to-transparent px-4 pb-8 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <Link href="/" className="pointer-events-auto text-sm font-black tracking-tight text-white/85">
          LOOP
        </Link>

        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/25 p-1 backdrop-blur-md">
          {([
            ["trending", "For You"],
            ["following", "Following"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={cn(
                "relative rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                category === value ? "text-white" : "text-white/55 hover:text-white/80",
              )}
            >
              {category === value && (
                <motion.span
                  layoutId="reels-active-tab"
                  className="absolute inset-0 rounded-full bg-white/15"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <Link
            href="/explore/reels"
            aria-label="Explore reels"
            className="rounded-full bg-black/25 p-2 backdrop-blur-md transition hover:bg-black/40"
          >
            <Compass className="h-4 w-4" />
          </Link>
          <Link
            href="/create?type=reel"
            aria-label="Create a reel"
            className="rounded-full bg-white p-2 text-black shadow-lg transition hover:bg-white/85"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </Link>
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? "Unmute" : "Mute"}
            className="rounded-full bg-black/25 p-2 backdrop-blur-md transition hover:bg-black/40"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* feed */}
      <div
        ref={containerRef}
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reels.map((reel, index) => {
          const isActive = index === activeIndex
          const shouldMount = Math.abs(index - activeIndex) <= 1
          const mediaType = reel.content_type || reel.type || "video"
          const isImage = mediaType === "image"
          const isStill = mediaType === "audio" || mediaType === "text"
          const author = reel.author

          return (
            <section
              key={reel.id}
              data-reel-slide
              data-index={index}
              className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden bg-black"
            >
              {!shouldMount || isImage || isStill ? (
                reel.thumbnail_url || isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={reel.thumbnail_url || reel.content_url}
                    alt={reel.title}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 via-black to-neutral-950">
                    <Music2 className="h-16 w-16 text-white/20" />
                  </div>
                )
              ) : (
                <video
                  ref={(element) => {
                    if (element) videosRef.current.set(reel.id, element)
                    else videosRef.current.delete(reel.id)
                  }}
                  src={reel.content_url}
                  poster={reel.thumbnail_url || undefined}
                  className="h-full w-full object-contain"
                  playsInline
                  loop
                  muted={muted}
                  preload={Math.abs(index - activeIndex) <= 1 ? "auto" : "none"}
                  disablePictureInPicture
                  controls={false}
                  onTimeUpdate={(event) => {
                    if (!isActive) return
                    const video = event.currentTarget
                    if (!video.duration || !progressRef.current) return
                    progressRef.current.style.width = `${(video.currentTime / video.duration) * 100}%`
                  }}
                  onContextMenu={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                />
              )}

              {/* tap / long-press surface */}
              <button
                type="button"
                aria-label={paused ? "Play" : "Pause"}
                className="absolute inset-0 z-10 h-full w-full cursor-default focus:outline-none"
                onPointerDown={(event) => {
                  tapMovedRef.current = false
                  tapStartRef.current = { x: event.clientX, y: event.clientY }
                  startPress(reel)
                }}
                onPointerMove={(event) => {
                  const start = tapStartRef.current
                  if (!start) return
                  if (Math.abs(event.clientX - start.x) > 12 || Math.abs(event.clientY - start.y) > 12) {
                    tapMovedRef.current = true
                    endPress()
                  }
                }}
                onPointerUp={() => {
                  endPress()
                  tapStartRef.current = null
                  if (tapMovedRef.current) {
                    tapMovedRef.current = false
                    return
                  }
                  onTap(reel)
                }}
                onPointerLeave={() => {
                  tapStartRef.current = null
                  endPress()
                }}
                onPointerCancel={endPress}
                onContextMenu={(event) => event.preventDefault()}
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/35" />

              {/* pause indicator */}
              <AnimatePresence>
                {isActive && paused && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                  >
                    <div className="rounded-full bg-black/45 p-4 backdrop-blur-sm">
                      <Play className="h-9 w-9 fill-white text-white" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* double-tap heart */}
              <AnimatePresence>
                {isActive && burstKey > 0 && (
                  <motion.div
                    key={burstKey}
                    initial={{ opacity: 0, scale: 0.2 }}
                    animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.25, 1, 1.1], y: [0, 0, -12, -36] }}
                    transition={{ duration: 0.85, ease: "easeOut" }}
                    className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                    onAnimationComplete={() => undefined}
                  >
                    <Heart className="h-28 w-28 fill-rose-500 text-rose-500 drop-shadow-[0_0_24px_rgba(244,63,94,0.55)]" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* right rail */}
              <div className="absolute bottom-24 right-2.5 z-30 flex flex-col items-center gap-4 sm:right-4">
                <div className="relative mb-1">
                  <Link href={author?.username ? `/profile/${author.username}` : "#"} onClick={(event) => event.stopPropagation()}>
                    <Avatar className="h-11 w-11 border-2 border-white/80 shadow-lg">
                      <AvatarImage src={author?.avatar_url} />
                      <AvatarFallback className="text-sm">{(author?.display_name || "U").charAt(0)}</AvatarFallback>
                    </Avatar>
                  </Link>
                  {!authorIsSelf && author?.id && (
                    <button
                      type="button"
                      onClick={() => void toggleFollow(reel)}
                      disabled={followPending.has(author.id)}
                      aria-label={reel.is_following ? "Unfollow" : "Follow"}
                      className={cn(
                        "absolute -bottom-2 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-black/20 transition-all",
                        reel.is_following ? "bg-white text-black" : "bg-rose-500 text-white",
                      )}
                    >
                      {reel.is_following ? (
                        <span className="text-[10px] font-bold">✓</span>
                      ) : (
                        <Plus className="h-3 w-3" strokeWidth={3} />
                      )}
                    </button>
                  )}
                </div>

                <RailButton
                  label={formatCount(reel.like_count)}
                  active={reel.is_liked}
                  activeClass="text-rose-500"
                  onClick={() => toggleLike(reel)}
                  icon={<Heart className={cn("h-7 w-7", reel.is_liked && "fill-current")} strokeWidth={1.9} />}
                />

                <RailButton
                  label={formatCount(reel.comment_count)}
                  onClick={() => {
                    setPaused(true)
                    setCommentsFor(reel)
                  }}
                  icon={<MessageCircle className="h-7 w-7" strokeWidth={1.9} />}
                />

                <RailButton
                  label={formatCount(reel.share_count) === "0" ? "Share" : formatCount(reel.share_count)}
                  onClick={() => {
                    setPaused(true)
                    setShareFor(reel)
                  }}
                  icon={<Share2 className="h-7 w-7" strokeWidth={1.9} />}
                />

                <RailButton
                  label={reel.is_saved ? "Saved" : "Save"}
                  active={reel.is_saved}
                  activeClass="text-amber-400"
                  onClick={() => toggleSave(reel)}
                  icon={<Bookmark className={cn("h-7 w-7", reel.is_saved && "fill-current")} strokeWidth={1.9} />}
                />

                <RailButton
                  label="More"
                  onClick={() => {
                    setPaused(true)
                    setActionsFor(reel)
                  }}
                  icon={<MoreHorizontal className="h-7 w-7" strokeWidth={1.9} />}
                />
              </div>

              {/* caption + audio */}
              <div className="absolute inset-x-0 bottom-0 z-30 pr-16">
                <div className="space-y-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={author?.username ? `/profile/${author.username}` : "#"}
                      className="text-[15px] font-bold tracking-tight hover:underline"
                    >
                      @{author?.username || "creator"}
                    </Link>
                    {author?.is_verified && (
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold">✓</span>
                    )}
                    {!authorIsSelf && author?.id && !reel.is_following && (
                      <button
                        type="button"
                        onClick={() => void toggleFollow(reel)}
                        className="text-[13px] font-semibold text-white/70 hover:text-white"
                      >
                        · Follow
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCaptionExpanded((value) => !value)}
                    className="block max-w-full text-left text-[13px] leading-snug text-white/95"
                  >
                    <span className={cn(!captionExpanded && "line-clamp-2")}>
                      {reel.title}
                      {reel.description && reel.description !== reel.title ? ` ${reel.description}` : ""}
                    </span>
                    {!!reel.hashtags?.length && (
                      <span className="ml-1 font-medium text-sky-300">
                        {reel.hashtags.slice(0, 6).map((tag) => `#${tag}`).join(" ")}
                      </span>
                    )}
                    {!captionExpanded && (reel.description || (reel.hashtags?.length || 0) > 0) && (
                      <span className="ml-1 text-white/50">more</span>
                    )}
                  </button>

                  <div className="flex items-center gap-2 pt-0.5">
                    <div className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-white/25 to-white/5 ring-1 ring-white/20">
                      <div className={cn(!paused && isActive && "animate-spin [animation-duration:4.5s]")}>
                        <Music2 className="h-3 w-3" />
                      </div>
                    </div>
                    <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-white/85">
                      {reel.title || "Original audio"} · @{author?.username || "loop"}
                    </p>
                    <Link
                      href={`/create?type=reel&audio=${encodeURIComponent(reel.id)}`}
                      className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm transition hover:bg-white/25"
                    >
                      Use audio
                    </Link>
                  </div>
                </div>
              </div>

              {/* progress */}
              {isActive && (
                <div className="absolute inset-x-0 bottom-0 z-40 h-[2.5px] bg-white/15">
                  <div
                    ref={progressRef}
                    className="h-full bg-white/90 transition-[width] duration-100 ease-linear"
                    style={{ width: "0%" }}
                  />
                </div>
              )}
            </section>
          )
        })}

        {loading && (
          <div className="flex h-[70dvh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        )}
      </div>

      {/* empty state */}
      {!loading && reels.length === 0 && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 px-8 text-center backdrop-blur-sm">
          {category === "following" ? (
            <>
              <p className="text-lg font-semibold">
                {user ? "Follow creators to fill this feed" : "Sign in to see who you follow"}
              </p>
              <p className="max-w-xs text-sm text-white/55">
                {user
                  ? "Reels from the people you follow show up here, newest first."
                  : "Your Following feed is built from the creators you follow on Loop."}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">No reels yet</p>
              <p className="max-w-xs text-sm text-white/55">Be the first to post a reel on Loop.</p>
            </>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Link
              href="/explore/reels"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85"
            >
              Explore reels
            </Link>
            <button
              type="button"
              onClick={() => setCategory("trending")}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/85"
            >
              For You
            </button>
          </div>
        </div>
      )}

      {/* sheets */}
      <ReelCommentsSheet
        reelId={commentsFor?.id || null}
        open={Boolean(commentsFor)}
        onOpenChange={(open) => {
          if (!open) {
            setCommentsFor(null)
            setPaused(false)
          }
        }}
        onCountChange={(delta) => {
          if (!commentsFor) return
          patchReel(commentsFor.id, {
            comment_count: Math.max(0, Number(commentsFor.comment_count || 0) + delta),
          })
        }}
      />

      <ReelShareSheet
        open={Boolean(shareFor)}
        onOpenChange={(open) => {
          if (!open) {
            setShareFor(null)
            setPaused(false)
          }
        }}
        reel={shareFor}
        onShared={() => {
          if (shareFor) markShare(shareFor)
        }}
      />

      {/* long-press actions */}
      <AnimatePresence>
        {actionsFor && (
          <div className="fixed inset-0 z-[70]">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/45" onClick={closeActions} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl border-t border-white/10 bg-[#111111] pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-2xl"
            >
              <div className="px-5 pt-3">
                <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
              </div>
              <p className="px-5 pb-2 pt-4 text-xs font-medium uppercase tracking-wider text-white/40">
                @{actionsFor.author?.username || "reel"}
              </p>
              <div className="px-2">
                <ActionRow
                  icon={<Bookmark className={cn("h-5 w-5", actionsFor.is_saved && "fill-current text-amber-400")} />}
                  label={actionsFor.is_saved ? "Remove from saved" : "Save reel"}
                  onClick={() => {
                    toggleSave(actionsFor)
                    closeActions()
                  }}
                />
                <ActionRow
                  icon={<EyeOff className="h-5 w-5" />}
                  label="Not interested"
                  onClick={() => notInterested(actionsFor)}
                />
                <ActionRow
                  icon={<Link2 className="h-5 w-5" />}
                  label="Copy link"
                  onClick={() => {
                    void copyLink(actionsFor)
                    closeActions()
                  }}
                />
                <ActionRow
                  icon={<Repeat2 className="h-5 w-5" />}
                  label="Remix this reel"
                  href={`/create?type=reel&remix=${encodeURIComponent(actionsFor.id)}`}
                />
                <ActionRow
                  icon={<Sparkles className="h-5 w-5" />}
                  label="Use a template"
                  href="/create?type=reel&template=classic"
                />
                <ActionRow
                  icon={<Flag className="h-5 w-5" />}
                  label="Report"
                  destructive
                  onClick={() => void report(actionsFor)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RailButton({
  icon,
  label,
  onClick,
  active,
  activeClass,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  active?: boolean
  activeClass?: string
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
      <span className={cn("drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]", active && activeClass)}>{icon}</span>
      <motion.span
        key={label}
        initial={{ scale: 0.75, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
        className="text-[11px] font-semibold tabular-nums leading-none drop-shadow"
      >
        {label}
      </motion.span>
    </button>
  )
}

function ActionRow({
  icon,
  label,
  onClick,
  href,
  destructive,
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
  href?: string
  destructive?: boolean
}) {
  const className = cn(
    "flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-medium transition-colors hover:bg-white/5",
    destructive ? "text-rose-400" : "text-white/90",
  )
  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        <span className="flex-1">{label}</span>
        <ChevronRight className="h-4 w-4 text-white/25" />
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      <span className="flex-1">{label}</span>
    </button>
  )
}
