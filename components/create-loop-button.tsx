"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { supabase } from "@/lib/supabase"
import { CODE_LANGUAGES } from "@/lib/pro-features"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { useLoginGate } from "@/hooks/use-login-gate"
import {
  Code,
  Crop,
  Eye,
  FileText,
  Hash,
  ImageIcon,
  LogIn,
  Mic,
  Music,
  Plus,
  Save,
  Square,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react"

const DRAFT_KEY = "loop-composer-draft-v1"

interface CreateLoopButtonProps {
  onLoopCreated?: () => void
  defaultOpen?: boolean
}

type MediaType = "text" | "image" | "video" | "audio" | "code"

function makeCollabId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function CreateLoopButton({ onLoopCreated, defaultOpen = false }: CreateLoopButtonProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { requireAuth, isGuest, LoginGateDialog } = useLoginGate()
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [content, setContent] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<MediaType>("text")
  const [codeLanguage, setCodeLanguage] = useState("javascript")
  const [codeTitle, setCodeTitle] = useState("")
  const [creating, setCreating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [cropScale, setCropScale] = useState(1)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [collabEnabled, setCollabEnabled] = useState(false)
  const [collabId, setCollabId] = useState<string | null>(null)
  const [collabPeers, setCollabPeers] = useState<string[]>([])
  const [joinCode, setJoinCode] = useState("")
  const applyingRemote = useRef(false)
  const collabChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
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
        if (draft.collabId) {
          setCollabId(draft.collabId)
          setCollabEnabled(true)
        }
        if (!defaultOpen && (draft.content || draft.hashtags)) setIsOpen(true)
        toast({ title: "Draft restored", description: "We restored your unfinished loop." })
      }
    } catch {
      // ignore
    }
  }, [defaultOpen, toast])

  useEffect(() => {
    const payload = { content, hashtags, mediaType, collabId, updatedAt: Date.now() }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  }, [content, hashtags, mediaType, collabId])

  // Realtime collaboration room for shared loop drafting
  useEffect(() => {
    if (!collabEnabled || !collabId || !user) return

    const channel = supabase.channel(`loop-draft:${collabId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: user.id },
      },
    })
    collabChannelRef.current = channel

    channel
      .on("broadcast", { event: "draft:update" }, ({ payload }) => {
        if (!payload || payload.user?.id === user.id) return
        applyingRemote.current = true
        if (typeof payload.content === "string") setContent(payload.content)
        if (typeof payload.hashtags === "string") setHashtags(payload.hashtags)
        if (payload.mediaType) setMediaType(payload.mediaType)
        queueMicrotask(() => {
          applyingRemote.current = false
        })
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const names = Object.values(state)
          .flat()
          .map((peer: any) => peer.username || peer.display_name || "collaborator")
        setCollabPeers(Array.from(new Set(names)))
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            username: user.username,
            display_name: user.display_name,
          })
        }
      })

    return () => {
      collabChannelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [collabEnabled, collabId, user?.id])

  useEffect(() => {
    if (!collabEnabled || !collabId || !user || applyingRemote.current) return
    const timer = setTimeout(() => {
      void collabChannelRef.current?.send({
        type: "broadcast",
        event: "draft:update",
        payload: {
          content,
          hashtags,
          mediaType,
          user: { id: user.id, username: user.username },
        },
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [content, hashtags, mediaType, collabEnabled, collabId, user?.id])

  const startCollab = () => {
    const id = makeCollabId()
    setCollabId(id)
    setCollabEnabled(true)
    toast({
      title: "Collab room ready",
      description: `Share code ${id.slice(0, 8)}… with collaborators`,
    })
  }

  const joinCollab = () => {
    const id = joinCode.trim()
    if (!id) return
    setCollabId(id)
    setCollabEnabled(true)
    toast({ title: "Joined collab room", description: "Edits sync in realtime." })
  }

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

  const getMaxFiles = () => (user?.is_premium || user?.is_verified ? 4 : 1)

  const clearDraft = () => localStorage.removeItem(DRAFT_KEY)

  const applyCropToImage = async (file: File) => {
    if (!file.type.startsWith("image/") || cropScale === 1) return file
    const img = document.createElement("img")
    const objectUrl = URL.createObjectURL(file)
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("Could not load image"))
      img.src = objectUrl
    })
    const canvas = canvasRef.current || document.createElement("canvas")
    const size = Math.min(img.width, img.height) / cropScale
    const sx = (img.width - size) / 2
    const sy = (img.height - size) / 2
    canvas.width = Math.min(1080, size)
    canvas.height = Math.min(1080, size)
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(img, sx, sy, size, size, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(objectUrl)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireAuth("post")) return
    if (!user || !authToken) return
    setCreating(true)
    try {
      let res: Response
      const tags = extractedTags

      if (mediaFiles.length > 0) {
        const formData = new FormData()
        formData.append("content_text", content)
        formData.append("content_title", content.slice(0, 80) || "")
        formData.append("content_type", mediaType)
        formData.append("hashtags", JSON.stringify(tags))
        const prepared = await applyCropToImage(mediaFiles[0])
        formData.append("media", prepared)
        res = await fetch("/api/loops", {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}`, ...getAuthHeader() },
          body: formData,
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
            content_title:
              mediaType === "code"
                ? codeTitle.trim() || content.split("\n")[0]?.slice(0, 80) || "Code loop"
                : content.slice(0, 80) || null,
            content_type: mediaType,
            category: mediaType === "code" ? "code" : "general",
            hashtags: tags,
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

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || res.statusText)

      setContent("")
      setHashtags("")
      setMediaFiles([])
      setMediaType("text")
      setCodeTitle("")
      setCodeLanguage("javascript")
      setShowPreview(false)
      setCropScale(1)
      setIsOpen(false)
      clearDraft()
      toast({ title: "Loop created", description: "Your loop is live on the feed." })
      if (onLoopCreated) onLoopCreated()
      else window.location.reload()
    } catch (err: any) {
      toast({ title: "Failed to create loop", description: err.message || "Something went wrong", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const maxFiles = getMaxFiles()
    if (files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `You can upload up to ${maxFiles} file${maxFiles > 1 ? "s" : ""}.`,
        variant: "destructive",
      })
      return
    }
    if (!files.length) return
    setMediaFiles(files)
    const first = files[0]
    if (first.type.startsWith("image/")) setMediaType("image")
    else if (first.type.startsWith("video/")) setMediaType("video")
    else if (first.type.startsWith("audio/")) setMediaType("audio")
    else setMediaType("code")
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
    return (
      <>
        {LoginGateDialog}
        <Card
          className="cursor-pointer border-border/70 bg-card/60 transition hover:bg-muted/40"
          onClick={() => {
            if (!requireAuth("post")) return
            setIsOpen(true)
          }}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-sky-600 to-violet-600">
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
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Create Loop</h3>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowPreview((v) => !v)}>
              <Eye className="mr-1 h-4 w-4" /> {showPreview ? "Edit" : "Preview"}
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => setDiscardOpen(true)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Users className="h-4 w-4 text-cyan-500" />
            <p className="text-sm font-medium">Realtime collab</p>
            {collabEnabled && collabId && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {collabId.slice(0, 8)}
              </Badge>
            )}
          </div>
          {!collabEnabled ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" size="sm" className="rounded-full" onClick={startCollab}>
                Start collab room
              </Button>
              <div className="flex flex-1 gap-2">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Paste collab code"
                  className="h-9"
                />
                <Button type="button" size="sm" variant="outline" onClick={joinCollab}>
                  Join
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Live with {Math.max(collabPeers.length, 1)} collaborator
              {collabPeers.length === 1 ? "" : "s"}
              {collabPeers.length ? `: ${collabPeers.join(", ")}` : ""}. Share the full code{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  void navigator.clipboard.writeText(collabId || "")
                  toast({ title: "Collab code copied" })
                }}
              >
                copy code
              </button>
              .
            </p>
          )}
        </div>

        {showPreview ? (
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
            <p className="mb-3 whitespace-pre-wrap text-foreground">{content || "No text yet"}</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {extractedTags.map((tag) => (
                <Badge key={tag} variant="secondary">#{tag}</Badge>
              ))}
            </div>
            {previewUrl && mediaType === "image" && (
              <img src={previewUrl} alt="preview" className="max-h-72 w-full rounded-xl object-cover" style={{ transform: `scale(${cropScale})` }} />
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
                    className="border-white/10 bg-white/5"
                    maxLength={80}
                  />
                  <select
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                    className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm"
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
                  className="min-h-[220px] border-white/10 bg-[#0b1220] font-mono text-sm text-slate-100"
                  maxLength={12000}
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{content.length}/12000 · others can fork, like, comment, or branch</span>
                  <span className="inline-flex items-center gap-1"><Save className="h-3 w-3" /> Draft saved</span>
                </div>
              </div>
            ) : (
              <>
                <MentionTextarea
                  value={content}
                  onChange={setContent}
                  placeholder="Share a story, idea, or tag someone with @username…"
                  className="min-h-[120px] border-white/10 bg-white/5"
                  maxLength={500}
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{content.length}/500 · type @ to tag people</span>
                  <span className="inline-flex items-center gap-1"><Save className="h-3 w-3" /> Draft saved</span>
                </div>
              </>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-cyan-300" />
                <Input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="design creativity storytelling"
                  className="border-white/10 bg-white/5"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addSuggestion(tag)}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { type: "text" as const, icon: FileText },
                { type: "image" as const, icon: ImageIcon },
                { type: "video" as const, icon: Video },
                { type: "audio" as const, icon: Music },
                { type: "code" as const, icon: Code },
              ].map((item) => (
                <Button
                  key={item.type}
                  type="button"
                  size="sm"
                  variant={mediaType === item.type ? "default" : "outline"}
                  className="border-white/10"
                  onClick={() => setMediaType(item.type)}
                >
                  <item.icon className="mr-1 h-4 w-4" />
                  {item.type}
                </Button>
              ))}
            </div>

            <div className="rounded-xl border border-dashed border-white/15 p-4">
              {mediaType === "code" ? (
                <p className="text-center text-sm text-slate-400">
                  Code loops publish as text snippets — no media upload needed. Peers can fork your code into their profile.
                </p>
              ) : (
                <>
                  <label className="flex cursor-pointer flex-col items-center gap-2 text-sm text-slate-400">
                    <Upload className="h-5 w-5" />
                    <span>Upload media ({getMaxFiles()} file limit{user?.is_premium ? " · Pro" : ""})</span>
                    <input type="file" className="hidden" accept="image/*,video/*,audio/*" onChange={handleFileChange} />
                  </label>
                  {(mediaType === "audio" || mediaType === "text") && (
                    <div className="mt-3 flex justify-center">
                      <Button
                        type="button"
                        size="sm"
                        variant={recording ? "destructive" : "outline"}
                        className="border-white/10"
                        onClick={toggleAudioRecord}
                      >
                        {recording ? <Square className="mr-1.5 h-3.5 w-3.5" /> : <Mic className="mr-1.5 h-3.5 w-3.5" />}
                        {recording ? "Stop recording" : "Record audio"}
                      </Button>
                    </div>
                  )}
                  {mediaFiles[0] && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-slate-400">{mediaFiles[0].name}</p>
                      {mediaType === "audio" && previewUrl && <audio src={previewUrl} controls className="w-full" />}
                      {mediaType === "image" && previewUrl && (
                        <div className="space-y-2">
                          <div className="overflow-hidden rounded-xl">
                            <img src={previewUrl} alt="" className="mx-auto max-h-56 object-cover" style={{ transform: `scale(${cropScale})` }} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Crop className="h-3.5 w-3.5" />
                            <span>Crop zoom</span>
                            <input
                              type="range"
                              min={1}
                              max={2.5}
                              step={0.05}
                              value={cropScale}
                              onChange={(e) => setCropScale(Number(e.target.value))}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="border-white/10" onClick={() => setDiscardOpen(true)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || (!content.trim() && mediaFiles.length === 0)} className="bg-gradient-to-r from-violet-600 to-cyan-500">
                {creating ? "Publishing..." : "Create Loop"}
              </Button>
            </div>
          </form>
        )}
        <canvas ref={canvasRef} className="hidden" />
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
    </Card>
    </>
  )
}
