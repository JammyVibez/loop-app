"use client"

import { useState, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Crown,
  Film,
  Image as ImageIcon,
  Upload,
  Trash2,
  Play,
  X,
} from "lucide-react"
import { VideoAvatar } from "./video-avatar"
import { VideoCover } from "./video-cover"
import { waitForMediaReady } from "@/lib/client-media-upload"
import { Spinner } from "@/components/ui/skeletons"

/**
 * VideoMediaSettings — Pro-only panel for uploading and managing
 * animated video profile pictures and cover photos.
 */
export function VideoMediaSettings() {
  const { user, getAuthHeader, refreshUser } = useAuth()
  const { toast } = useToast()
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null)
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null)
  const [previewCover, setPreviewCover] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const isPremium = user?.is_premium

  const handleUpload = async (mediaType: "avatar" | "cover", file: File) => {
    if (!isPremium) {
      toast({ title: "Pro feature", description: "Upgrade to use animated avatars and covers.", variant: "warning" })
      return
    }

    // Validate file type
    const validTypes = ["video/mp4", "video/webm", "video/quicktime", "image/gif", "image/webp"]
    if (!validTypes.includes(file.type)) {
      toast({ title: "Unsupported format", description: "Use MP4, WebM, GIF, or WebP.", variant: "error" })
      return
    }

    // Validate size
    const maxSize = file.type.startsWith("video/") ? 15 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `The maximum is ${file.type.startsWith("video/") ? "15MB" : "5MB"}.`,
        variant: "error",
      })
      return
    }

    setUploading(mediaType)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mediaType", mediaType)

      const res = await fetch("/api/cosmetics/video-media", {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      })

      const data = await res.json()
      if (data.success) {
        toast({
          title: `${mediaType === "avatar" ? "Profile picture" : "Cover photo"} updated`,
          variant: "success",
        })
        let url: string = data.url
        // The MP4 only exists once the background transcode finishes; wait so
        // the preview does not stick on a broken player.
        if (data.status === "processing" && data.id) {
          const ready = await waitForMediaReady([data.id], { timeoutMs: 5 * 60 * 1000 })
          if (ready[data.id]?.url) url = ready[data.id].url
        }
        if (mediaType === "avatar") setPreviewAvatar(url)
        else setPreviewCover(url)
        await refreshUser()
      } else {
        toast({ title: "Couldn't upload", description: data.error || "Try again in a moment.", variant: "error" })
      }
    } catch (err: any) {
      toast({ title: "Couldn't upload", description: err.message || "Try again in a moment.", variant: "error" })
    } finally {
      setUploading(null)
    }
  }

  const handleRemove = async (mediaType: "avatar" | "cover") => {
    try {
      const headers = { ...getAuthHeader(), "Content-Type": "application/json" }
      const res = await fetch(`/api/cosmetics/video-media?mediaType=${mediaType}`, {
        method: "DELETE",
        headers,
      })
      const data = await res.json()
      if (data.success) {
        toast({
          title: `${mediaType === "avatar" ? "Video profile picture" : "Video cover"} removed`,
          variant: "success",
        })
        if (mediaType === "avatar") setPreviewAvatar(null)
        else setPreviewCover(null)
        await refreshUser()
      }
    } catch (err: any) {
      toast({ title: "Couldn't remove that", description: err.message, variant: "error" })
    }
  }

  if (!isPremium) {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shrink-0">
            <Crown className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm">Video Profile Pictures</h4>
            <p className="text-xs text-muted-foreground">
              Pro members can set short video clips and animated GIFs as their profile picture and cover photo.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 text-amber-500 border-amber-500/30">
            Upgrade to Pro
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
          <Film className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            Video Media
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
              <Crown className="h-2.5 w-2.5 mr-1" />
              Pro
            </Badge>
          </h3>
          <p className="text-sm text-muted-foreground">Set animated profile pictures and covers</p>
        </div>
      </div>

      {/* Avatar Upload */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Current avatar preview */}
            <div className="relative shrink-0">
              <VideoAvatar
                src={user?.avatar_url}
                videoSrc={previewAvatar || (user as any)?.video_avatar_url}
                alt={user?.display_name || "Avatar"}
                size="lg"
              />
              {(uploading === "avatar" || uploading === "cover") && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80">
                  <Spinner className="h-6 w-6 text-primary" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <h4 className="font-semibold text-sm">Animated Profile Picture</h4>
                <p className="text-xs text-muted-foreground">
                  Upload a short video clip (MP4, WebM) or animated GIF (max 15MB video / 5MB GIF)
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading !== null}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {previewAvatar || (user as any)?.video_avatar_url ? "Change" : "Upload Video/GIF"}
                </Button>

                {(previewAvatar || (user as any)?.video_avatar_url) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    disabled={uploading !== null}
                    onClick={() => handleRemove("avatar")}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Remove Video
                  </Button>
                )}
              </div>

              <input
                ref={avatarInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload("avatar", file)
                  e.target.value = ""
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cover Upload */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <h4 className="font-semibold text-sm">Animated Cover Photo</h4>
            <p className="text-xs text-muted-foreground">
              Set a short video or GIF as your profile banner (max 15MB video / 5MB GIF)
            </p>
          </div>

          {/* Cover preview */}
          <div className="relative rounded-xl overflow-hidden">
            <VideoCover
              src={user?.banner_url}
              videoSrc={previewCover || (user as any)?.video_cover_url}
              alt="Cover preview"
              height="h-32 sm:h-40"
            />
            {(uploading === "cover") && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <Spinner className="h-6 w-6 text-primary" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={uploading !== null}
              onClick={() => coverInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {previewCover || (user as any)?.video_cover_url ? "Change Cover" : "Upload Video/GIF"}
            </Button>

            {(previewCover || (user as any)?.video_cover_url) && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={uploading !== null}
                onClick={() => handleRemove("cover")}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Remove Video
              </Button>
            )}
          </div>

          <input
            ref={coverInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload("cover", file)
              e.target.value = ""
            }}
          />
        </CardContent>
      </Card>

      {/* Tips */}
      <div className="rounded-xl border border-dashed border-muted-foreground/20 bg-muted/30 p-4 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tips</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li className="flex items-start gap-2">
            <Play className="h-3 w-3 mt-0.5 shrink-0" />
            Keep videos under 10 seconds for the best loop effect
          </li>
          <li className="flex items-start gap-2">
            <ImageIcon className="h-3 w-3 mt-0.5 shrink-0" />
            Animated GIFs auto-loop and work on all browsers
          </li>
          <li className="flex items-start gap-2">
            <Film className="h-3 w-3 mt-0.5 shrink-0" />
            MP4/WebM provide better quality and smaller file sizes
          </li>
        </ul>
      </div>
    </div>
  )
}
