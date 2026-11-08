"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DynamicButton } from "@/components/ui/dynamic-button"
import { MagneticDropZone } from "@/components/ui/magnetic-drop-zone"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CODE_LANGUAGES } from "@/lib/pro-features"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { useLoginGate } from "@/hooks/use-login-gate"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { parseJsonResponse } from "@/lib/parse-json-response"
import { cn } from "@/lib/utils"
import { PostMediaEditor } from "@/components/ui/post-media-editor"
import {
  buildEditedVideoUrl,
  isEditableImageFile,
  isVideoFile,
  mediaFileKey,
  videoEditIsNoop,
  type VideoEdit,
} from "@/lib/media-edit"
import {
  Code,
  Eye,
  EyeOff,
  FileText,
  Hash,
  ImageIcon,
  LogIn,
  Mic,
  Music,
  Plus,
  Save,
  SlidersHorizontal,
  Square,
  Upload,
  Video,
  X,
  Vote,
  Swords,
  Zap,
} from "lucide-react"
import ArrowNarrowRightIcon from "@/components/icons/animated/arrow-narrow-right-icon"
import { CreateDuelDialog } from "@/components/duels/create-duel-dialog"
import { CreateClutchDuelDialog } from "@/components/duels/create-clutch-duel-dialog"

const DRAFT_KEY = "loop-composer-draft-v1"

interface CreateLoopButtonProps {
  onLoopCreated?: () => void
  defaultOpen?: boolean
  isFab?: boolean
}

type MediaType = "text" | "image" | "video" | "audio" | "code" | "poll" | "moment"

/**
 * One picked file. The object URL is created once per file instead of on every
 * render (which used to leak a new blob URL on each keystroke in the textarea).
 */
function SelectedMediaTile({
  file,
  trim,
  onEdit,
  onRemove,
}: {
  file: File
  trim?: VideoEdit
  onEdit: () => void
  onRemove: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const video = isVideoFile(file)
  const editable = isEditableImageFile(file) || video
  const trimmed = Boolean(trim && !videoEditIsNoop(trim))

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-muted">
      {video ? (
        <video src={url ?? undefined} muted playsInline preload="metadata" className="h-28 w-full bg-black object-cover" />
      ) : file.type.startsWith("image/") ? (
        <img src={url ?? undefined} alt={file.name} className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 items-center justify-center truncate p-2 text-center text-xs text-muted-foreground">
          {file.name}
        </div>
      )}

      {trimmed ? (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-violet-600/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          Trimmed
        </span>
      ) : null}

      <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {editable ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-violet-600"
          >
            <SlidersHorizontal className="h-3 w-3" />
            Edit
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full bg-black/75 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-rose-600"
          title="Remove file"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function CreateLoopButton({ onLoopCreated, defaultOpen = false, isFab = false }: CreateLoopButtonProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { requireAuth, isGuest, LoginGateDialog } = useLoginGate()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [content, setContent] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<MediaType>("text")
  const [codeLanguage, setCodeLanguage] = useState("javascript")
  const [codeTitle, setCodeTitle] = useState("")
  const [pollQuestion, setPollQuestion] = useState("")
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""])
  const [duelDialogOpen, setDuelDialogOpen] = useState(false)
  const [clutchDuelDialogOpen, setClutchDuelDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [discardOpen, setDiscardOpen] = useState(false)
  // Files queued for the pre-post editor. Images come back re-encoded; videos
  // come back as a trim/mute config that is written into the delivery URL.
  const [editQueue, setEditQueue] = useState<File[]>([])
  const [editIndex, setEditIndex] = useState(0)
  const [videoEdits, setVideoEdits] = useState<Record<string, VideoEdit>>({})
  const editingFile = editQueue[editIndex] ?? null
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [isSpoiler, setIsSpoiler] = useState(false)
  const authToken = user?.access_token || user?.token

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft.content || draft.hashtags) {
        setContent(draft.content || "")
        setHashtags(draft.hashtags || "")
        setMediaType(draft.mediaType || "text")
        if (!defaultOpen && (draft.content || draft.hashtags)) setIsOpen(true)
        toast({ title: "Draft restored", description: "We restored your unfinished loop." })
      }
    } catch {
      // ignore
    }
  }, [defaultOpen, toast])

  useEffect(() => {
    const payload = { content, hashtags, mediaType, updatedAt: Date.now() }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  }, [content, hashtags, mediaType])

  useEffect(() => {
    if (!mediaFiles[0]) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(mediaFiles[0])
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [mediaFiles])

  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const res = await fetch("/api/explore/trending?type=hashtags&limit=8")
        if (!res.ok) return
        const data = await res.json()
        const tags = (data.hashtags || data.data || [])
          .map((item: any) => String(item.tag || item.name || item).replace(/^#/, ""))
          .filter(Boolean)
        setSuggestions(tags)
      } catch {
        setSuggestions(["design", "creativity", "loops", "music", "tech", "art"])
      }
    }
    void loadSuggestions()
  }, [])

  const extractedTags = useMemo(() => {
    const fromField = hashtags.split(/[ ,#]+/).filter(Boolean)
    const fromContent = Array.from(content.matchAll(/#([a-zA-Z0-9_]+)/g)).map((m) => m[1])
    return Array.from(new Set([...fromField, ...fromContent].map((t) => t.toLowerCase())))
  }, [content, hashtags])

  const getMaxFiles = () => (user?.is_premium ? 10 : user?.is_verified ? 4 : 1)

  const clearDraft = () => localStorage.removeItem(DRAFT_KEY)

  /** Move to the next picked file, or leave the editor once the queue is done. */
  const finishEditing = () => {
    if (editIndex + 1 < editQueue.length) setEditIndex(editIndex + 1)
    else {
      setEditQueue([])
      setEditIndex(0)
    }
  }

  const startEditing = (files: File[]) => {
    if (!files.length) return
    setEditQueue(files)
    setEditIndex(0)
  }

  const replaceMediaFile = (original: File, edited: File) => {
    setMediaFiles((prev) =>
      prev.map((file) => (mediaFileKey(file) === mediaFileKey(original) ? edited : file)),
    )
    finishEditing()
  }

  const saveVideoEdit = (original: File, edit: VideoEdit) => {
    setVideoEdits((prev) => ({ ...prev, [mediaFileKey(original)]: edit }))
    finishEditing()
  }

  /** Publish URL for a file: images are already edited; videos get trim/mute. */
  const publishUrl = (file: File, uploadedUrl: string) => {
    if (!isVideoFile(file)) return uploadedUrl
    const edit = videoEdits[mediaFileKey(file)]
    return edit ? buildEditedVideoUrl(uploadedUrl, edit) : uploadedUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireAuth("post")) return
    if (!user || !authToken) return
    setCreating(true)
    try {
      let res: Response
      const tags = extractedTags

      if (mediaType === "moment") {
        // Create Moment post directly
        if (mediaFiles.length > 0) {
          const prepared = mediaFiles[0]
          setUploadStatus("Uploading...")
          const uploaded = await uploadMediaFile(prepared, {
            type: prepared.type.startsWith("video") ? "video" : "image",
            folder: "moments",
            authHeaders: { Authorization: `Bearer ${authToken}`, ...getAuthHeader() },
          })
          setUploadStatus(null)

          res = await fetch("/api/moments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
              ...getAuthHeader(),
            },
            body: JSON.stringify({
              media_url: publishUrl(prepared, uploaded.url),
              media_type: prepared.type.startsWith("video") ? "video" : "image",
              content: content,
              hours: 24,
            }),
          })
        } else {
          res = await fetch("/api/moments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
              ...getAuthHeader(),
            },
            body: JSON.stringify({
              content: content,
              media_type: "text",
              hours: 24,
            }),
          })
        }
      } else if (mediaFiles.length > 0) {
        // Upload every file in parallel straight to Cloudinary (video/large
        // files go direct via a signed upload, bypassing the Next.js API
        // route entirely) instead of bundling all raw files into one
        // multipart POST to /api/loops. That old path uploaded files one at
        // a time on the server via base64, which was slow for multiple
        // files/video and could exceed Vercel's ~4.5MB request body limit —
        // when that happened, Vercel returned a plain-text/HTML error that
        // the old `res.json()` call couldn't parse, surfacing as a generic
        // "JSON error" instead of a real message.
        setUploadStatus(mediaFiles.length > 1 ? `Uploading 0/${mediaFiles.length}...` : "Uploading...")
        let uploadedCount = 0
        const authHeaders = { Authorization: `Bearer ${authToken}`, ...getAuthHeader() }
        const uploadResults = await Promise.all(
          mediaFiles.map(async (file) => {
            const uploaded = await uploadMediaFile(file, {
              type: file.type.startsWith("video")
                ? "video"
                : file.type.startsWith("audio")
                  ? "audio"
                  : file.type.startsWith("image")
                    ? "image"
                    : "file",
              folder: "loops",
              authHeaders,
            })
            uploadedCount += 1
            setUploadStatus(mediaFiles.length > 1 ? `Uploading ${uploadedCount}/${mediaFiles.length}...` : "Uploading...")
            return { ...uploaded, url: publishUrl(file, uploaded.url) }
          }),
        )
        setUploadStatus("Publishing...")

        const firstFile = mediaFiles[0]
        const resolvedMediaType = firstFile.type.startsWith("video")
          ? "video"
          : firstFile.type.startsWith("audio")
            ? "audio"
            : firstFile.type.startsWith("image")
              ? "image"
              : mediaType

        res = await fetch("/api/loops", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            content_text: content,
            content_type: resolvedMediaType,
            hashtags: tags,
            media_url: uploadResults[0]?.url,
            media_urls: uploadResults.map((u) => u.url),
            is_spoiler: isSpoiler,
          }),
        })
      } else {
        res = await fetch("/api/loops", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            content_text: content,
            content_title: mediaType === "code" ? codeTitle.trim() || null : null,
            content_type: mediaType === "poll" ? "poll" : mediaType,
            post_type: mediaType === "poll" ? "poll" : "standard",
            category: mediaType === "code" ? "code" : mediaType === "poll" ? "poll" : "general",
            hashtags: tags,
            is_spoiler: isSpoiler,
            content_metadata:
              mediaType === "code"
                ? {
                    is_code: true,
                    language: codeLanguage,
                    forks_count: 0,
                  }
                : undefined,
          }),
        })
      }

      const { data: result } = await parseJsonResponse<any>(res)
      if (!res.ok) throw new Error(result?.error || res.statusText)

      const loopId = result.loop?.id

      // If poll type, create poll attached to the loop
      if (mediaType === "poll" && loopId && pollQuestion.trim()) {
        const validOptions = pollOptions.filter((o) => o.trim().length > 0)
        if (validOptions.length >= 2) {
          await fetch("/api/polls", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
              ...getAuthHeader(),
            },
            body: JSON.stringify({
              loopId,
              question: pollQuestion,
              options: validOptions,
            }),
          })
        }
      }

      setContent("")
      setHashtags("")
      setMediaFiles([])
      setMediaType("text")
      setCodeTitle("")
      setCodeLanguage("javascript")
      setShowPreview(false)
      setVideoEdits({})
      setIsSpoiler(false)
      setIsOpen(false)
      clearDraft()
      toast({ title: "Loop created", description: "Your loop is live on the feed." })
      window.dispatchEvent(new Event("loop-created"))
      if (onLoopCreated) onLoopCreated()
      else router.refresh()
    } catch (err: any) {
      toast({ title: "Failed to create loop", description: err.message || "Something went wrong", variant: "destructive" })
    } finally {
      setCreating(false)
      setUploadStatus(null)
    }
  }

  const handleSelectedFiles = (selected: File[]) => {
    if (!selected.length) return
    const maxFiles = getMaxFiles()
    const accepted = selected.slice(0, Math.max(0, maxFiles - mediaFiles.length))
    const combined = [...mediaFiles, ...accepted]
    if (accepted.length < selected.length) {
      toast({
        title: "File limit reached",
        description: `Up to ${maxFiles} files allowed ${user?.is_premium ? "(Pro)" : "(Upgrade to Pro for up to 10 files)"}.`,
      })
    }
    setMediaFiles(combined)
    const first = combined[0]
    if (first.type.startsWith("image/")) setMediaType("image")
    else if (first.type.startsWith("video/")) setMediaType("video")
    else if (first.type.startsWith("audio/")) setMediaType("audio")
    else setMediaType("code")

    // Every photo and clip gets its turn in the editor before publishing.
    const editable = accepted.filter((file) => isEditableImageFile(file) || isVideoFile(file))
    startEditing(editable)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSelectedFiles(Array.from(e.target.files || []))
    e.target.value = ""
  }

  const removeFile = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const toggleAudioRecord = async () => {
    if (recording && recorderRef.current) {
      recorderRef.current.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        const file = new File([blob], `loop-voice-${Date.now()}.webm`, { type: "audio/webm" })
        setMediaType("audio")
        setMediaFiles([file])
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setMediaType("audio")
    } catch {
      toast({
        title: "Microphone blocked",
        description: "Allow mic access to record audio loops.",
        variant: "destructive",
      })
    }
  }

  const addSuggestion = (tag: string) => {
    const next = Array.from(new Set([...extractedTags, tag.toLowerCase()]))
    setHashtags(next.join(" "))
  }

  if (!isOpen) {
    if (isFab) {
      return (
        <>
          {LoginGateDialog}
          <button
            type="button"
            onClick={() => {
              if (!requireAuth("post")) return
              setIsOpen(true)
            }}
            className="fixed bottom-20 right-5 z-40 sm:bottom-6 sm:right-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600 text-white shadow-2xl transition-transform hover:scale-105 active:scale-95 border border-white/20 focus:outline-none"
            aria-label="Create Loop"
          >
            <Plus className="h-7 w-7" />
          </button>
        </>
      )
    }

    return (
      <>
        {LoginGateDialog}
        <Card
          className="create-loop-launch cursor-pointer border-white/10 bg-card/45 transition hover:border-violet-300/30 hover:bg-card/70"
          onClick={() => {
            if (!requireAuth("post")) return
            setIsOpen(true)
          }}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <div className="create-loop-launch-mark flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 via-indigo-500 to-cyan-400 shadow-[0_10px_28px_-12px_rgba(124,92,255,0.8)]">
                {isGuest ? <LogIn className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
              </div>
              <div>
                <p className="text-muted-foreground">
                  {isGuest
                    ? "Sign in to post a loop"
                    : `What's on your mind, ${user?.display_name || "friend"}?`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isGuest ? "Browse freely — posting needs an account" : "Drafts auto-save as you type"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      {LoginGateDialog}
    <Card className="create-loop-composer relative overflow-hidden rounded-[28px] border border-white/10 bg-card/55 shadow-[0_34px_100px_-58px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
      <span aria-hidden className="create-loop-composer-topline pointer-events-none absolute inset-x-10 top-0 z-20 h-px" />
      <span aria-hidden className="create-loop-composer-light pointer-events-none absolute inset-0 z-0" />
      <CardContent className="relative z-10 space-y-6 p-4 sm:p-7 lg:p-8">
        <div className="create-loop-composer-head flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-violet-400/25 via-indigo-400/15 to-cyan-300/20 shadow-[0_12px_30px_-14px_rgba(124,92,255,0.8)]">
              <FileText className="h-[18px] w-[18px] text-violet-200" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-semibold tracking-[-0.02em] text-foreground">Create a Loop</h2>
              <p className="truncate text-[11px] text-muted-foreground">
                {mediaType === "code"
                  ? "Share a forkable snippet"
                  : mediaType === "poll"
                    ? "Ask the community"
                    : "Share a story, idea, or moment"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-2 text-[10px] font-medium text-muted-foreground sm:inline-flex">
              <Save className="h-3 w-3" />
              Draft saved
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 rounded-full border-white/10 bg-white/[0.035] px-3.5 text-[11px]"
              onClick={() => setShowPreview((v) => !v)}
              aria-label={showPreview ? "Edit loop" : "Preview loop"}
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">{showPreview ? "Edit" : "Preview"}</span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.035]"
              onClick={() => setDiscardOpen(true)}
              title="Close composer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showPreview ? (
          <div className="create-loop-preview-panel rounded-[22px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
            <p className="mb-3 whitespace-pre-wrap text-foreground">{content || "No text yet"}</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {extractedTags.map((tag) => (
                <Badge key={tag} variant="secondary">#{tag}</Badge>
              ))}
            </div>
            {previewUrl && mediaType === "image" && (
              <img src={previewUrl} alt="preview" className="max-h-72 w-full rounded-xl object-cover" />
            )}
            {previewUrl && mediaType === "video" && <video src={previewUrl} controls className="max-h-72 w-full rounded-xl" />}
            {previewUrl && mediaType === "audio" && <audio src={previewUrl} controls className="w-full" />}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mediaType === "code" ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                  <Input
                    value={codeTitle}
                    onChange={(e) => setCodeTitle(e.target.value)}
                    placeholder="Snippet title (optional)"
                    className="border-border bg-muted"
                    maxLength={80}
                  />
                  <select
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                    className="h-10 rounded-md border border-border bg-muted px-3 text-sm"
                  >
                    {CODE_LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`// Paste your ${codeLanguage} code here…\nfunction hello() {\n  return "Loop";\n}`}
                  className="min-h-[220px] border-border bg-muted font-mono text-sm text-foreground"
                  maxLength={12000}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{content.length}/12000 · others can fork, like, comment, or branch</span>
                  <span className="inline-flex items-center gap-1"><Save className="h-3 w-3" /> Draft saved</span>
                </div>
              </div>
            ) : (
              <>
                {/* Markdown Formatting Quick Toolbar */}
                <div className="create-loop-format-toolbar flex flex-wrap items-center gap-1 rounded-[16px] border border-white/[0.08] bg-white/[0.035] p-1.5 text-xs backdrop-blur-xl sm:flex-nowrap sm:gap-1.5">
                  <span className="mr-1 flex items-center gap-1 px-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground sm:text-[10px]">
                    <Zap className="h-3.5 w-3.5" /> Markdown
                  </span>
                  <button
                    type="button"
                    onClick={() => setContent((prev) => prev + " **bold**")}
                    className="min-h-9 min-w-9 rounded-lg border border-white/[0.08] px-2 font-bold text-foreground transition-colors hover:bg-white/[0.07]"
                    title="Bold (**text**)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => setContent((prev) => prev + " *italic*")}
                    className="min-h-9 min-w-9 rounded-lg border border-white/[0.08] px-2 italic text-foreground transition-colors hover:bg-white/[0.07]"
                    title="Italic (*text*)"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => setContent((prev) => prev + "\n# Heading")}
                    className="min-h-9 min-w-9 rounded-lg border border-white/[0.08] px-2 font-extrabold text-foreground transition-colors hover:bg-white/[0.07]"
                    title="Heading (# text)"
                  >
                    H1
                  </button>
                  <button
                    type="button"
                    onClick={() => setContent((prev) => prev + " ~~strikethrough~~")}
                    className="min-h-9 min-w-9 rounded-lg border border-white/[0.08] px-2 line-through text-foreground transition-colors hover:bg-white/[0.07]"
                    title="Strikethrough (~~text~~)"
                  >
                    S
                  </button>
                  <button
                    type="button"
                    onClick={() => setContent((prev) => prev + "\n> blockquote")}
                    className="min-h-9 min-w-9 rounded-lg border border-white/[0.08] px-2 font-serif text-foreground transition-colors hover:bg-white/[0.07]"
                    title="Blockquote (> text)"
                  >
                    &ldquo;
                  </button>
                  <button
                    type="button"
                    onClick={() => setContent((prev) => prev + " `code`")}
                    className="min-h-9 min-w-10 rounded-lg border border-white/[0.08] px-2 font-mono text-[10px] text-foreground transition-colors hover:bg-white/[0.07]"
                    title="Inline Code (`text`)"
                  >
                    &lt;/&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setContent((prev) => prev + "\n---\n")}
                    className="min-h-9 min-w-9 rounded-lg border border-white/[0.08] px-2 text-foreground transition-colors hover:bg-white/[0.07]"
                    title="Horizontal Divider (---)"
                  >
                    &mdash;
                  </button>
                </div>

                <MentionTextarea
                  value={content}
                  onChange={setContent}
                  placeholder="Share a story, idea, or tag someone with @username… (Markdown supported)"
                  className="create-loop-writing min-h-[168px] border-0 bg-transparent px-0 py-3 text-[15px] leading-7 shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0 sm:min-h-[190px] sm:text-base"
                  maxLength={user?.is_premium ? 10000 : 3000}
                />
                <div className="create-loop-writing-meta flex items-center justify-between gap-3 border-t border-white/[0.07] pt-2 text-[10.5px] text-muted-foreground">
                  <span className={content.trim().split(/\s+/).filter(Boolean).length > (user?.is_premium ? 1800 : 500) ? "font-bold text-rose-400" : ""}>
                    {content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0} / {user?.is_premium ? "1800" : "500"} words
                    {user?.is_premium ? " (Pro Limit)" : " (500 Word Limit)"}
                  </span>
                  <span className="inline-flex items-center gap-1"><Save className="h-3 w-3" /> Draft saved</span>
                </div>
              </>
            )}

            <div className="create-loop-topics space-y-2.5 rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-3.5 sm:p-4">
              <div className="flex items-center gap-2.5">
                <Hash className="h-4 w-4 text-cyan-200" />
                <Input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="design creativity storytelling"
                  className="h-10 rounded-xl border-white/10 bg-white/[0.035] text-sm placeholder:text-muted-foreground/70"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addSuggestion(tag)}
                    className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-violet-300/25 hover:bg-violet-300/[0.07] hover:text-violet-100"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end justify-between gap-3 px-1 pt-1">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">Choose a format</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/75">A different way to tell it</p>
              </div>
              <span className="pb-0.5 text-[9px] text-muted-foreground/75">7 ways to create</span>
            </div>
            <div className="create-loop-type-grid grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-3 2xl:grid-cols-4">
              {[
                { type: "text" as const, icon: FileText, label: "Text" },
                { type: "image" as const, icon: ImageIcon, label: "Image" },
                { type: "video" as const, icon: Video, label: "Video" },
                { type: "audio" as const, icon: Music, label: "Audio" },
                { type: "code" as const, icon: Code, label: "Code" },
                { type: "poll" as const, icon: Vote, label: "Poll" },
                { type: "moment" as const, icon: Zap, label: "Moment" },
              ].map((item) => (
                <Button
                  key={item.type}
                  type="button"
                  size="sm"
                  variant={mediaType === item.type ? "default" : "outline"}
                  className={
                    mediaType === item.type
                      ? "h-11 justify-start rounded-[14px] border-violet-300/25 bg-gradient-to-r from-violet-400/20 to-cyan-300/10 px-3.5 text-[11px] font-semibold text-violet-50 shadow-[0_10px_26px_-18px_rgba(124,92,255,0.9)]"
                      : "h-11 justify-start rounded-[14px] border-white/[0.08] bg-white/[0.025] px-3.5 text-[11px] font-medium text-muted-foreground hover:border-white/15 hover:bg-white/[0.05] hover:text-foreground"
                  }
                  onClick={() => setMediaType(item.type)}
                >
                  <item.icon className="mr-1.5 h-3.5 w-3.5" />
                  {item.label}
                </Button>
              ))}

            </div>

            <div className="create-loop-featured-grid grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-[68px] justify-start gap-3 rounded-[16px] border-amber-300/20 bg-gradient-to-br from-amber-300/[0.09] to-orange-400/[0.025] px-3.5 py-3 text-left text-foreground shadow-[0_12px_28px_-24px_rgba(245,185,66,0.6)] transition-all hover:border-amber-300/35 hover:from-amber-300/[0.14] hover:to-orange-400/[0.05]"
                onClick={() => setDuelDialogOpen(true)}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-200"><Swords className="h-4 w-4" /></span>
                <span className="flex min-w-0 flex-col items-start gap-0.5"><span className="text-[11px] font-semibold">Duel</span><span className="text-[9px] font-normal text-muted-foreground">Go head-to-head</span></span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-[68px] justify-start gap-3 rounded-[16px] border-indigo-300/20 bg-gradient-to-br from-indigo-400/[0.1] to-cyan-300/[0.025] px-3.5 py-3 text-left text-foreground shadow-[0_12px_28px_-24px_rgba(99,102,241,0.65)] transition-all hover:border-indigo-300/35 hover:from-indigo-400/[0.15] hover:to-cyan-300/[0.05]"
                onClick={() => setClutchDuelDialogOpen(true)}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-300/25 bg-indigo-300/10 text-indigo-200"><Zap className="h-4 w-4" /></span>
                <span className="flex min-w-0 flex-col items-start gap-0.5"><span className="text-[11px] font-semibold">Clutch</span><span className="text-[9px] font-normal text-muted-foreground">High-stakes round</span></span>
              </Button>
            </div>

            {mediaType === "poll" && (
              <div className="space-y-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-cyan-700 dark:text-cyan-300">Poll Question</label>
                  <Input
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="e.g. What is your favorite state management solution?"
                    className="bg-muted border-border text-foreground rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Poll Options (2 to 4)</label>
                  {pollOptions.map((opt, idx) => (
                    <Input
                      key={idx}
                      value={opt}
                      onChange={(e) => {
                        const copy = [...pollOptions]
                        copy[idx] = e.target.value
                        setPollOptions(copy)
                      }}
                      placeholder={`Option ${idx + 1}`}
                      className="bg-muted border-border text-foreground rounded-xl text-xs"
                    />
                  ))}
                  {pollOptions.length < 4 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPollOptions([...pollOptions, ""])}
                      className="text-xs text-cyan-400 hover:text-cyan-300 p-0 h-auto"
                    >
                      + Add Option
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {mediaType === "code" ? (
                <p className="rounded-[18px] border border-white/[0.08] bg-white/[0.025] p-5 text-center text-[13px] leading-6 text-muted-foreground">
                  Code loops publish as text snippets — no media upload needed. Peers can fork your code into their profile.
                </p>
              ) : (
                <>
                  <MagneticDropZone onFiles={handleSelectedFiles}>
                    <label className="create-loop-dropzone group relative flex min-h-[148px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-white/15 bg-white/[0.025] p-6 text-center transition-colors hover:border-violet-300/40 hover:bg-violet-300/[0.035]">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-300/15 to-cyan-300/10 shadow-[0_12px_30px_-16px_rgba(124,92,255,0.8)] transition-colors group-hover:border-violet-300/40">
                        <Upload className="h-4 w-4 text-violet-400" />
                      </span>
                      <span className="text-[13px] font-semibold text-foreground">
                        Drop media or click to upload
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Photos and clips open the editor before they post · up to {getMaxFiles()} file
                        {getMaxFiles() > 1 ? "s" : ""}
                        {user?.is_premium ? " · Pro" : ""}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,audio/*"
                        multiple={getMaxFiles() > 1}
                        onChange={handleFileChange}
                      />
                    </label>
                  </MagneticDropZone>
                  {(mediaType === "audio" || mediaType === "text") && (
                    <div className="mt-3 flex justify-center">
                      <Button
                        type="button"
                        size="sm"
                        variant={recording ? "destructive" : "outline"}
                        className="border-border"
                        onClick={toggleAudioRecord}
                      >
                        {recording ? <Square className="mr-1.5 h-3.5 w-3.5" /> : <Mic className="mr-1.5 h-3.5 w-3.5" />}
                        {recording ? "Stop recording" : "Record audio"}
                      </Button>
                    </div>
                  )}
                  {mediaFiles.length > 0 && (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {mediaFiles.length} of {getMaxFiles()} selected
                          <span className="ml-1.5 text-muted-foreground/70">· hover a tile to edit</span>
                        </span>
                        {mediaFiles.length < getMaxFiles() && (
                          <label className="cursor-pointer text-violet-300 font-semibold hover:text-cyan-200 hover:underline">
                            + Add more files
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,video/*,audio/*"
                              multiple={getMaxFiles() > 1}
                              onChange={handleFileChange}
                            />
                          </label>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {mediaFiles.map((file, idx) => (
                          <SelectedMediaTile
                            key={`${mediaFileKey(file)}-${idx}`}
                            file={file}
                            trim={videoEdits[mediaFileKey(file)]}
                            onEdit={() => startEditing([file])}
                            onRemove={() => removeFile(idx)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {(mediaType === "image" || mediaType === "video" || mediaType === "audio") && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setIsSpoiler((v) => !v)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg border transition-all",
                    isSpoiler
                      ? "border-amber-500/60 bg-amber-500/20 text-amber-400"
                      : "border-border bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </button>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Mark as Spoiler</p>
                  <p className="text-[10px] text-muted-foreground">Media will be blurred until tapped</p>
                </div>
              </div>
            )}

            <div className="create-loop-submit-row flex flex-col-reverse items-stretch justify-end gap-2.5 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center">
              <span className="hidden flex-1 items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                <Zap className="h-3 w-3 text-violet-400" />
                Drafts save automatically — nothing gets lost while you write.
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-11 rounded-full border-white/10 bg-white/[0.025] px-5 text-[11px] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground" onClick={() => setDiscardOpen(true)}>
                  Cancel
                </Button>
                <DynamicButton
                  type="submit"
                  feedback="press"
                  stateKey={creating ? uploadStatus || "publishing" : "create"}
                  icon={creating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <ArrowNarrowRightIcon size={16} /> }
                  disabled={creating || (!content.trim() && mediaFiles.length === 0)}
                  className="create-loop-submit h-11 rounded-full border-0 bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-300 px-5 text-[11.5px] font-semibold text-[#090813] shadow-[0_14px_34px_-12px_rgba(124,92,255,0.75)] hover:brightness-105"
                >
                  {creating ? uploadStatus || "Publishing..." : "Create Loop"}
                </DynamicButton>
              </div>
            </div>
          </form>
        )}
      </CardContent>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Close composer?"
        description="Your draft stays saved locally until you publish or clear it."
        confirmLabel="Close"
        onConfirm={() => {
          setIsOpen(false)
          setDiscardOpen(false)
        }}
      />

      <CreateDuelDialog
        open={duelDialogOpen}
        onOpenChange={setDuelDialogOpen}
        onDuelCreated={() => {
          if (onLoopCreated) onLoopCreated()
          else router.refresh()
        }}
      />

      <CreateClutchDuelDialog
        open={clutchDuelDialogOpen}
        onOpenChange={setClutchDuelDialogOpen}
        onDuelCreated={() => {
          if (onLoopCreated) onLoopCreated()
          else router.refresh()
        }}
      />

      <PostMediaEditor
        file={editingFile}
        open={Boolean(editingFile)}
        initialVideoEdit={editingFile ? videoEdits[mediaFileKey(editingFile)] : null}
        onClose={finishEditing}
        onApplyImage={(edited, original) => replaceMediaFile(original, edited)}
        onApplyVideo={(edit, original) => saveVideoEdit(original, edit)}
      />
    </Card>
    </>
  )
}
