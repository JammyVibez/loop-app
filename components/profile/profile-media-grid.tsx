"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { EnhancedMediaViewer } from "@/components/media/enhanced-media-viewer"
import {
  Image as ImageIcon,
  Film,
  LayoutGrid,
  Play,
  Eye,
  Heart,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MediaItem {
  id: string
  url: string
  type: "image" | "video"
  likes?: number
  views?: number
}

interface ProfileMediaGridProps {
  loops: Array<{
    id: string
    media_url?: string
    media_urls?: string[]
    media_type?: string
    like_count?: number
    view_count?: number
  }>
}

type FilterType = "all" | "images" | "videos"

export function ProfileMediaGrid({ loops }: ProfileMediaGridProps) {
  const [filter, setFilter] = useState<FilterType>("all")
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)

  // Extract all media items from loops
  const mediaItems = useMemo(() => {
    const items: MediaItem[] = []

    for (const loop of loops) {
      const urls = loop.media_urls?.length
        ? loop.media_urls
        : loop.media_url
        ? [loop.media_url]
        : []

      for (const url of urls) {
        if (!url) continue
        const isVideo =
          loop.media_type === "video" ||
          url.match(/\.(mp4|webm|mov|avi)$/i) ||
          url.includes("video")

        items.push({
          id: `${loop.id}-${url}`,
          url,
          type: isVideo ? "video" : "image",
          likes: loop.like_count,
          views: loop.view_count,
        })
      }
    }

    return items
  }, [loops])

  // Filter items
  const filteredItems = useMemo(() => {
    if (filter === "images") return mediaItems.filter((i) => i.type === "image")
    if (filter === "videos") return mediaItems.filter((i) => i.type === "video")
    return mediaItems
  }, [mediaItems, filter])

  // Build viewer media array
  const viewerMedia = useMemo(() => {
    return filteredItems.map((item) => ({
      url: item.url,
      type: item.type as "image" | "video",
    }))
  }, [filteredItems])

  if (mediaItems.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <ImageIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No media yet</p>
      </div>
    )
  }

  const imageCount = mediaItems.filter((i) => i.type === "image").length
  const videoCount = mediaItems.filter((i) => i.type === "video").length

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex items-center gap-2 px-4 py-2">
        {[
          { id: "all" as FilterType, label: "All", count: mediaItems.length, icon: LayoutGrid },
          { id: "images" as FilterType, label: "Photos", count: imageCount, icon: ImageIcon },
          { id: "videos" as FilterType, label: "Videos", count: videoCount, icon: Film },
        ].map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
            <span className="text-[10px] opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {/* Masonry Grid */}
      <div className="grid grid-cols-3 gap-0.5">
        {filteredItems.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => {
              setViewerIndex(idx)
              setViewerOpen(true)
            }}
            className="group relative aspect-square overflow-hidden bg-muted"
          >
            {item.type === "video" ? (
              <>
                <video
                  src={item.url}
                  className="h-full w-full object-cover"
                  muted
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white">
                    <Play className="h-4 w-4 ml-0.5" />
                  </div>
                </div>
              </>
            ) : (
              <img
                src={item.url}
                alt=""
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end p-2 opacity-0 group-hover:opacity-100">
              <div className="flex items-center gap-3 text-white text-[10px]">
                {item.likes !== undefined && (
                  <span className="flex items-center gap-0.5">
                    <Heart className="h-3 w-3 fill-white" />
                    {item.likes}
                  </span>
                )}
                {item.views !== undefined && (
                  <span className="flex items-center gap-0.5">
                    <Eye className="h-3 w-3" />
                    {item.views}
                  </span>
                )}
              </div>
            </div>

            {/* Video Duration Badge */}
            {item.type === "video" && (
              <div className="absolute top-1 right-1">
                <Badge variant="secondary" className="bg-black/50 text-white text-[9px] px-1 py-0">
                  <Film className="h-2.5 w-2.5 mr-0.5" />
                  Video
                </Badge>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Enhanced Media Viewer */}
      <EnhancedMediaViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={viewerMedia}
        startIndex={viewerIndex}
        showDownload
        showShare={false}
      />
    </div>
  )
}
