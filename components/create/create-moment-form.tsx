"use client"

import { useCallback, useRef, useState } from "react"
import { Clock, ImagePlus, Send, SlidersHorizontal, Trash2, Zap } from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"
import { ActionFeedback, type ActionPhase } from "@/components/ui/action-feedback"
import { PostMediaEditor } from "@/components/ui/post-media-editor"
import {
  DEFAULT_VIDEO_EDIT,
  buildEditedVideoUrl,
  isEditableImageFile,
  isVideoFile,
  videoEditIsNoop,
  type VideoEdit,
} from "@/lib/media-edit"

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
  const [videoEdit, setVideoEdit] = useState<VideoEdit>(DEFAULT_VIDEO_EDIT)
  const [editorOpen, setEditorOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [publishPhase, setPublishPhase] = useState<ActionPhase>("idle")
  const [publishError, setPublishError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const publishBusyRef = useRef(false)

  const pickFile = useCallback((file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: "File too large", description: "Moments support files up to 100 MB.", variant: "destructive" })
      return
    }
    if (mediaPreview) URL.revokeObjectURL(mediaPreview)
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
    setVideoEdit(DEFAULT_VIDEO_EDIT)
    // Photos and clips open the same pre-post editor as the composer.
    if (isEditableImageFile(file) || isVideoFile(file)) setEditorOpen(true)
  }, [mediaPreview, toast])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) pickFile(file)
    },
    [pickFile],
  )

  const removeMedia = useCallback(() => {
    setMediaFile(null)
    setVideoEdit(DEFAULT_VIDEO_EDIT)
    if (mediaPreview) URL.revokeObjectURL(mediaPreview)
    setMediaPreview(null)
  }, [mediaPreview])

  const applyEditedImage = useCallback(
    (edited: File) => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview)
      setMediaFile(edited)
      setMediaPreview(URL.createObjectURL(edited))
      setEditorOpen(false)
    },
    [mediaPreview],
  )

  const createMoment = useCallback(async () => {
    if (creating || publishBusyRef.current) return
    if (!mediaFile && !caption.trim()) {
      toast({ title: "Add a photo, video, or caption", variant: "destructive" })
      return
    }
    publishBusyRef.current = true
    setPublishError(null)
    setPublishPhase("working")
    setCreating(true)
    try {
      let uploadedUrl = ""
      let uploadedType = "image"
      if (mediaFile) {
        setUploading(true)
        const isVid = isVideoFile(mediaFile)
        uploadedType = isVid ? "video" : "image"
        const result = await uploadMediaFile(mediaFile, {
          type: uploadedType as "image" | "video",
          folder: "moments",
          authHeaders: getAuthHeader(),
        })
        uploadedUrl = isVid ? buildEditedVideoUrl(result.url, videoEdit) : result.url
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

      setPublishPhase("success")
      await new Promise((resolve) => setTimeout(resolve, 650))
      toast({ title: "Moment posted!", description: `Visible for ${hours}h — then it vanishes forever.` })
      setPublishPhase("idle")
      setCaption("")
      setMediaFile(null)
      setVideoEdit(DEFAULT_VIDEO_EDIT)
      if (mediaPreview) URL.revokeObjectURL(mediaPreview)
      setMediaPreview(null)
      onMomentCreated?.()
    } catch (error: any) {
      setPublishPhase("error")
      setPublishError(error.message || "Something went wrong")
      toast({ title: "Couldn't create moment", description: error.message, variant: "destructive" })
    } finally {
      publishBusyRef.current = false
      setCreating(false)
      setUploading(false)
    }
  }, [creating, mediaFile, caption, hours, getAuthHeader, toast, mediaPreview, onMomentCreated, videoEdit])

  const isVideo = isVideoFile(mediaFile)
  const trimmed = isVideo && !videoEditIsNoop(videoEdit)

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
          <div className="absolute right-2 top-2 flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-full border-white/30 bg-black/60 px-2.5 text-[11px] text-white backdrop-blur-sm hover:bg-violet-600 hover:text-white"
              onClick={() => setEditorOpen(true)}
              disabled={!mediaFile || (!isEditableImageFile(mediaFile) && !isVideoFile(mediaFile))}
            >
              <SlidersHorizontal className="mr-1 h-3 w-3" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={removeMedia}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {trimmed ? (
            <span className="absolute left-2 top-2 rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
              Trimmed
            </span>
          ) : null}
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

      <ActionFeedback
        phase={publishPhase}
        label={uploading ? "Uploading your moment" : "Posting your moment"}
        error={publishError || undefined}
        onRetry={() => void createMoment()}
        successLabel="Moment posted"
      />

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
            <Spinner className="mr-1.5 h-4 w-4" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          {uploading ? "Uploading…" : creating ? "Posting…" : "Post moment"}
        </Button>
      </div>

      <PostMediaEditor
        file={mediaFile}
        open={editorOpen}
        initialVideoEdit={videoEdit}
        onClose={() => setEditorOpen(false)}
        onApplyImage={(edited) => applyEditedImage(edited)}
        onApplyVideo={(edit) => {
          setVideoEdit(edit)
          setEditorOpen(false)
        }}
      />
    </div>
  )
}
