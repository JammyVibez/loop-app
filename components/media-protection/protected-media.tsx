"use client"

import { useRef, useCallback, useEffect, useState, type ReactNode } from "react"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"

type ProtectedMediaProps = {
  /** Media source URL */
  src: string
  /** Alt text for images */
  alt?: string
  /** "video" or "image" */
  type: "video" | "image"
  /** CSS className */
  className?: string
  /** Poster image for video */
  poster?: string
  /** Callback when media is clicked */
  onClick?: () => void
  /** Whether to show custom video controls */
  showControls?: boolean
  /** Whether to show watermark */
  children?: ReactNode
}

/**
 * Wraps <img> or <video> to:
 * 1. Replace native video controls with custom UI (no download option)
 * 2. Block right-click context menu ("Save Image As", "Download")
 * 3. Block drag-and-drop
 * 4. Add user-select: none CSS
 * 5. Add watermark overlay
 *
 * This is a deterrent layer — determined users can still bypass via dev tools.
 */
export function ProtectedMedia({
  src,
  alt = "Media",
  type,
  className = "",
  poster,
  onClick,
  showControls = true,
  children,
}: ProtectedMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  // Block context menu on ALL descendants
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

  // Video controls
  const togglePlay = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      v.pause()
      setIsPlaying(false)
    }
  }, [])

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setIsMuted(v.muted)
  }, [])

  // Track progress
  useEffect(() => {
    const v = videoRef.current
    if (!v || type !== "video") return

    const onTimeUpdate = () => {
      if (v.duration) {
        setProgress((v.currentTime / v.duration) * 100)
      }
    }
    const onLoaded = () => setDuration(v.duration)
    const onEnded = () => setIsPlaying(false)

    v.addEventListener("timeupdate", onTimeUpdate)
    v.addEventListener("loadedmetadata", onLoaded)
    v.addEventListener("ended", onEnded)
    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate)
      v.removeEventListener("loadedmetadata", onLoaded)
      v.removeEventListener("ended", onEnded)
    }
  }, [type])

  const seek = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v || !v.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    v.currentTime = frac * v.duration
  }, [])

  // Block keyboard download shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || (e.shiftKey && e.key === "S"))) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  return (
    <div
      className={cn("relative group", className)}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onKeyDown={handleKeyDown}
      style={{
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {type === "video" ? (
        <>
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            className="w-full h-auto"
            preload="metadata"
            playsInline
            muted={isMuted}
            onClick={togglePlay}
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
          />
          {/* Custom controls — NO download button */}
          {showControls && (
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Play/Pause button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-white/80 transition-colors"
                >
                  {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
                </button>

                {/* Progress bar */}
                <div
                  className="flex-1 h-1 bg-white/30 rounded-full cursor-pointer group/progress"
                  onClick={seek}
                >
                  <div
                    className="h-full bg-white rounded-full relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
                  </div>
                </div>

                {/* Mute toggle */}
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-white/80 transition-colors"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          {/* Click overlay to block native controls interaction */}
          <div
            className="absolute inset-0 z-[1]"
            onClick={(e) => {
              e.stopPropagation()
              togglePlay()
            }}
            onContextMenu={handleContextMenu}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        </>
      ) : (
        <img
          src={src}
          alt={alt}
          draggable={false}
          onClick={onClick}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          className="w-full h-auto pointer-events-auto"
          style={{ userSelect: "none", WebkitUserSelect: "none" }}
        />
      )}
      {children}
    </div>
  )
}
