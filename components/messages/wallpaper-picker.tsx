"use client"

import { useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/skeletons"
import { Wallpaper, ImagePlus } from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"
import {
  CHAT_WALLPAPER_PRESETS,
  chatWallpaperStyle,
  DEFAULT_CHAT_WALLPAPER,
  type ChatWallpaper,
} from "@/lib/chat-wallpapers"

interface WallpaperPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wallpaper: ChatWallpaper
  onSave: (next: ChatWallpaper) => void
  onUpload: (file: File) => void
  uploading: boolean
}

/**
 * Chat wallpaper picker dialog — extracted from messages-workspace.
 * Owns nothing but its file input; all state lives in the workspace.
 */
export function WallpaperPicker({
  open,
  onOpenChange,
  wallpaper,
  onSave,
  onUpload,
  uploading,
}: WallpaperPickerProps) {
  const wallpaperFileRef = useRef<HTMLInputElement>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallpaper className="h-4 w-4 text-violet-500" /> Chat wallpaper
          </DialogTitle>
          <DialogDescription>
            Pick a preset or upload your own image. Only you see this — it&apos;s saved to your account for this chat.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={wallpaperFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ""
          }}
        />
        <div
          className="relative flex h-28 items-end overflow-hidden rounded-xl border border-border"
          style={chatWallpaperStyle(wallpaper)}
        >
          <div className="w-full bg-gradient-to-t from-black/50 to-transparent p-2">
            <p className="text-[11px] font-medium text-white drop-shadow">
              {wallpaper.image_url
                ? "Custom image"
                : wallpaper.preset
                  ? CHAT_WALLPAPER_PRESETS.find((p) => p.id === wallpaper.preset)?.name || "Preset"
                  : "Default background"}
            </p>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Presets</p>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onSave(DEFAULT_CHAT_WALLPAPER)}
              className={cn(
                "flex h-14 items-center justify-center rounded-lg border border-border bg-muted text-[10px] font-medium text-muted-foreground transition hover:border-violet-500/50",
                !wallpaper.preset && !wallpaper.image_url && "border-violet-500 ring-1 ring-violet-500/40",
              )}
              title="Default"
            >
              Default
            </button>
            {CHAT_WALLPAPER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSave({ preset: preset.id, image_url: null, overlay: null })}
                className={cn(
                  "h-14 rounded-lg border transition hover:scale-[1.03]",
                  wallpaper.preset === preset.id && !wallpaper.image_url
                    ? "border-violet-500 ring-2 ring-violet-500/40"
                    : "border-border",
                )}
                style={{ background: preset.css }}
                title={preset.name}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={uploading}
            onClick={() => wallpaperFileRef.current?.click()}
          >
            {uploading ? (
              <Spinner className="mr-1.5 h-4 w-4" />
            ) : (
              <ImagePlus className="mr-1.5 h-4 w-4" />
            )}
            {wallpaper.image_url ? "Change image" : "Upload from device"}
          </Button>
          {wallpaper.image_url && (
            <Button variant="ghost" onClick={() => onSave(DEFAULT_CHAT_WALLPAPER)}>
              Reset
            </Button>
          )}
        </div>
        {wallpaper.image_url && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Darken image</p>
            <Slider
              value={[Math.round((wallpaper.overlay ?? 0.35) * 100)]}
              min={0}
              max={70}
              step={5}
              onValueChange={([v]) => onSave({ ...wallpaper, overlay: v / 100 })}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
