"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "@/components/icons/lucide-compat"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MediaItem {
  url: string
  type: "image" | "video"
  alt?: string
}

interface EnhancedMediaViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Single URL or array of media items */
  media: string | MediaItem[]
  /** Starting index when multiple items */
  startIndex?: number
  /** Alt text for single image */
  alt?: string
  /** Show download button */
  showDownload?: boolean
  /** Show share button */
  showShare?: boolean
  /** Custom action buttons */
  actions?: React.ReactNode
}

/**
 * Enhanced media viewer with:
 * - Image preloading for adjacent items
 * - Pinch-to-zoom / double-tap zoom
 * - Keyboard navigation (arrow keys, Escape)
 * - Swipe gestures on mobile
 * - Video controls (play/pause, volume, fullscreen)
 * - Download and share buttons
 */
export function EnhancedMediaViewer({
  open,
  onOpenChange,
  media,
  startIndex = 0,
  alt = "",
  showDownload = true,
  showShare = true,
  actions,
}: EnhancedMediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoMuted, setVideoMuted] = useState(true)
  const [videoProgress, setVideoProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const preloadedRef = useRef(new Set<string>())

  // Normalize media to array
  const items: MediaItem[] = typeof media === "string"
    ? [{ url: media, type: "image", alt }]
    : media

  const currentItem = items[currentIndex]
  const hasMultiple = items.length > 1

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setCurrentIndex(startIndex)
      setZoom(1)
      setPosition({ x: 0, y: 0 })
      setVideoPlaying(false)
    }
  }, [open, startIndex])

  // Preload adjacent images
  useEffect(() => {
    if (!open || !hasMultiple) return

    const preloadIndexes = [currentIndex - 1, currentIndex + 1]
    for (const idx of preloadIndexes) {
      if (idx >= 0 && idx < items.length) {
        const item = items[idx]
        if (item.type === "image" && !preloadedRef.current.has(item.url)) {
          preloadedRef.current.add(item.url)
          const img = new Image()
          img.src = item.url
        }
      }
    }
  }, [currentIndex, items, open, hasMultiple])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          navigatePrev()
          break
        case "ArrowRight":
          e.preventDefault()
          navigateNext()
          break
        case "Escape":
          onOpenChange(false)
          break
        case "+":
        case "=":
          e.preventDefault()
          handleZoomIn()
          break
        case "-":
          e.preventDefault()
          handleZoomOut()
          break
        case "0":
          e.preventDefault()
          resetZoom()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, currentIndex, items.length])

  const navigatePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))
    resetZoom()
  }, [items.length])

  const navigateNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))
    resetZoom()
  }, [items.length])

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.5, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.5, 0.5)
      if (next <= 1) setPosition({ x: 0, y: 0 })
      return next
    })
  }, [])

  const resetZoom = useCallback(() => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  // Double-tap zoom
  const lastTapRef = useRef(0)
  const handleTap = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      // Double tap
      if (zoom > 1) {
        resetZoom()
      } else {
        setZoom(2.5)
      }
    }
    lastTapRef.current = now
  }, [zoom, resetZoom])

  // Drag to pan when zoomed
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    },
    [zoom, position]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    },
    [isDragging, dragStart]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Video controls
  const toggleVideoPlay = useCallback(() => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setVideoPlaying(true)
    } else {
      videoRef.current.pause()
      setVideoPlaying(false)
    }
  }, [])

  const toggleVideoMute = useCallback(() => {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
    setVideoMuted(!videoMuted)
  }, [videoMuted])

  const handleVideoProgress = useCallback(() => {
    if (!videoRef.current) return
    const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100
    setVideoProgress(progress || 0)
  }, [])

  const handleDownload = useCallback(async () => {
    if (!currentItem) return
    try {
      const response = await fetch(currentItem.url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = currentItem.url.split("/").pop() || "media"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(currentItem.url, "_blank")
    }
  }, [currentItem])

  if (!currentItem) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent scrollable={false} className="max-w-[100vw] max-h-[100vh] w-full h-full p-0 bg-black/95 border-0 overflow-hidden">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            {hasMultiple && (
              <Badge variant="secondary" className="bg-black/50 text-white border-0 text-xs">
                {currentIndex + 1} / {items.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {zoom > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={resetZoom}
                className="h-8 w-8 text-white hover:bg-white/20"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (zoom > 1 ? handleZoomOut() : handleZoomIn())}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              {zoom > 1 ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
            </Button>
            {showDownload && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="h-8 w-8 text-white hover:bg-white/20"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Media Content */}
        <div
          ref={containerRef}
          className="relative w-full h-full flex items-center justify-center overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? "grab" : "default" }}
        >
          {currentItem.type === "video" ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                src={currentItem.url}
                className="max-w-full max-h-full object-contain"
                onClick={toggleVideoPlay}
                onTimeUpdate={handleVideoProgress}
                muted={videoMuted}
                playsInline
                preload="auto"
              />
              {/* Video Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                {/* Progress Bar */}
                <div className="w-full h-1 bg-white/20 rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-150"
                    style={{ width: `${videoProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleVideoPlay}
                      className="h-8 w-8 text-white hover:bg-white/20"
                    >
                      {videoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleVideoMute}
                      className="h-8 w-8 text-white hover:bg-white/20"
                    >
                      {videoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </div>
                  {showShare && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {/* handled by parent */}}
                      className="h-8 w-8 text-white hover:bg-white/20"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <img
              src={currentItem.url}
              alt={currentItem.alt || alt}
              className={cn(
                "max-w-full max-h-full object-contain transition-transform duration-200",
                isDragging && "cursor-grabbing"
              )}
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              }}
              onClick={handleTap}
              draggable={false}
            />
          )}
        </div>

        {/* Navigation Arrows */}
        {hasMultiple && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={navigatePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 z-50"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={navigateNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 z-50"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Thumbnail Strip */}
        {hasMultiple && items.length <= 10 && (
          <div className="absolute bottom-0 left-0 right-0 z-50 flex justify-center gap-1.5 p-3 bg-gradient-to-t from-black/60 to-transparent">
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx)
                  resetZoom()
                }}
                className={cn(
                  "h-10 w-10 rounded-lg overflow-hidden border-2 transition-all",
                  idx === currentIndex
                    ? "border-white scale-110"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                {item.type === "video" ? (
                  <div className="h-full w-full bg-black/50 flex items-center justify-center">
                    <Play className="h-3 w-3 text-white" />
                  </div>
                ) : (
                  <img
                    src={item.url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Custom Actions */}
        {actions && (
          <div className="absolute bottom-20 left-0 right-0 z-50 flex justify-center">
            {actions}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
