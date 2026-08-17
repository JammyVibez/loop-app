"use client"

import { useCallback, useRef, useState } from "react"
import { Clock, ImagePlus, Loader2, Send, Trash2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { cn } from "@/lib/utils"

interface CreateMomentFormProps {
  onMomentCreated?: () => void
}

export function CreateMomentForm({ onMomentCreated }: CreateMomentFormProps) {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [caption, setCaption] = useState("")
  const [hours, setHours] = useState<24 | 48>(24)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickFile = useCallback((file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: "File too large", description: "Moments support files up to 100 MB.", variant: "destructive" })
      return
    }
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }, [toast])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) pickFile(file)
    },
    [pickFile],
  )

  const removeMedia = useCallback(() => {
    setMediaFile(null)
    if (mediaPreview) URL.revokeObjectURL(mediaPreview)
    setMediaPreview(null)
  }, [mediaPreview])

  const createMoment = useCallback(async () => {
    if (creating) return
    if (!mediaFile && !caption.trim()) {
      toast({ title: "Add a photo, video, or caption", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      let uploadedUrl = ""
      let uploadedType = "image"
      if (mediaFile) {
        setUploading(true)
        const isVid = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(mediaFile.name)
        uploadedType = isVid ? "video" : "image"
        const result = await uploadMediaFile(mediaFile, {
          type: uploadedType as "image" | "video",
          folder: "moments",
          authHeaders: getAuthHeader(),
        })
        uploadedUrl = result.url
        setUploading(false)
      }

      const res = await fetch("/api/moments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          media_url: uploadedUrl || undefined,
          media_type: uploadedType,
          content: caption.trim() || undefined,
          hours,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create moment")
      }

      toast({ title: "Moment posted!", description: `Visible for ${hours}h — then it vanishes forever.` })
      setCaption("")
      setMediaFile(null)
      if (mediaPreview) URL.revokeObjectURL(mediaPreview)
      setMediaPreview(null)
      onMomentCreated?.()
    } catch (error: any) {
      toast({ title: "Couldn't create moment", description: error.message, variant: "destructive" })
    } finally {
      setCreating(false)
      setUploading(false)
    }
  }, [creating, mediaFile, caption, hours, getAuthHeader, toast, mediaPreview, onMomentCreated])

  const isVideo = mediaPreview && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(mediaFile?.name || "")

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Zap className="h-4 w-4 text-amber-400" />
        <span>Moments disappear forever after their time is up — like a passing thought, not a permanent post.</span>
      </div>

      {/* Media preview */}
      {mediaPreview && (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-amber-500/30 bg-card/60">
          {isVideo ? (
            <video src={mediaPreview} className="max-h-64 w-full object-cover" controls muted />
          ) : (
            <img src={mediaPreview} alt="Moment preview" className="max-h-64 w-full object-cover" />
          )}
          <Button
            variant="destructive"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7 rounded-full"
            onClick={removeMedia}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Caption */}
      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What's on your mind? (optional if you add media)"
        maxLength={500}
        className="min-h-[80px] resize-none rounded-2xl border-border/60 bg-card/50"
      />

      {/* Duration picker */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Lives for:</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setHours(24)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              hours === 24
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            24 hours
          </button>
          <button
            type="button"
            onClick={() => setHours(48)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              hours === 48
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            48 hours (Pro)
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,.mp4,.webm,.mov,.ogg"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => fileRef.current?.click()}
          disabled={creating || uploading}
        >
          <ImagePlus className="mr-1.5 h-4 w-4" />
          {mediaFile ? "Replace media" : "Add photo/video"}
        </Button>
        <div className="flex-1" />
        <Button
          onClick={() => void createMoment()}
          disabled={creating || uploading || (!mediaFile && !caption.trim())}
          className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-5 text-white hover:from-amber-400 hover:to-orange-500"
        >
          {creating || uploading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          {uploading ? "Uploading…" : creating ? "Posting…" : "Post moment"}
        </Button>
      </div>
    </div>
  )
}
