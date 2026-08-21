"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type Props = {
  /** Static image URL (always required as fallback) */
  src?: string | null
  /** Video/GIF URL — renders animated cover when available */
  videoSrc?: string | null
  alt?: string
  className?: string
  /** Height class for the cover */
  height?: string
  /** Whether to autoplay (default: true for GIF, false for video) */
  autoplay?: boolean
}

/**
 * VideoCover — Renders an animated cover/banner photo (video/GIF) with
 * automatic fallback to a static image. Pro users can set short video clips
 * as their cover photo. Uses IntersectionObserver for viewport-aware playback.
 */
export function VideoCover({
  src,
  videoSrc,
  alt = "Cover photo",
  className,
  height = "h-48 sm:h-56 md:h-64",
  autoplay = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)

  const isGif = videoSrc?.toLowerCase().endsWith(".gif")
  const hasVideo = Boolean(videoSrc) && !videoFailed

  useEffect(() => {
    setVideoReady(false)
    setVideoFailed(false)
  }, [videoSrc])

  // Viewport-aware pause/play for video covers
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
      { rootMargin: "400px" }
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [hasVideo, isGif])

  if (!hasVideo) {
    // Static cover image only
    return (
      <div className={cn("relative w-full overflow-hidden", height, className)}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
        )}
      </div>
    )
  }

  if (isGif) {
    return (
      <div className={cn("relative w-full overflow-hidden", height, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={videoSrc!}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {/* Fallback until GIF loads */}
        {!videoReady && src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover transition-opacity"
            onLoad={() => setVideoReady(true)}
            style={{ opacity: videoReady ? 0 : 1 }}
          />
        )}
      </div>
    )
  }

  // Video cover
  return (
    <div className={cn("relative w-full overflow-hidden", height, className)}>
      <video
        ref={videoRef}
        src={videoSrc!}
        poster={src || undefined}
        muted
        loop
        playsInline
        preload="metadata"
        autoPlay={autoplay}
        onError={() => setVideoFailed(true)}
        onLoadedData={() => setVideoReady(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500",
          videoReady ? "opacity-100" : "opacity-0"
        )}
      />
      {/* Static fallback */}
      {(!videoReady || videoFailed) && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* Gradient overlay at bottom for text readability */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/60 to-transparent" />
    </div>
  )
}
