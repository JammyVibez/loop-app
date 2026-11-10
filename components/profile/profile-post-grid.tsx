"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, BarChart3, Eye, EyeOff, Heart, LayoutGrid, List, Loader2, MessageCircle, Newspaper, Pin, PinOff, Vote, Swords, Users, Play } from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"
import { PostAnalyticsDialog } from "@/components/analytics/post-analytics-dialog"
import { LoopCard } from "@/components/loop-card"
import type { ProfilePostView } from "@/lib/profile-theme"

const VIEW_STORAGE_KEY = "loop:profile-post-view"
type PostView = ProfilePostView

interface ProfilePost {
  id: string
  content?: string
  content_text?: string
  content_title?: string | null
  media_url?: string | null
  media_urls?: string[]
  media_type?: string
  is_pinned?: boolean
  is_co_loop?: boolean
  co_authors?: unknown[]
  loop_stats?:
    | { likes_count?: number; comments_count?: number; views_count?: number }
    | Array<{ likes_count?: number; comments_count?: number; views_count?: number }>
  stats?: { likes_count?: number; comments_count?: number; views_count?: number }
  poll?: { question?: string; total_votes?: number } | null
  duel?: { prompt?: string } | null
}

function statsOf(loop: ProfilePost) {
  const raw = Array.isArray(loop.loop_stats) ? loop.loop_stats[0] : loop.loop_stats
  return {
    likes: Number(raw?.likes_count ?? loop.stats?.likes_count ?? 0),
    comments: Number(raw?.comments_count ?? loop.stats?.comments_count ?? 0),
    views: Number(raw?.views_count ?? loop.stats?.views_count ?? 0),
  }
}

function firstMedia(loop: ProfilePost) {
  const urls = Array.isArray(loop.media_urls) ? loop.media_urls.filter(Boolean) : []
  return urls[0] || loop.media_url || null
}

const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)

function PostTile({
  loop,
  owner,
  onTogglePin,
  onHide,
  onAnalytics,
  busy,
  muted,
}: {
  loop: ProfilePost
  owner: boolean
  onTogglePin?: (loopId: string, next: boolean) => void
  onHide?: (loopId: string, hidden: boolean) => void
  onAnalytics?: (loopId: string) => void
  busy: boolean
  muted?: boolean
}) {
  const media = firstMedia(loop)
  const stats = statsOf(loop)
  const text = (loop.content_title || loop.content_text || loop.content || "").trim()
  const isCoLoop = Boolean(loop.is_co_loop || (Array.isArray(loop.co_authors) && loop.co_authors.length > 0))

  return (
    <div data-profile-post-tile className={cn("group relative aspect-square overflow-hidden bg-muted", muted && "opacity-60")}>
      <Link
        href={`/loop/${loop.id}`}
        className="absolute inset-0 block"
        aria-label={text ? text.slice(0, 80) : "Open post"}
      >
        {media ? (
          <>
            {isVideo(media) || loop.media_type === "video" ? (
              <>
                <video
                  src={media}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
                    <Play className="ml-0.5 h-3.5 w-3.5" />
                  </span>
                </span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
            )}
          </>
        ) : (
          <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-muted to-muted/30 p-2.5">
            {loop.poll?.question ? (
              <p className="line-clamp-2 text-[11px] font-bold leading-snug text-foreground">
                {loop.poll.question}
              </p>
            ) : loop.duel?.prompt ? (
              <p className="line-clamp-2 text-[11px] font-bold leading-snug text-foreground">
                {loop.duel.prompt}
              </p>
            ) : (
              <p className="line-clamp-4 whitespace-pre-wrap text-[11px] leading-snug text-foreground/80">
                {text || "Post"}
              </p>
            )}
            <div className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground">
              {loop.poll?.question && <Vote className="h-3 w-3" aria-label="Poll" />}
              {loop.duel?.prompt && <Swords className="h-3 w-3" aria-label="Duel" />}
              {isCoLoop && <Users className="h-3 w-3 text-cyan-500" aria-label="Co-Loop" />}
            </div>
          </div>
        )}

        {/* Engagement sits on the media only, and only once it has some. */}
        {media && (stats.views > 0 || stats.likes > 0 || stats.comments > 0) && (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
            {stats.views > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Eye className="h-3 w-3" /> {stats.views}
              </span>
            )}
            {stats.likes > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Heart className="h-3 w-3 fill-current" /> {stats.likes}
              </span>
            )}
            {stats.comments > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageCircle className="h-3 w-3" /> {stats.comments}
              </span>
            )}
          </div>
        )}
      </Link>

      {loop.is_pinned && !muted && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">
          <Pin className="h-2.5 w-2.5" /> Pinned
        </span>
      )}

      {owner && (
        <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {!muted && onAnalytics && (
            <button
              type="button"
              onClick={() => onAnalytics(loop.id)}
              aria-label="Post analytics"
              title="Post analytics"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
            >
              <BarChart3 className="h-3 w-3" />
            </button>
          )}
          {!muted && onTogglePin && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onTogglePin(loop.id, !loop.is_pinned)}
              aria-label={loop.is_pinned ? "Unpin from profile" : "Pin to profile"}
              title={loop.is_pinned ? "Unpin from profile" : "Pin to profile"}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75 disabled:opacity-50"
            >
              {loop.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>
          )}
          {onHide && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onHide(loop.id, !muted)}
              aria-label={muted ? "Show on profile again" : "Hide from profile"}
              title={muted ? "Show on profile again" : "Hide from profile"}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75 disabled:opacity-50"
            >
              {muted ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * A compact row for list view: enough of the post to recognise it, without
 * the dense square grid that makes text-only posts hard to scan.
 */
function PostRow({
  loop,
  owner,
  onTogglePin,
  onHide,
  onAnalytics,
  busy,
  muted,
}: {
  loop: ProfilePost
  owner: boolean
  onTogglePin?: (loopId: string, next: boolean) => void
  onHide?: (loopId: string, hidden: boolean) => void
  onAnalytics?: (loopId: string) => void
  busy: boolean
  muted?: boolean
}) {
  const media = firstMedia(loop)
  const stats = statsOf(loop)
  const text = (loop.content_title || loop.content_text || loop.content || "").trim()
  const isCoLoop = Boolean(loop.is_co_loop || (Array.isArray(loop.co_authors) && loop.co_authors.length > 0))

  return (
    <div
      data-profile-post-row
      className={cn(
        "group relative flex items-start gap-3 border-b border-border/60 px-3 py-3 transition-colors hover:bg-muted/40",
        muted && "opacity-60",
      )}
    >
      <Link
        href={`/loop/${loop.id}`}
        className="flex min-w-0 flex-1 items-start gap-3"
        aria-label={text ? text.slice(0, 80) : "Open post"}
      >
        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
          {media ? (
            isVideo(media) || loop.media_type === "video" ? (
              <>
                <video src={media} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <Play className="h-3.5 w-3.5 text-white" />
                </span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media} alt="" loading="lazy" className="h-full w-full object-cover" />
            )
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
              {loop.poll?.question ? "Poll" : loop.duel?.prompt ? "Duel" : "Text"}
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {loop.is_pinned && !muted && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
            {isCoLoop && <Users className="h-3 w-3 shrink-0 text-cyan-500" />}
            {loop.poll?.question && <Vote className="h-3 w-3 shrink-0 text-muted-foreground" />}
            {loop.duel?.prompt && <Swords className="h-3 w-3 shrink-0 text-muted-foreground" />}
            <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
              {loop.poll?.question || loop.duel?.prompt || text || "Post"}
            </span>
          </span>
          <span className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
            {stats.views > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Eye className="h-3 w-3" /> {stats.views}
              </span>
            )}
            {stats.likes > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Heart className="h-3 w-3" /> {stats.likes}
              </span>
            )}
            {stats.comments > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageCircle className="h-3 w-3" /> {stats.comments}
              </span>
            )}
            {media && <span>{loop.media_type === "video" || (media && isVideo(media)) ? "Video" : "Photo"}</span>}
          </span>
        </span>
      </Link>

      {owner && (
        <div className="flex shrink-0 items-center gap-1">
          {!muted && onAnalytics && (
            <button
              type="button"
              onClick={() => onAnalytics(loop.id)}
              aria-label="Post analytics"
              title="Post analytics"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
          )}
          {!muted && onTogglePin && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onTogglePin(loop.id, !loop.is_pinned)}
              aria-label={loop.is_pinned ? "Unpin from profile" : "Pin to profile"}
              title={loop.is_pinned ? "Unpin from profile" : "Pin to profile"}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {loop.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          )}
          {onHide && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onHide(loop.id, !muted)}
              aria-label={muted ? "Show on profile again" : "Hide from profile"}
              title={muted ? "Show on profile again" : "Hide from profile"}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {muted ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Post layout for the profile: a scannable grid or a compact list. The choice
 * is remembered in the browser, so people who prefer reading posts keep the
 * list without the dense square tiles.
 */
export function ProfilePostGrid({
  loops,
  hiddenLoops = [],
  isOwnProfile,
  onTogglePin,
  onHide,
  busyId,
  defaultView = "grid",
  hasMore = false,
  loadingMore = false,
  loadMoreError,
  totalCount,
  onLoadMore,
}: {
  loops: ProfilePost[]
  hiddenLoops?: ProfilePost[]
  isOwnProfile: boolean
  onTogglePin?: (loopId: string, next: boolean) => void
  onHide?: (loopId: string, hidden: boolean) => void
  busyId?: string | null
  /** The owner's chosen presentation, shown to visitors until they pick one. */
  defaultView?: PostView | null
  hasMore?: boolean
  loadingMore?: boolean
  loadMoreError?: string | null
  totalCount?: number
  onLoadMore?: () => void
}) {
  const [showHidden, setShowHidden] = useState(false)
  const [view, setView] = useState<PostView>(defaultView || "grid")
  const [analyticsLoopId, setAnalyticsLoopId] = useState<string | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // A visitor's own choice beats the owner's default, and is remembered after
  // mount so server and client markup stay identical on first paint.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY)
      if (saved === "grid" || saved === "list" || saved === "cards") setView(saved)
    } catch {
      /* storage blocked — the owner's default is fine */
    }
  }, [])

  const changeView = (next: PostView) => {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      /* non-blocking */
    }
  }

  useEffect(() => {
    if (!hasMore || loadingMore || loadMoreError || !onLoadMore) return
    const node = loadMoreRef.current
    if (!node || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      { rootMargin: "320px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMoreError, onLoadMore])

  const ordered = [...loops].sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)))

  if (ordered.length === 0 && hiddenLoops.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <Pin className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No posts yet</p>
      </div>
    )
  }

  const renderLoops = (items: ProfilePost[], muted = false) => {
    if (view === "cards") {
      return (
        <div data-profile-post-card className={cn("space-y-3 px-1 py-3 sm:px-0", muted && "opacity-60")}>
          {items.map((loop) => (
            <LoopCard
              key={loop.id}
              loop={loop}
              surface="profile"
              className="rounded-2xl border border-border/70 bg-card/95 shadow-sm backdrop-blur-sm"
            />
          ))}
        </div>
      )
    }
    return view === "grid" ? (
      <div className="grid grid-cols-3 gap-0.5">
        {items.map((loop) => (
          <PostTile
            key={loop.id}
            loop={loop}
            owner={isOwnProfile}
            onTogglePin={muted ? undefined : onTogglePin}
            onHide={onHide}
            onAnalytics={isOwnProfile ? setAnalyticsLoopId : undefined}
            busy={busyId === loop.id}
            muted={muted}
          />
        ))}
      </div>
    ) : (
      <div className="flex flex-col">
        {items.map((loop) => (
          <PostRow
            key={loop.id}
            loop={loop}
            owner={isOwnProfile}
            onTogglePin={muted ? undefined : onTogglePin}
            onHide={onHide}
            onAnalytics={isOwnProfile ? setAnalyticsLoopId : undefined}
            busy={busyId === loop.id}
            muted={muted}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Layout switch: grid for a visual overview, list for reading. */}
      <div className="flex items-center justify-end gap-1 border-b border-border/60 px-2 py-1.5">
        <button
          type="button"
          onClick={() => changeView("grid")}
          aria-pressed={view === "grid"}
          aria-label="Grid view"
          title="Grid view"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => changeView("list")}
          aria-pressed={view === "list"}
          aria-label="List view"
          title="List view"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => changeView("cards")}
          aria-pressed={view === "cards"}
          aria-label="Post cards"
          title="Post cards"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            view === "cards" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Newspaper className="h-3.5 w-3.5" />
        </button>
      </div>

      {renderLoops(ordered)}

      {(hasMore || loadMoreError) && onLoadMore && (
        <div ref={loadMoreRef} className="flex flex-col items-center gap-2 border-t border-border/60 px-4 py-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="inline-flex h-8 min-w-36 items-center justify-center rounded-full border border-border/70 bg-card px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Loading posts…
              </>
            ) : (
              "Load more posts"
            )}
          </button>
          {loadMoreError && (
            <p className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-3 w-3" />
              {loadMoreError}
            </p>
          )}
        </div>
      )}

      {!hasMore && !loadMoreError && ordered.length > 0 && typeof totalCount === "number" && totalCount > 0 && (
        <p className="px-4 py-3 text-center text-[11px] text-muted-foreground">
          {ordered.length >= totalCount ? `All ${totalCount.toLocaleString()} posts loaded` : `${ordered.length.toLocaleString()} of ${totalCount.toLocaleString()} posts`}
        </p>
      )}

      {analyticsLoopId && (
        <PostAnalyticsDialog
          loopId={analyticsLoopId}
          open={Boolean(analyticsLoopId)}
          onOpenChange={(next) => {
            if (!next) setAnalyticsLoopId(null)
          }}
        />
      )}

      {isOwnProfile && hiddenLoops.length > 0 && (
        <div className="mt-4 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={() => setShowHidden((prev) => !prev)}
            className="flex w-full items-center justify-between gap-2 px-1 text-left"
            aria-expanded={showHidden}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5" />
              Hidden from your profile ({hiddenLoops.length})
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {showHidden ? "Hide list" : "Show list"}
            </span>
          </button>

          {showHidden && <div className="mt-2">{renderLoops(hiddenLoops, true)}</div>}
        </div>
      )}
    </div>
  )
}
