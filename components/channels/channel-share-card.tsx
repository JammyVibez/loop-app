"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Pause, Play, Volume2 } from "@/components/icons/lucide-compat"
import { runtimeLabel } from "@/lib/channels-library"
import { cn } from "@/lib/utils"

/** Canonical details stored by the loops API when a title is shared. */
export interface ChannelShareDetails {
  id: string
  kind: "movie" | "series"
  title: string
  poster?: string | null
  backdrop?: string | null
  year?: number | null
  runtimeMinutes?: number | null
  genres?: string[]
  synopsis?: string | null
  videoUrl?: string | null
  url?: string | null
}

const PREVIEW_SECONDS = 20

/** Read a share out of post metadata, ignoring malformed or legacy shapes. */
export function channelShareFromMetadata(metadata: unknown): ChannelShareDetails | null {
  if (!metadata || typeof metadata !== "object") return null
  const raw = (metadata as Record<string, unknown>).channel_share
  if (!raw || typeof raw !== "object") return null
  const value = raw as Record<string, unknown>

  const id = typeof value.id === "string" ? value.id : null
  const title = typeof value.title === "string" ? value.title : null
  if (!id || !title) return null

  const kind = value.kind === "series" ? "series" : "movie"
  const stringOrNull = (entry: unknown) =>
    typeof entry === "string" && entry.trim() ? entry : null

  return {
    id,
    kind,
    title,
    poster: stringOrNull(value.poster),
    backdrop: stringOrNull(value.backdrop),
    year: typeof value.year === "number" ? value.year : null,
    runtimeMinutes: typeof value.runtimeMinutes === "number" ? value.runtimeMinutes : null,
    genres: Array.isArray(value.genres)
      ? value.genres.filter((genre): genre is string => typeof genre === "string").slice(0, 4)
      : [],
    synopsis: stringOrNull(value.synopsis),
    videoUrl: stringOrNull(value.videoUrl),
    url: stringOrNull(value.url),
  }
}

/**
 * Shared movie/show post.
 *
 * Instead of a bare link, the feed renders the title as a 16:9 poster canvas.
 * Hovering (or tapping the preview button) plays a muted 20-second sample from
 * the film, then stops — the full movie stays on the title page, so a feed
 * card never starts a feature-length stream in the timeline.
 */
export function ChannelShareCard({
  share,
  className,
}: {
  share: ChannelShareDetails
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [started, setStarted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [posterFailed, setPosterFailed] = useState(false)

  const artwork = share.backdrop || share.poster
  const href = share.url || `/channels/${share.kind}/${encodeURIComponent(share.id)}`
  const canPreview = Boolean(share.videoUrl)
  const meta = [
    share.year ? String(share.year) : null,
    runtimeLabel(share.runtimeMinutes ?? null),
    share.genres?.slice(0, 3).join(" · ") || null,
  ].filter(Boolean)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0
    setPreviewing(false)
    setStarted(false)
    setProgress(0)
  }, [share.videoUrl])

  const stop = useCallback(() => {
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = 0
    }
    setPreviewing(false)
    setStarted(false)
    setProgress(0)
  }, [])

  const start = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.ended || video.currentTime >= PREVIEW_SECONDS) video.currentTime = 0
    video.muted = true
    setPreviewing(true)
    void video.play().catch(() => setPreviewing(false))
  }, [])

  const toggle = () => {
    if (previewing) stop()
    else start()
  }

  return (
    <div
      className={cn(
        "mt-3 overflow-hidden rounded-2xl border border-border bg-black shadow-[0_24px_60px_-30px_rgba(0,0,0,0.65)]",
        className,
      )}
      onMouseEnter={() => {
        if (!canPreview) return
        if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
        start()
      }}
      onMouseLeave={() => {
        if (previewing) stop()
      }}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {artwork && !posterFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artwork}
            alt=""
            loading="lazy"
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition duration-500",
              previewing && started ? "scale-105 opacity-0" : "opacity-90",
            )}
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_20%_0%,#2a1620,transparent_60%),linear-gradient(160deg,#17171d,#08080b)]" />
        )}

        {canPreview ? (
          <video
            ref={videoRef}
            src={share.videoUrl ?? undefined}
            poster={artwork ?? undefined}
            muted
            playsInline
            preload="none"
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
              previewing && started ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            onPlaying={() => setStarted(true)}
            onPause={() => setPreviewing(false)}
            onEnded={() => {
              setPreviewing(false)
              setStarted(false)
              setProgress(0)
            }}
            onTimeUpdate={(event) => {
              const video = event.currentTarget
              setProgress(Math.min(100, (video.currentTime / PREVIEW_SECONDS) * 100))
              if (video.currentTime >= PREVIEW_SECONDS) {
                video.pause()
                setPreviewing(false)
                setStarted(false)
              }
            }}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" />

        <Link
          href={href}
          aria-label={`Open ${share.title}`}
          className="absolute inset-0 z-10"
        />

        <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 sm:left-4 sm:top-4">
          <span className="rounded bg-[#e50914] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white">
            {share.kind === "movie" ? "Movie" : "Series"}
          </span>
          <span className="rounded border border-white/25 bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur">
            Loop
          </span>
        </div>

        {canPreview ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              toggle()
            }}
            aria-label={previewing ? `Pause ${share.title} preview` : `Play ${share.title} preview`}
            className={cn(
              "absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-1 ring-white/40 backdrop-blur-md transition duration-200 hover:scale-105 sm:h-16 sm:w-16",
              previewing ? "bg-black/45 opacity-0 hover:opacity-100" : "bg-white/15 hover:bg-white/25",
            )}
          >
            {previewing ? (
              <Pause className="h-6 w-6 fill-white text-white" />
            ) : (
              <Play className="ml-0.5 h-6 w-6 fill-white text-white" />
            )}
          </button>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3.5 pr-12 sm:p-5 sm:pr-16">
          <p className="text-[17px] font-black leading-tight tracking-tight text-white drop-shadow sm:text-[21px]">
            {share.title}
          </p>
          {meta.length ? (
            <p className="mt-1 line-clamp-1 text-[11px] font-medium text-white/70 sm:text-[12px]">
              {meta.join("  ·  ")}
            </p>
          ) : null}
          {share.synopsis ? (
            <p className="mt-1.5 line-clamp-2 max-w-[85%] text-[11px] leading-relaxed text-white/60 sm:text-[12px]">
              {share.synopsis}
            </p>
          ) : null}
        </div>

        <Link
          href={href}
          className="absolute bottom-3.5 right-3.5 z-20 inline-flex h-8 items-center gap-1 rounded-full border border-white/25 bg-black/45 px-2.5 text-[10px] font-bold text-white backdrop-blur transition hover:bg-white hover:text-black sm:bottom-5 sm:right-5 sm:h-9 sm:px-3 sm:text-[11px]"
        >
          {previewing ? "Watch full" : "Watch"}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>

        {canPreview ? (
          <div className="absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/15">
            <div
              className="h-full bg-[#e50914] transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}

        {previewing && started ? (
          <span className="pointer-events-none absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-semibold text-white/80 backdrop-blur sm:right-4 sm:top-4">
            <Volume2 className="h-3 w-3" />
            Muted preview
          </span>
        ) : null}
      </div>
    </div>
  )
}
