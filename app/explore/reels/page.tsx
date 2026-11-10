"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye, Heart, Film } from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { Spinner, SkeletonBlock } from "@/components/ui/skeletons"
import { cn } from "@/lib/utils"

interface ReelAuthor {
  id?: string
  username?: string
  display_name?: string
  avatar_url?: string
  is_verified?: boolean
}

interface ExploreReel {
  id: string
  title?: string
  content_url: string
  thumbnail_url?: string | null
  content_type?: string
  type?: string
  duration?: number | null
  like_count?: number
  view_count?: number
  comment_count?: number
  share_count?: number
  author?: ReelAuthor
  source?: string
}

/** Compact duration label like "0:10" or "1:23". */
function formatDuration(seconds?: number | null): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, "0")}`
}

/** 1.2K / 34K style compact view counts. */
function formatCompact(n?: number): string {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`
  return String(v)
}

/**
 * Explore Reels — a 2-column masonry grid (Snapchat Discover style) of public
 * reels. Tapping any tile opens the existing full-screen vertical player at
 * that exact reel via /trees?focus=<id>, and scrolling continues through the
 * rest of the feed from there.
 */
export default function ExploreReelsPage() {
  const router = useRouter()
  const { user, getAuthHeader } = useAuth()
  const [reels, setReels] = useState<ExploreReel[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(
    async (nextPage: number, replace = false) => {
      try {
        const res = await fetch(`/api/reels?category=explore&page=${nextPage}&limit=24`, {
          headers: user ? getAuthHeader() : undefined,
          cache: "no-store",
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load reels")
        const items: ExploreReel[] = data.data?.reels || []
        setReels((prev) => (replace ? items : [...prev, ...items]))
        setHasMore(Boolean(data.data?.has_more) && items.length > 0)
        setPage(nextPage)
      } catch {
        // Grid stays as-is on failure; the empty state covers the first load.
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user, getAuthHeader],
  )

  useEffect(() => {
    void load(1, true)
  }, [load])

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || loadingMore || loading) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoadingMore(true)
          void load(page + 1)
        }
      },
      { rootMargin: "600px" },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [hasMore, loadingMore, loading, page, load])

  // Video-only tiles: the grid is a video discovery surface.
  const videoReels = reels.filter((r) => (r.content_type || r.type || "video") === "video" && r.content_url)

  return (
    <div className="min-h-[100dvh] bg-black text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 text-base font-bold">
            Explore Reels
            <Film className="h-4 w-4 text-amber-400" />
          </h1>
          <p className="truncate text-[11px] text-white/50">Trending and fresh clips, all in one grid</p>
        </div>
        <Link
          href="/trees"
          className="flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-white/90 transition hover:bg-white/20"
        >
          <Film className="h-3.5 w-3.5" />
          Feed
        </Link>
      </header>

      {/* Masonry grid — 2 columns, variable heights via CSS columns */}
      <main className="px-2 pb-16 pt-3">
        {loading ? (
          <div className="columns-2 gap-2 [column-fill:_balance]">
            {/* Varied skeleton heights mimic the masonry rhythm */}
            {[180, 260, 220, 300, 200, 280, 240, 210].map((h, i) => (
              <div key={i} className="mb-2 break-inside-avoid">
                <SkeletonBlock className="w-full rounded-xl bg-white/5" style={{ height: h } as React.CSSProperties} />
              </div>
            ))}
          </div>
        ) : videoReels.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
              <Film className="h-7 w-7 text-white/40" />
            </div>
            <h2 className="mb-1 text-lg font-semibold">No reels yet</h2>
            <p className="mb-5 max-w-xs text-sm text-white/50">
              Be the first to post a clip — it lands here the moment it&apos;s live.
            </p>
            <Link
              href="/create"
              className="rounded-full bg-gradient-to-r from-violet-600 to-teal-500 px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              Post the first reel
            </Link>
          </div>
        ) : (
          <>
            <div className="columns-2 gap-2 [column-fill:_balance]">
              {videoReels.map((reel) => {
                const duration = formatDuration(reel.duration)
                const views = formatCompact(reel.view_count)
                const likes = formatCompact(reel.like_count)
                // Variable visual height: real thumbnails keep their own aspect
                // ratio; clips without a poster get a deterministic varied
                // height so the masonry rhythm holds. IDs may be numeric
                // (Snowflake) or UUIDs — coerce to string before hashing.
                const idKey = String(reel.id ?? "")
                let idHash = 0
                for (let i = 0; i < idKey.length; i++) {
                  idHash = (idHash * 31 + idKey.charCodeAt(i)) % 100000
                }
                const fallbackHeight = 200 + (idHash % 140)
                return (
                  <Link
                    key={reel.id}
                    href={`/trees?focus=${reel.id}`}
                    prefetch={false}
                    className="group relative mb-2 block break-inside-avoid overflow-hidden rounded-xl bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    {/* Thumbnail — static preview frame; masonry height comes from the natural aspect ratio */}
                    {reel.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={reel.thumbnail_url}
                        alt={reel.title || "Reel"}
                        loading="lazy"
                        className="w-full object-cover transition duration-300 group-hover:scale-[1.03] group-active:scale-[0.99]"
                      />
                    ) : (
                      <video
                        src={reel.content_url}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full object-cover transition duration-300 group-hover:scale-[1.03] group-active:scale-[0.99]"
                        style={{ minHeight: fallbackHeight, maxHeight: 420 }}
                        tabIndex={-1}
                      />
                    )}

                    {/* Gradient scrims for overlay legibility */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/50 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />

                    {/* Duration badge — top-left, compact like the reference */}
                    {duration && (
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white backdrop-blur-sm">
                        {duration}
                      </span>
                    )}

                    {/* Stats overlay — bottom-left, unobtrusive */}
                    <span className="absolute bottom-1.5 left-1.5 flex items-center gap-2 text-[10px] font-semibold text-white/95">
                      {views && (
                        <span className="flex items-center gap-0.5 tabular-nums">
                          <Eye className="h-3 w-3" />
                          {views}
                        </span>
                      )}
                      {likes && Number(reel.like_count) > 0 && (
                        <span className="flex items-center gap-0.5 tabular-nums">
                          <Heart className="h-3 w-3 fill-current" />
                          {likes}
                        </span>
                      )}
                    </span>

                    {/* Author chip — bottom-right, tiny */}
                    {reel.author?.username && (
                      <span className="absolute bottom-1.5 right-1.5 flex max-w-[45%] items-center gap-1 rounded-full bg-black/45 py-0.5 pl-0.5 pr-1.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm">
                        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 text-[7px] uppercase">
                          {(reel.author.display_name || reel.author.username || "?").charAt(0)}
                        </span>
                        <span className="truncate">@{reel.author.username}</span>
                        {reel.author.is_verified && <VerifiedSeal size={14} title="Verified Creator" />}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Infinite scroll sentinel + loader */}
            <div ref={sentinelRef} className="flex justify-center py-6">
              {loadingMore && <Spinner className="h-5 w-5 text-white/50" />}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
