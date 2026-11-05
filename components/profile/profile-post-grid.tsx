"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Heart, MessageCircle, Pin, PinOff, Vote, Swords, Users, Play } from "lucide-react"
import { cn } from "@/lib/utils"

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
  loop_stats?: { likes_count?: number; comments_count?: number } | Array<{ likes_count?: number; comments_count?: number }>
  stats?: { likes_count?: number; comments_count?: number }
  poll?: { question?: string; total_votes?: number } | null
  duel?: { prompt?: string } | null
}

function statsOf(loop: ProfilePost) {
  const raw = Array.isArray(loop.loop_stats) ? loop.loop_stats[0] : loop.loop_stats
  return {
    likes: Number(raw?.likes_count ?? loop.stats?.likes_count ?? 0),
    comments: Number(raw?.comments_count ?? loop.stats?.comments_count ?? 0),
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
  busy,
  muted,
}: {
  loop: ProfilePost
  owner: boolean
  onTogglePin?: (loopId: string, next: boolean) => void
  onHide?: (loopId: string, hidden: boolean) => void
  busy: boolean
  muted?: boolean
}) {
  const media = firstMedia(loop)
  const stats = statsOf(loop)
  const text = (loop.content_title || loop.content_text || loop.content || "").trim()
  const isCoLoop = Boolean(loop.is_co_loop || (Array.isArray(loop.co_authors) && loop.co_authors.length > 0))

  return (
    <div className={cn("group relative aspect-square overflow-hidden bg-muted", muted && "opacity-60")}>
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
        {media && (stats.likes > 0 || stats.comments > 0) && (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
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
 * Instagram-style post grid for the profile. Pinned work leads, long text
 * becomes a readable tile, and the owner can hide a post from the profile
 * without deleting it from the app.
 */
export function ProfilePostGrid({
  loops,
  hiddenLoops = [],
  isOwnProfile,
  onTogglePin,
  onHide,
  busyId,
}: {
  loops: ProfilePost[]
  hiddenLoops?: ProfilePost[]
  isOwnProfile: boolean
  onTogglePin?: (loopId: string, next: boolean) => void
  onHide?: (loopId: string, hidden: boolean) => void
  busyId?: string | null
}) {
  const [showHidden, setShowHidden] = useState(false)

  const ordered = [...loops].sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)))

  if (ordered.length === 0 && hiddenLoops.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <Pin className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No posts yet</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-0.5">
        {ordered.map((loop) => (
          <PostTile
            key={loop.id}
            loop={loop}
            owner={isOwnProfile}
            onTogglePin={onTogglePin}
            onHide={onHide}
            busy={busyId === loop.id}
          />
        ))}
      </div>

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

          {showHidden && (
            <div className="mt-2 grid grid-cols-3 gap-0.5">
              {hiddenLoops.map((loop) => (
                <PostTile
                  key={loop.id}
                  loop={loop}
                  owner
                  onTogglePin={undefined}
                  onHide={onHide}
                  busy={busyId === loop.id}
                  muted
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
