"use client"

import { useState } from "react"
import { Download, Lock, Loader2, Check, Image, Video, FileText } from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

type SaveToDeviceProps = {
  /** Direct URL of the media to download */
  mediaUrl: string
  /** File extension hint, e.g. "mp4", "jpg" */
  filename?: string
  /** Content type to determine download behavior */
  contentType?: "video" | "image" | "audio" | "file"
  /** Allow download (reels/loops may disable this) */
  allowsDownloads?: boolean
  /** Whether user is Pro (required for download) */
  isPro?: boolean
  /** Size variant */
  size?: "sm" | "default" | "lg"
  /** Show as icon-only button */
  iconOnly?: boolean
  /** Extra className */
  className?: string
}

export function SaveToDevice({
  mediaUrl,
  filename,
  contentType = "video",
  allowsDownloads = true,
  isPro = false,
  size = "sm",
  iconOnly = false,
  className = "",
}: SaveToDeviceProps) {
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [done, setDone] = useState(false)

  const handleDownload = async () => {
    if (!isPro) {
      toast({
        title: "Pro Feature",
        description: "Download media with Loop Pro. Upgrade to save videos, images, and audio to your device.",
        variant: "default",
      })
      return
    }

    if (!mediaUrl || !allowsDownloads) {
      toast({ title: "Download not available", variant: "destructive" })
      return
    }

    setDownloading(true)
    try {
      // Fetch the media
      const response = await fetch(mediaUrl)
      if (!response.ok) throw new Error("Failed to fetch media")

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      // Determine extension from URL or content type
      let ext = filename?.split(".").pop()
      if (!ext) {
        const urlPath = new URL(mediaUrl).pathname.toLowerCase()
        if (urlPath.includes(".mp4") || urlPath.includes(".mov") || urlPath.includes(".webm")) ext = "mp4"
        else if (urlPath.includes(".jpg") || urlPath.includes(".jpeg")) ext = "jpg"
        else if (urlPath.includes(".png")) ext = "png"
        else if (urlPath.includes(".gif")) ext = "gif"
        else if (urlPath.includes(".webp")) ext = "webp"
        else if (urlPath.includes(".mp3") || urlPath.includes(".wav") || urlPath.includes(".ogg")) ext = "mp3"
        else ext = contentType === "video" ? "mp4" : contentType === "image" ? "jpg" : "mp4"
      }

      // Create download link
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `loop-${Date.now()}.${ext}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(blobUrl)

      setDone(true)
      toast({ title: "Saved to device! 📥" })
      setTimeout(() => setDone(false), 3000)
    } catch (err: any) {
      console.error("Download failed:", err)
      toast({ title: "Download failed", description: err.message || "Could not save media", variant: "destructive" })
    } finally {
      setDownloading(false)
    }
  }

  const Icon = done ? Check : downloading ? Loader2 : contentType === "image" ? Image : contentType === "video" ? Video : Download
  const label = done ? "Saved!" : iconOnly ? "" : !isPro ? "Download" : "Save"

  return (
    <Button
      variant="ghost"
      size={size}
      className={`${className} ${!isPro ? "text-muted-foreground hover:text-primary" : done ? "text-green-500" : ""}`}
      onClick={handleDownload}
      disabled={downloading || done}
    >
      {!isPro && <Lock className="h-3.5 w-3.5 mr-1 opacity-60" />}
      <Icon className={`h-4 w-4 ${downloading ? "animate-spin" : ""} ${iconOnly ? "" : "mr-1.5"}`} />
      {!iconOnly && <span className="text-xs">{label}</span>}
    </Button>
  )
}
