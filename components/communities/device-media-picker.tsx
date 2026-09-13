"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { useAuth } from "@/hooks/use-auth"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ImagePlus, X, ChevronLeft, ChevronRight, Film } from "lucide-react"
import { Spinner } from "@/components/ui/skeletons"

export type PickedMedia = {
  url: string
  kind: "image" | "video"
  public_id?: string
}

/** Cheap URL check used to render <video> instead of <img> for uploaded clips. */
export function isVideoUrl(url?: string | null): boolean {
  if (!url) return false
  return /\.(mp4|webm|ogv|mov|m4v|m3u8)(\?|#|$)/i.test(url) || /video\//.test(url)
}

export function kindFromFile(file: File): "image" | "video" {
  if (file.type.startsWith("video/")) return "video"
  const name = (file.name || "").toLowerCase()
  if (/\.(mp4|webm|mov|m4v|avi|ogv)$/.test(name)) return "video"
  return "image"
}

interface DeviceMediaPickerProps {
  items: PickedMedia[]
  onChange: (items: PickedMedia[]) => void
  maxItems?: number
  folder?: string
  /** Allow picking videos as well as images. Defaults to images + videos. */
  accept?: string
  disabled?: boolean
  /** Compact single-row layout used inside small dialogs. */
  compact?: boolean
}

/**
 * Native device media picker for Community content.
 *
 * Flow: pick from device → client preview → upload (with per-file progress) →
 * remove / reorder → publish. Uploaded URLs are appended to `items`; only
 * successfully uploaded media are ever published.
 */
export function DeviceMediaPicker({
  items,
  onChange,
  maxItems = 10,
  folder = "community-media",
  accept = "image/*,video/*",
  disabled = false,
  compact = false,
}: DeviceMediaPickerProps) {
  const { user, getAuthHeader } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadName, setUploadName] = useState("")
  const [error, setError] = useState("")

  const remaining = Math.max(0, maxItems - items.length)
  const canAdd = !disabled && remaining > 0 && !uploading

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!user) {
      setError("Sign in to upload media")
      return
    }
    setError("")
    const queue = Array.from(files).slice(0, remaining)
    if (queue.length === 0) return

    // Keep a local working copy so consecutive uploads never drop earlier ones.
    let working = items
    for (const file of queue) {
      setUploading(true)
      setUploadName(file.name)
      try {
        const uploaded = await uploadMediaFile(file, {
          type: kindFromFile(file),
          folder,
          authHeaders: getAuthHeader(),
        })
        const kind: "image" | "video" = kindFromFile(file)
        working = [...working, { url: uploaded.url, kind, public_id: uploaded.public_id }]
        onChange(working)
      } catch (e: any) {
        setError(e?.message || "Upload failed — please try another file")
        break
      } finally {
        setUploading(false)
      }
    }
    if (inputRef.current) inputRef.current.value = ""
  }

  const removeAt = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {items.length > 0 && (
        <div className={cn("flex flex-wrap gap-2", compact && "gap-1.5")}>
          {items.map((m, i) => (
            <div key={`${m.url}-${i}`} className="relative">
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl border border-border bg-muted",
                  compact ? "h-16 w-16" : "h-24 w-24"
                )}
              >
                {m.kind === "video" || isVideoUrl(m.url) ? (
                  <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  <Image src={m.url} alt="" fill unoptimized className="object-cover" />
                )}
                {(m.kind === "video" || isVideoUrl(m.url)) && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60">
                    <Film className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove media"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow transition hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move earlier"
                    className="absolute -left-1.5 bottom-1/2 flex h-5 w-5 translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow transition hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    aria-label="Move later"
                    className="absolute -right-1.5 bottom-1/2 flex h-5 w-5 translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow transition hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={maxItems > 1}
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("rounded-full h-8 text-[11px]", !canAdd && "pointer-events-none opacity-40")}
          disabled={!canAdd}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Spinner className="h-3 w-3 mr-1.5" /> : <ImagePlus className="h-3.5 w-3.5 mr-1.5" />}
          {uploading ? `Uploading ${uploadName.slice(0, 18)}…` : items.length === 0 ? "Upload from device" : "Add media"}
        </Button>
        {maxItems > 1 && items.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {items.length}/{maxItems} · drag not needed — use the arrows to reorder
          </span>
        )}
        {maxItems > 1 && remaining === 0 && (
          <span className="text-[10px] font-medium text-muted-foreground">Media limit reached for your plan</span>
        )}
      </div>

      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
