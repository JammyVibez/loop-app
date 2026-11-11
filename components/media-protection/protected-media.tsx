"use client"

import { useRef, useCallback, useEffect, useState, type ReactNode, type Ref } from "react"
import { Play, Pause, Volume2, VolumeX, Volume1 } from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"

type ProtectedMediaProps = {
  /** Media source URL */
  src: string
  /** Alt text for images */
  alt?: string
  /** "video" or "image" */
  type: "video" | "image"
  /** CSS className applied to both wrapper AND media element */
  className?: string
  /** Poster image for video */
  poster?: string
  /** Callback when media is clicked */
  onClick?: () => void
  /** Whether to show custom video controls */
  showControls?: boolean
  /** Whether to autoplay video (default respects user preference, off by default) */
  autoPlay?: boolean
  /** External ref to the <video> element (for parent playback control) */
  videoRef?: Ref<HTMLVideoElement>
  /** Children (e.g. watermark overlay) */
  children?: ReactNode
}

/**
 * Wraps <img> or <video> to:
 * 1. Replace native video controls with custom UI (no download option)
 * 2. Block right-click context menu ("Save Image As", "Download")
 * 3. Block drag-and-drop
 * 4. Add user-select: none CSS
 * 5. Autoplay muted video (standard social media behavior)
 * 6. Listen for hardware volume button to unmute
 */
export function ProtectedMedia({
  src,
  alt = "Media",
  type,
  className = "",
  poster,
  onClick,
  showControls = true,
  autoPlay,
  videoRef: externalRef,
  children,
}: ProtectedMediaProps) {
  const internalRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Read autoplay preference from localStorage (default: false)
  const [autoplayEnabled] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("loop-autoplay-videos") === "true"
  })
  const effectiveAutoPlay = autoPlay !== undefined ? autoPlay : autoplayEnabled

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  // Merge internal + external refs
  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      ;(internalRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
      if (typeof externalRef === "function") {
        externalRef(el)
      } else if (externalRef && typeof externalRef === "object") {
        ;(externalRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
      }
    },
    [externalRef]
  )

  // Block context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    return false
  }, [])

  // Block drag start
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    return false
  }, [])

  // Toggle play/pause
  const togglePlay = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    const v = internalRef.current
    if (!v) return
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      v.pause()
      setIsPlaying(false)
    }
  }, [])

  // Toggle mute
  const toggleMute = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    const v = internalRef.current
    if (!v) return
    v.muted = !v.muted
    setIsMuted(v.muted)
  }, [])

  // Listen for hardware volume buttons (Capacitor / mobile browsers)
  useEffect(() => {
    if (type !== "video") return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.keyCode === 175 || e.key === "VolumeUp") {
        const v = internalRef.current
        if (v) {
          v.muted = false
          setIsMuted(false)
          if (v.paused) {
            v.play().then(() => setIsPlaying(true)).catch(() => {})
          }
        }
      } else if (e.keyCode === 174 || e.key === "VolumeDown") {
        const v = internalRef.current
        if (v) {
          v.muted = true
          setIsMuted(true)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [type])

  // Intersection Observer: play when visible, pause when not (TikTok-style)
  // Only runs when autoPlay is true AND no external ref is managing the video
  useEffect(() => {
    if (type !== "video" || !effectiveAutoPlay || externalRef) return
    const v = internalRef.current
    if (!v) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          v.play().then(() => setIsPlaying(true)).catch(() => {})
        } else {
          v.pause()
          setIsPlaying(false)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(v)
    return () => observer.disconnect()
  }, [type, autoPlay, externalRef])

  // Track progress & duration
  useEffect(() => {
    const v = internalRef.current
    if (!v || type !== "video") return

    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime)
      if (v.duration) setProgress((v.currentTime / v.duration) * 100)
    }
    const onEnded = () => setIsPlaying(false)
    const onLoadedMetadata = () => setDuration(v.duration)

    v.addEventListener("timeupdate", onTimeUpdate)
    v.addEventListener("ended", onEnded)
    v.addEventListener("loadedmetadata", onLoadedMetadata)
    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate)
      v.removeEventListener("ended", onEnded)
      v.removeEventListener("loadedmetadata", onLoadedMetadata)
    }
  }, [type])

  const seek = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const v = internalRef.current
    if (!v || !v.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration
  }, [])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative group select-none",
        type === "video" && "overflow-hidden bg-black",
        className
      )}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      style={{
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {type === "video" ? (
        <>
          <video
            ref={setVideoRef}
            src={src}
            poster={poster}
            className={cn("w-full h-auto object-cover", className)}
            preload="auto"
            playsInline
            loop
            muted={isMuted}
            autoPlay={autoPlay}
            onClick={togglePlay}
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
          />

          {/* Play/Pause center indicator */}
          {!isPlaying && (
            <div
              className="absolute inset-0 z-[6] flex items-center justify-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                togglePlay()
              }}
              onContextMenu={handleContextMenu}
            >
              <div className="h-16 w-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-transform hover:scale-110">
                <Play className="h-8 w-8 text-white fill-white ml-1" />
              </div>
            </div>
          )}

          {/* Custom controls — NO download button */}
          {showControls && (
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-2 pt-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-white/80 transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 fill-white" />
                  ) : (
                    <Play className="h-5 w-5 fill-white" />
                  )}
                </button>

                <span className="text-white text-xs tabular-nums min-w-[3rem]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <div
                  className="flex-1 h-1 bg-white/30 rounded-full cursor-pointer group/progress"
                  onClick={seek}
                >
                  <div
                    className="h-full bg-white rounded-full relative transition-all"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
                  </div>
                </div>

                <button
                  onClick={toggleMute}
                  className="text-white hover:text-white/80 transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Tap-to-unmute hint */}
          {isMuted && showControls && (
            <div
              className="absolute top-3 right-3 z-10 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                toggleMute()
              }}
            >
              <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-xs">
                <Volume1 className="h-3 w-3" />
                <span>Tap for sound</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <img
          src={src}
          alt={alt}
          draggable={false}
          onClick={onClick}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          className={cn("w-full h-auto pointer-events-auto", className)}
          style={{ userSelect: "none", WebkitUserSelect: "none" }}
        />
      )}
      {children}
    </div>
  )
}
