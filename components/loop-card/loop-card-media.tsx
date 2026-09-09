"use client"

import { useState, useRef, useCallback } from "react"
import { Heart, Volume2, Crown, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTheme3D } from "../../providers/theme-3d-provider"
import { optimizeImageUrl } from "@/lib/optimize-image"
import { ProtectedMedia } from "@/components/media-protection"

interface LoopCardMediaProps {
  mediaType: string
  mediaUrl?: string
  mediaUrls?: string[]
  doubleTapHeart: boolean
  onDoubleTapLike: () => void
  onOpenViewer: () => void
}

export function LoopCardMedia({
  mediaType,
  mediaUrl,
  mediaUrls: propMediaUrls,
  doubleTapHeart,
  onDoubleTapLike,
  onOpenViewer,
}: LoopCardMediaProps) {
  const { currentTheme } = useTheme3D()
  const [currentIndex, setCurrentIndex] = useState(0)
  const lastTapRef = useRef(0)

  const mediaUrls = propMediaUrls || (mediaUrl ? [mediaUrl] : [])
  if (mediaUrls.length === 0) return null

  const mediaContainerStyle = currentTheme?.effects?.glow
    ? "shadow-lg shadow-[var(--theme-primary)]/10"
    : ""

  const handleDoubleTap = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 320) {
      onDoubleTapLike()
      lastTapRef.current = 0
      return
    }
    lastTapRef.current = now
  }, [onDoubleTapLike])

  // Single media
  if (mediaUrls.length === 1) {
    const url = mediaUrls[0]
    switch (mediaType) {
      case "image":
        return (
          <div className={`mt-3 overflow-hidden rounded-xl bg-muted ring-1 ring-black/5 ${mediaContainerStyle}`}>
            <ProtectedMedia
              type="image"
              src={optimizeImageUrl(url, 900) || "/placeholder.svg"}
              alt="Loop media"
              onClick={onOpenViewer}
              className="w-full h-auto max-h-96 cursor-zoom-in object-cover transition-transform duration-300 hover:scale-105"
            />
          </div>
        )
      case "video":
        return (
          <div className={`mt-3 overflow-hidden rounded-xl bg-black relative ${mediaContainerStyle}`}>
            <ProtectedMedia
              type="video"
              src={url}
              poster="/placeholder.svg?height=300&width=500"
              className="w-full h-auto max-h-96"
              onClick={onOpenViewer}
            />
          </div>
        )
      case "audio":
        return (
          <div className={`mt-3 p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg ${mediaContainerStyle}`}>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-600 rounded-full">
                <Volume2 className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Audio Loop</p>
                <audio
                  controls
                  className="w-full mt-2"
                  src={url}
                  preload="metadata"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                >
                  Your browser does not support audio playback.
                </audio>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  // Multi-media gallery
  return (
    <div className={`mt-3 overflow-hidden rounded-xl bg-muted ring-1 ring-black/5 relative ${mediaContainerStyle}`}>
      <div className="absolute top-2 right-2 z-10">
        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs">
          <Crown className="h-3 w-3 mr-1" />
          Premium
        </Badge>
      </div>

      <div
        className="relative cursor-zoom-in"
        onClick={onOpenViewer}
        onDoubleClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDoubleTapLike()
        }}
        onTouchEnd={(e) => {
          const now = Date.now()
          if (now - lastTapRef.current < 320) {
            e.preventDefault()
            e.stopPropagation()
            onDoubleTapLike()
            lastTapRef.current = 0
            return
          }
          lastTapRef.current = now
        }}
      >
        {doubleTapHeart && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <Heart className="h-20 w-20 fill-white text-white drop-shadow-xl animate-in zoom-in-50 fade-in duration-300" />
          </div>
        )}
        {mediaType === "image" ? (
          <ProtectedMedia
            type="image"
            src={optimizeImageUrl(mediaUrls[currentIndex], 900) || "/placeholder.svg"}
            alt={`Loop media ${currentIndex + 1}`}
            className="w-full h-auto max-h-96 object-cover"
          />
        ) : mediaType === "video" ? (
          <ProtectedMedia
            type="video"
            src={mediaUrls[currentIndex]}
            className="w-full h-auto max-h-96"
          />
        ) : null}

        {mediaUrls.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/60 text-white hover:bg-black/80 rounded-full p-1.5 z-20"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaUrls.length - 1))
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/60 text-white hover:bg-black/80 rounded-full p-1.5 z-20"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setCurrentIndex((prev) => (prev < mediaUrls.length - 1 ? prev + 1 : 0))
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {mediaUrls.length > 1 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1.5 z-20 bg-black/40 px-2 py-1 rounded-full backdrop-blur-xs">
          {mediaUrls.map((_: string, index: number) => (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setCurrentIndex(index)
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? "bg-white w-4" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      )}

      {mediaUrls.length > 1 && (
        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
          {currentIndex + 1} / {mediaUrls.length}
        </div>
      )}
    </div>
  )
}
