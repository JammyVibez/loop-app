"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Props = {
  /** Static image URL (always required as fallback) */
  src?: string | null
  /** Video/GIF URL — renders animated PFP when available */
  videoSrc?: string | null
  alt?: string
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
  /** Whether to autoplay the video (default: true for GIF, false for video) */
  autoplay?: boolean
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-24 w-24 sm:h-28 sm:w-28",
  xl: "h-28 w-28",
}

/**
 * VideoAvatar — Renders an animated profile picture (video/GIF) with automatic
 * fallback to a static image. Pro users can set short video clips as their PFP.
 * The video auto-plays muted and loops. On mobile, uses poster for performance.
 */
export function VideoAvatar({
  src,
  videoSrc,
  alt = "",
  className,
  size = "md",
  autoplay = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)

  const isGif = videoSrc?.toLowerCase().endsWith(".gif")
  const hasVideo = Boolean(videoSrc) && !videoFailed

  // Reset state when video source changes
  useEffect(() => {
    setVideoReady(false)
    setVideoFailed(false)
  }, [videoSrc])

  // Pause video when not in viewport for performance
  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasVideo || isGif) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [hasVideo, isGif])

  if (!hasVideo) {
    // Pure image avatar — no video
    return (
      <div className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full", sizeMap[size], className)}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground font-bold">
            {(alt || "U").charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    )
  }

  // GIF: render as <img> (browser handles GIF natively, better performance)
  if (isGif) {
    return (
      <div className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full", sizeMap[size], className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={videoSrc!}
          alt={alt}
          className="h-full w-full rounded-full object-cover"
          loading="lazy"
        />
        {/* Static fallback layer — visible until GIF loads */}
        {!videoReady && src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className="absolute inset-0 h-full w-full rounded-full object-cover transition-opacity"
            onLoad={() => setVideoReady(true)}
            style={{ opacity: videoReady ? 0 : 1 }}
          />
        )}
      </div>
    )
  }

  // Video: render as <video> with fallback
  return (
    <div className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full", sizeMap[size], className)}>
      <video
        ref={videoRef}
        src={videoSrc!}
        poster={src || undefined}
        aria-label={alt}
        muted
        loop
        playsInline
        preload={size === "sm" ? "none" : "metadata"}
        autoPlay={autoplay}
        onError={() => setVideoFailed(true)}
        onLoadedData={() => setVideoReady(true)}
        className={cn(
          "h-full w-full rounded-full object-cover transition-opacity duration-300",
          videoReady ? "opacity-100" : "opacity-0"
        )}
      />
      {/* Static fallback — visible until video is ready or if video fails */}
      {(!videoReady || videoFailed) && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full rounded-full object-cover"
        />
      )}
      {/* Play indicator — subtle play icon overlay for video (not GIF) */}
      {videoReady && !videoFailed && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.15)" }}
        >
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
    </div>
  )
}
