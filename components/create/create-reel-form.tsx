"use client"

import { useRef, useState } from "react"
import { Loader2, Upload, Video, X } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useLoginGate } from "@/hooks/use-login-gate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { parseJsonResponse } from "@/lib/parse-json-response"

const MAX_VIDEO_BYTES = 50 * 1024 * 1024

interface CreateTreeFormProps {
  onTreeCreated?: (reelId: string | null) => void
}

export function CreateTreeForm({ onTreeCreated }: CreateTreeFormProps) {
  const { user, getAuthHeader } = useAuth()
  const { requireAuth, isGuest, LoginGateDialog } = useLoginGate()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadProgressLabel, setUploadProgressLabel] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    e.target.value = ""
    if (!selected) return

    if (!selected.type.startsWith("video/")) {
      toast({ title: "Video files only", description: "Tree support video uploads for now.", variant: "destructive" })
      return
    }
    if (selected.size > MAX_VIDEO_BYTES) {
      toast({
        title: "File too large",
        description: `Max tree size is ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB.`,
        variant: "destructive",
      })
      return
    }

    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const clearFile = () => {
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }

  const handlePublish = async () => {
    if (!requireAuth("post")) return
    if (!file) {
      toast({ title: "Add a video", description: "Pick a video clip to publish as a Tree.", variant: "destructive" })
      return
    }
    if (!title.trim()) {
      toast({ title: "Title required", description: "Give your Reel a short title.", variant: "destructive" })
      return
    }

    setUploading(true)
    try {
      setUploadProgressLabel("Uploading video…")
      // Videos always go straight to Cloudinary via a signed direct upload
      // instead of through /api/upload — a 50MB reel bundled into a Next.js
      // API request body blows well past Vercel's ~4.5MB serverless request
      // limit, and Vercel's resulting error page isn't JSON, so the old
      // `uploadRes.json()` call here would throw a confusing parse error
      // instead of a real "file too large" message.
      const uploaded = await uploadMediaFile(file, {
        type: "video",
        folder: "reels",
        authHeaders: getAuthHeader(),
      })

      setUploadProgressLabel("Publishing reel…")
      const tags = hashtags
        .split(/[ ,#]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)

      const treeRes = await fetch("/api/trees", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          content_type: "video",
          content_url: uploaded.url,
          thumbnail_url: null,
          duration: uploaded.duration || null,
          hashtags: tags,
        }),
      })
      const { data: treeData } = await parseJsonResponse<any>(treeRes)
      if (!treeRes.ok) throw new Error(treeData?.error || "Failed to publish reel")

      toast({ title: "Tree published! 🎬", description: "Your reel is live in the feed." })
      setFile(null)
      setPreviewUrl(null)
      setTitle("")
      setDescription("")
      setHashtags("")
      onTreeCreated?.(treeData.data?.reel?.id || null)
    } catch (error: any) {
      toast({ title: "Couldn't publish reel", description: error.message || "Something went wrong", variant: "destructive" })
    } finally {
      setUploading(false)
      setUploadProgressLabel(null)
    }
  }

  if (isGuest) {
    return (
      <>
        {LoginGateDialog}
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Video className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">Sign in to publish a Reel</p>
          <Button className="mt-4 rounded-full" onClick={() => requireAuth("post")}>
            Sign in
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      {LoginGateDialog}
      <div className="space-y-4">
        {!previewUrl ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40">
            <Upload className="h-8 w-8 text-violet-500" />
            <span className="font-medium text-foreground">Upload a video clip</span>
            <span className="text-xs">MP4, WebM, or MOV — up to {Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB</span>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
          </label>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
            <video src={previewUrl} controls className="max-h-96 w-full" />
            <button
              type="button"
              onClick={clearFile}
              className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-rose-600"
              title="Remove video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="tree-title">Title</Label>
          <Input
            id="tree-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your reel a catchy title"
            maxLength={100}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tree-desc">Description</Label>
          <Textarea
            id="tree-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this reel about?"
            className="min-h-[80px]"
            maxLength={500}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reel-tags">Hashtags</Label>
          <Input
            id="reel-tags"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="dance comedy tutorial"
          />
        </div>

        <Button
          onClick={handlePublish}
          disabled={uploading || !file}
          className="h-12 w-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-base font-bold"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {uploadProgressLabel || "Publishing…"}
            </>
          ) : (
            "Publish Tree"
          )}
        </Button>
      </div>
    </>
  )
}
