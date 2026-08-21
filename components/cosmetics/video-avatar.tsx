"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  type ActiveCosmetics,
  rarityRingClass,
  cosmeticVariants,
  cosmeticGradient,
  prefersReducedMotion,
  accessoryFromItem,
} from "@/lib/cosmetics"
import { AccessoryIcon, BadgeStarIcon } from "@/components/cosmetics/accessory-icons"

type Props = {
  /** Static image URL (always required as fallback) */
  src?: string | null
  /** Video/GIF URL — only rendered for pro users */
  videoSrc?: string | null
  /** Whether the user is premium (controls video PFP rendering) */
  isPremium?: boolean
  /** Display name for initials fallback */
  alt?: string
  /** Fallback initials text */
  fallback?: string
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
  /** Cosmetic items to render as overlays */
  cosmetics?: ActiveCosmetics | null
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-24 w-24 sm:h-28 sm:w-28",
  xl: "h-28 w-28",
}

const pxMap = {
  sm: 32,
  md: 40,
  lg: 96,
  xl: 112,
}

/**
 * VideoAvatar — Renders an animated profile picture (video/GIF) for pro users
 * with cosmetics effects (frames, auras, badges). Normal users always see
 * the static image. Falls back to initials if no image is available.
 */
export function VideoAvatar({
  src,
  videoSrc,
  isPremium = false,
  alt = "",
  fallback,
  className,
  size = "md",
  cosmetics,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)

  const isGif = videoSrc?.toLowerCase().endsWith(".gif")
  // Only show video for pro users
  const hasVideo = Boolean(videoSrc) && isPremium && !videoFailed

  // Cosmetics
  const frame = cosmetics?.frame
  const aura = cosmetics?.aura || cosmetics?.effect
  const badge = cosmetics?.badge
  const accessory = accessoryFromItem(aura || frame || null)
  const variants = cosmeticVariants(frame || aura || null)

  const glowColor = aura?.color || frame?.color || "var(--theme-primary, #8b5cf6)"
  const showGlow = Boolean(aura?.glow || aura?.particles || frame?.glow || aura || frame)
  const frameVariant = variants.frame

  // Viewport-aware pausing for video
  useEffect(() => {
    setVideoReady(false)
    setVideoFailed(false)
  }, [videoSrc])

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

  // Generate initials from name
  const initials = (fallback || alt || "U").charAt(0).toUpperCase()
  const px = pxMap[size]

  // The inner content: image/video/initials + cosmetics overlays
  const innerContent = (
    <div className={cn("relative inline-flex shrink-0 rounded-full", sizeMap[size], className)}>
      {/* Glow ring for cosmetics */}
      {showGlow && (
        <div
          className="absolute -inset-1 rounded-full opacity-60 pointer-events-none"
          style={{
            background: `conic-gradient(from 0deg, ${glowColor}, transparent 40%, ${glowColor})`,
            animation: frameVariant === "ring_rotate" ? "spin 3s linear infinite" : undefined,
          }}
        />
      )}

      {/* Main avatar content */}
      <div className="relative h-full w-full rounded-full overflow-hidden">
        {/* Static image / initials (always rendered as fallback) */}
        {!hasVideo && (
          <>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center rounded-full font-bold text-white"
                style={{
                  background: cosmetics
                    ? `linear-gradient(135deg, ${cosmetics.frame?.color || "#8b5cf6"}, ${cosmetics.aura?.color || "#6366f1"})`
                    : "linear-gradient(135deg, #8b5cf6, #6366f1)",
                }}
              >
                <span className={cn(size === "lg" || size === "xl" ? "text-2xl" : size === "md" ? "text-sm" : "text-xs")}>
                  {initials}
                </span>
              </div>
            )}
          </>
        )}

        {/* GIF: render as <img> (browser handles GIF natively) */}
        {hasVideo && isGif && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={videoSrc!}
              alt={alt}
              className="h-full w-full rounded-full object-cover"
              loading="lazy"
              onLoad={() => setVideoReady(true)}
            />
            {/* Static fallback layer — visible until GIF loads */}
            {!videoReady && src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt}
                className="absolute inset-0 h-full w-full rounded-full object-cover transition-opacity"
                style={{ opacity: videoReady ? 0 : 1 }}
              />
            )}
          </>
        )}

        {/* Video: render as <video> with fallback */}
        {hasVideo && !isGif && (
          <>
            <video
              ref={videoRef}
              src={videoSrc!}
              poster={src || undefined}
              aria-label={alt}
              muted
              loop
              playsInline
              preload={size === "sm" ? "none" : "metadata"}
              autoPlay
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
          </>
        )}
      </div>

      {/* Cosmetics: frame border overlay */}
      {frame && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: `inset 0 0 0 ${frameVariant === "pulse_glow" ? 3 : 2}px ${frame.color || glowColor}`,
            animation: frameVariant === "pulse_glow" ? "pulse 2s ease-in-out infinite" : undefined,
          }}
        />
      )}

      {/* Cosmetics: accessory icon overlay */}
      {accessory && (
        <div className="absolute -bottom-0.5 -right-0.5 pointer-events-none z-10">
          <AccessoryIcon
            type={accessory}
            color={aura?.color || frame?.color || undefined}
            className={cn(
              size === "sm" ? "h-3 w-3" : size === "md" ? "h-3.5 w-3.5" : "h-5 w-5"
            )}
          />
        </div>
      )}

      {/* Cosmetics: badge star */}
      {badge && (
        <div className="absolute -top-0.5 -right-0.5 pointer-events-none z-10">
          <BadgeStarIcon
            className={cn(
              size === "sm" ? "h-2.5 w-2.5" : size === "md" ? "h-3 w-3" : "h-4 w-4"
            )}
          />
        </div>
      )}

      {/* Pro indicator: small play icon for video PFPs */}
      {hasVideo && videoReady && !videoFailed && (
        <div className="absolute bottom-0 right-0 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-white pointer-events-none">
          <svg className="h-2 w-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
    </div>
  )

  return innerContent
}
