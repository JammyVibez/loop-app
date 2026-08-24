"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import {
  Camera, Upload, X, Play, Pause, SkipBack, SkipForward,
  Type, Palette, Zap, Scissors, Smile, Music, ChevronLeft,
  ChevronRight, Check, Loader2, RotateCcw, Maximize2, Minimize2,
  Circle, Square, Video, Image as ImageIcon, Sliders, Sparkles,
  Volume2, VolumeX, Download
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useLoginGate } from "@/hooks/use-login-gate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { parseJsonResponse } from "@/lib/parse-json-response"
import { cn } from "@/lib/utils"

const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_PHOTO_BYTES = 10 * 1024 * 1024

// ─── Filter presets ────────────────────────────────────────────────
const FILTERS = [
  { id: "none", name: "Original", css: "" },
  { id: "warm", name: "Warm", css: "sepia(0.3) saturate(1.4) brightness(1.05)" },
  { id: "cool", name: "Cool", css: "saturate(0.9) hue-rotate(20deg) brightness(1.05)" },
  { id: "vintage", name: "Vintage", css: "sepia(0.5) contrast(1.1) brightness(0.95)" },
  { id: "bw", name: "B&W", css: "grayscale(1) contrast(1.2)" },
  { id: "vivid", name: "Vivid", css: "saturate(1.8) contrast(1.1)" },
  { id: "film", name: "Film", css: "sepia(0.2) contrast(1.15) saturate(1.2) brightness(0.95)" },
  { id: "noir", name: "Noir", css: "grayscale(1) contrast(1.4) brightness(0.85)" },
  { id: "dreamy", name: "Dreamy", css: "brightness(1.1) saturate(1.3) blur(0.3px)" },
  { id: "sunset", name: "Sunset", css: "sepia(0.35) saturate(1.5) hue-rotate(-10deg)" },
  { id: "ocean", name: "Ocean", css: "saturate(1.2) hue-rotate(180deg) brightness(1.05)" },
  { id: "forest", name: "Forest", css: "saturate(1.3) hue-rotate(60deg) brightness(1.02)" },
]

// ─── Speed presets ────────────────────────────────────────────────
const SPEEDS = [
  { value: 0.25, label: "0.25×" },
  { value: 0.5, label: "0.5×" },
  { value: 0.75, label: "0.75×" },
  { value: 1, label: "1×" },
  { value: 1.5, label: "1.5×" },
  { value: 2, label: "2×" },
  { value: 3, label: "3×" },
]

// ─── Sticker packs ────────────────────────────────────────────────
const STICKERS = [
  "😀","😍","🔥","💯","✨","🎉","❤️","👀","💀","🤣",
  "😎","🙌","💪","🌟","🎶","🎬","🏆","💡","🚀","⭐",
  "🌈","🦋","🌊","🎨","📱","💻","🎵","📸","🔮","🎭",
  "👑","💎","🎯","⚡","🍀","🌸","❄️","☀️","🌙","💫",
]

// ─── Font options ─────────────────────────────────────────────────
const FONTS = [
  { name: "Sans", family: "system-ui, sans-serif" },
  { name: "Serif", family: "Georgia, serif" },
  { name: "Mono", family: "monospace" },
  { name: "Cursive", family: "cursive" },
]

// ─── Text style presets ───────────────────────────────────────────
const TEXT_STYLES = [
  { name: "Plain", color: "#ffffff", stroke: "", bg: "" },
  { name: "Bold White", color: "#ffffff", stroke: "#000000", bg: "" },
  { name: "Neon", color: "#00ff88", stroke: "#003322", bg: "" },
  { name: "Fire", color: "#ff4400", stroke: "#220000", bg: "" },
  { name: "Ice", color: "#00ccff", stroke: "#002244", bg: "" },
  { name: "Gold", color: "#ffd700", stroke: "#443300", bg: "" },
  { name: "Pink Pop", color: "#ff69b4", stroke: "#440022", bg: "" },
  { name: "Shadow Box", color: "#ffffff", stroke: "", bg: "rgba(0,0,0,0.6)" },
]

// ─── Types ────────────────────────────────────────────────────────
interface TextOverlay {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  font: string
  color: string
  stroke: string
  bg: string
  startTime: number
  endTime: number
}

interface StickerOverlay {
  id: string
  emoji: string
  x: number
  y: number
  size: number
  startTime: number
  endTime: number
}

interface ReelEditorProps {
  onReelCreated?: (reelId: string | null) => void
}

type EditMode = "trim" | "text" | "filters" | "speed" | "stickers" | "music" | "none"

// ─── Helper to generate IDs ───────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10)

// ─── Main Component ───────────────────────────────────────────────
export function ReelEditor({ onReelCreated }: ReelEditorProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { requireAuth, isGuest, LoginGateDialog } = useLoginGate()

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const previewAnimRef = useRef<number>(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Source state
  const [source, setSource] = useState<"file" | "camera" | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [isPaused, setIsPaused] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)

  // Edit state
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [filter, setFilter] = useState(FILTERS[0])
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([])
  const [stickerOverlays, setStickerOverlays] = useState<StickerOverlay[]>([])
  const [editMode, setEditMode] = useState<EditMode>("none")
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  // Text editor state
  const [newText, setNewText] = useState("")
  const [newFont, setNewFont] = useState(FONTS[0].family)
  const [newTextStyle, setNewTextStyle] = useState(TEXT_STYLES[0])
  const [newFontSize, setNewFontSize] = useState(36)

  // Sticker editor state
  const [selectedSticker, setSelectedSticker] = useState("🔥")

  // Publish state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadLabel, setUploadLabel] = useState<string | null>(null)
  const [showPublish, setShowPublish] = useState(false)

  // ─── Camera capture ──────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setIsPaused(false)
      }
      setSource("camera")
    } catch {
      toast({ title: "Camera access denied", description: "Please allow camera access to record.", variant: "destructive" })
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const recordFromCamera = () => {
    if (!streamRef.current) return
    chunksRef.current = []
    const mr = new MediaRecorder(streamRef.current, { mimeType: "video/webm" })
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" })
      const file = new File([blob], "camera-reel.webm", { type: "video/webm" })
      loadVideoFile(file)
      stopCamera()
    }
    mediaRecorderRef.current = mr
    mr.start()
    // Auto-stop after 60s
    setTimeout(() => { if (mr.state === "recording") mr.stop() }, 60000)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
  }

  // ─── File loading ────────────────────────────────────────────────
  const loadVideoFile = (file: File) => {
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      toast({ title: "Unsupported file", description: "Please select a video or photo.", variant: "destructive" })
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast({ title: "File too large", description: `Max size is ${MAX_VIDEO_BYTES / 1024 / 1024}MB.`, variant: "destructive" })
      return
    }
    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setSource("file")
    setTrimStart(0)
    setTrimEnd(1)
    setSpeed(1)
    setFilter(FILTERS[0])
    setTextOverlays([])
    setStickerOverlays([])
    setShowPublish(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) loadVideoFile(file)
  }

  // ─── Video playback control ──────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setIsPaused(false) }
    else { v.pause(); setIsPaused(true) }
  }

  const seek = (fraction: number) => {
    const v = videoRef.current
    if (!v || !v.duration) return
    v.currentTime = fraction * v.duration
    setCurrentTime(fraction * v.duration)
  }

  const seekRelative = (delta: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta))
  }

  // ─── Video time tracking ─────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => {
      setCurrentTime(v.currentTime)
      // Enforce trim bounds during playback
      const dur = v.duration || 1
      if (v.currentTime >= trimEnd * dur && !v.paused) {
        v.currentTime = trimStart * dur
      }
    }
    const onLoaded = () => {
      setVideoDuration(v.duration)
      setTrimEnd(1)
      setTrimStart(0)
    }
    v.addEventListener("timeupdate", onTime)
    v.addEventListener("loadedmetadata", onLoaded)
    return () => { v.removeEventListener("timeupdate", onTime); v.removeEventListener("loadedmetadata", onLoaded) }
  }, [trimStart, trimEnd])

  // ─── Canvas preview rendering ────────────────────────────────────
  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || video.readyState < 2) {
      previewAnimRef.current = requestAnimationFrame(renderPreview)
      return
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = video.videoWidth || 360
    canvas.height = video.videoHeight || 640

    // Apply filter
    ctx.filter = filter.css || "none"
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    ctx.filter = "none"

    // Draw text overlays
    const dur = video.duration || 1
    for (const t of textOverlays) {
      if (video.currentTime >= t.startTime && video.currentTime <= t.endTime) {
        ctx.save()
        const x = t.x * canvas.width
        const y = t.y * canvas.height
        ctx.font = `bold ${t.fontSize}px ${t.font}`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        if (t.bg) {
          ctx.fillStyle = t.bg
          const m = ctx.measureText(t.text)
          const pad = 8
          ctx.fillRect(x - m.width / 2 - pad, y - t.fontSize / 2 - pad, m.width + pad * 2, t.fontSize + pad * 2)
        }
        if (t.stroke) {
          ctx.strokeStyle = t.stroke
          ctx.lineWidth = 3
          ctx.strokeText(t.text, x, y)
        }
        ctx.fillStyle = t.color
        ctx.fillText(t.text, x, y)
        ctx.restore()
      }
    }

    // Draw stickers
    for (const s of stickerOverlays) {
      if (video.currentTime >= s.startTime && video.currentTime <= s.endTime) {
        ctx.font = `${s.size}px serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(s.emoji, s.x * canvas.width, s.y * canvas.height)
      }
    }

    previewAnimRef.current = requestAnimationFrame(renderPreview)
  }, [filter, textOverlays, stickerOverlays])

  useEffect(() => {
    if (videoUrl) {
      previewAnimRef.current = requestAnimationFrame(renderPreview)
    }
    return () => cancelAnimationFrame(previewAnimRef.current)
  }, [videoUrl, renderPreview])

  // ─── Add text overlay ────────────────────────────────────────────
  const addText = () => {
    if (!newText.trim()) return
    const v = videoRef.current
    const dur = v?.duration || 10
    setTextOverlays((prev) => [
      ...prev,
      {
        id: uid(),
        text: newText.trim(),
        x: 0.5,
        y: 0.5,
        fontSize: newFontSize,
        font: newFont,
        color: newTextStyle.color,
        stroke: newTextStyle.stroke,
        bg: newTextStyle.bg,
        startTime: Math.max(0, currentTime - 1),
        endTime: Math.min(dur, currentTime + 3),
      },
    ])
    setNewText("")
  }

  const removeText = (id: string) => setTextOverlays((prev) => prev.filter((t) => t.id !== id))

  // ─── Add sticker ─────────────────────────────────────────────────
  const addSticker = () => {
    const v = videoRef.current
    const dur = v?.duration || 10
    setStickerOverlays((prev) => [
      ...prev,
      {
        id: uid(),
        emoji: selectedSticker,
        x: 0.3 + Math.random() * 0.4,
        y: 0.3 + Math.random() * 0.4,
        size: 48,
        startTime: Math.max(0, currentTime - 0.5),
        endTime: Math.min(dur, currentTime + 2),
      },
    ])
  }

  const removeSticker = (id: string) => setStickerOverlays((prev) => prev.filter((s) => s.id !== id))

  // ─── Publish ─────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!requireAuth("post")) return
    if (!videoFile) {
      toast({ title: "Add media", description: "Record or upload a video first.", variant: "destructive" })
      return
    }
    if (!title.trim()) {
      toast({ title: "Title required", description: "Give your reel a title.", variant: "destructive" })
      return
    }

    setUploading(true)
    try {
      setUploadLabel("Uploading video…")
      const uploaded = await uploadMediaFile(videoFile, {
        type: "video",
        folder: "reels",
        authHeaders: getAuthHeader(),
      })

      setUploadLabel("Publishing reel…")
      const tags = hashtags.split(/[ ,#]+/).map((t) => t.trim().toLowerCase()).filter(Boolean)

      const reelRes = await fetch("/api/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          content_type: "video",
          content_url: uploaded.url,
          thumbnail_url: null,
          duration: uploaded.duration || Math.round(videoDuration),
          hashtags: tags,
        }),
      })
      const { data: reelData } = await parseJsonResponse<any>(reelRes)
      if (!reelRes.ok) throw new Error(reelData?.error || "Failed to publish")

      toast({ title: "Reel published! 🎬", description: "Your reel is live in the feed." })
      resetAll()
      onReelCreated?.(reelData?.data?.reel?.id || null)
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message || "Something went wrong", variant: "destructive" })
    } finally {
      setUploading(false)
      setUploadLabel(null)
    }
  }

  const resetAll = () => {
    setVideoFile(null)
    setVideoUrl(null)
    setSource(null)
    setTitle("")
    setDescription("")
    setHashtags("")
    setTextOverlays([])
    setStickerOverlays([])
    setFilter(FILTERS[0])
    setSpeed(1)
    setTrimStart(0)
    setTrimEnd(1)
    setShowPublish(false)
    setEditMode("none")
  }

  // ─── Cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera()
      if (videoUrl) URL.revokeObjectURL(videoUrl)
      cancelAnimationFrame(previewAnimRef.current)
    }
  }, [videoUrl])

  // ─── Progress bar ────────────────────────────────────────────────
  const progress = videoDuration > 0 ? currentTime / videoDuration : 0
  const trimDuration = videoDuration * (trimEnd - trimStart)

  // ─── Guest guard ─────────────────────────────────────────────────
  if (isGuest) {
    return (
      <>
        {LoginGateDialog}
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Video className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">Sign in to create a Reel</p>
          <Button className="mt-4 rounded-full" onClick={() => requireAuth("post")}>Sign in</Button>
        </div>
      </>
    )
  }

  // ═════════════════════════════════════════════════════════════════
  // SOURCE SELECTION (no video loaded yet)
  // ═════════════════════════════════════════════════════════════════
  if (!videoUrl) {
    return (
      <>
        {LoginGateDialog}
        <div className="space-y-4">
          {/* Camera capture */}
          <button
            onClick={startCamera}
            className="flex w-full items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-6 text-left transition-all hover:border-violet-500/30 hover:bg-violet-500/10"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500">
              <Camera className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Record Video</p>
              <p className="text-sm text-muted-foreground">Use your camera to record a reel</p>
            </div>
          </button>

          {/* File upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6 text-left transition-all hover:border-amber-500/30 hover:bg-amber-500/10"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-orange-500">
              <Upload className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Upload Video</p>
              <p className="text-sm text-muted-foreground">MP4, WebM, or MOV — up to 50MB</p>
            </div>
            <input ref={fileInputRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleFileUpload} />
          </button>

          {/* Photo to Reel */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex w-full items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-6 text-left transition-all hover:border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500">
              <ImageIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Photo to Reel</p>
              <p className="text-sm text-muted-foreground">Turn a photo into a reel with effects</p>
            </div>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
          </button>
        </div>
      </>
    )
  }

  // ═════════════════════════════════════════════════════════════════
  // EDITOR (video loaded)
  // ═════════════════════════════════════════════════════════════════
  return (
    <>
      {LoginGateDialog}
      <div className="space-y-3">
        {/* ── Top bar ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={resetAll} className="gap-1">
            <RotateCcw className="h-4 w-4" /> Start over
          </Button>
          <span className="text-xs text-muted-foreground">
            {trimDuration.toFixed(1)}s · {speed !== 1 ? `${speed}×` : "Normal"}
          </span>
          <Button
            size="sm"
            onClick={() => setShowPublish(!showPublish)}
            className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-4 font-bold"
          >
            {showPublish ? "Back to Edit" : "Next"}
          </Button>
        </div>

        {/* ── Preview canvas ───────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
          <video
            ref={videoRef}
            src={videoUrl}
            className="hidden"
            crossOrigin="anonymous"
            playsInline
            muted={isMuted}
            loop
          />
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ filter: filter.css || undefined, aspectRatio: "9/16", maxHeight: "60vh" }}
          />

          {/* Play/Pause overlay */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            {isPaused && (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                <Play className="h-8 w-8 text-white fill-white" />
              </div>
            )}
          </button>

          {/* Speed indicator */}
          {speed !== 1 && (
            <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {speed}×
            </div>
          )}

          {/* Filter indicator */}
          {filter.id !== "none" && (
            <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {filter.name}
            </div>
          )}
        </div>

        {/* ── Timeline / progress bar ──────────────────────────── */}
        <div className="space-y-1 px-1">
          <div className="relative h-2 w-full cursor-pointer rounded-full bg-muted" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            seek((e.clientX - rect.left) / rect.width)
          }}>
            {/* Trim region */}
            <div
              className="absolute h-full rounded-full bg-violet-500/30"
              style={{ left: `${trimStart * 100}%`, width: `${(trimEnd - trimStart) * 100}%` }}
            />
            {/* Progress */}
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
              style={{ width: `${progress * 100}%` }}
            />
            {/* Playhead */}
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg ring-2 ring-violet-500"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(videoDuration)}</span>
          </div>
        </div>

        {/* ── Transport controls ───────────────────────────────── */}
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => seekRelative(-5)} className="text-muted-foreground hover:text-foreground">
            <SkipBack className="h-5 w-5" />
          </button>
          <button onClick={togglePlay} className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg">
            {isPaused ? <Play className="h-6 w-6 fill-white" /> : <Pause className="h-6 w-6" />}
          </button>
          <button onClick={() => seekRelative(5)} className="text-muted-foreground hover:text-foreground">
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* ── Edit mode toolbar ────────────────────────────────── */}
        {!showPublish && (
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
            {([
              { mode: "trim" as EditMode, icon: Scissors, label: "Trim" },
              { mode: "text" as EditMode, icon: Type, label: "Text" },
              { mode: "filters" as EditMode, icon: Palette, label: "Filters" },
              { mode: "speed" as EditMode, icon: Zap, label: "Speed" },
              { mode: "stickers" as EditMode, icon: Smile, label: "Stickers" },
              { mode: "music" as EditMode, icon: Music, label: "Music" },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setEditMode(editMode === mode ? "none" : mode)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs transition-all",
                  editMode === mode
                    ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* EDIT PANELS */}
        {/* ═══════════════════════════════════════════════════════ */}

        {/* ── Trim panel ───────────────────────────────────────── */}
        {editMode === "trim" && !showPublish && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Trim</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-12 text-xs text-muted-foreground">Start</span>
                <Slider
                  value={[trimStart * 100]}
                  onValueChange={([v]) => { setTrimStart(v / 100); if (v / 100 >= trimEnd) setTrimEnd(Math.min(1, v / 100 + 0.05)) }}
                  max={100}
                  step={0.5}
                  className="flex-1"
                />
                <span className="w-14 text-right text-xs text-muted-foreground">{formatTime(trimStart * videoDuration)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-12 text-xs text-muted-foreground">End</span>
                <Slider
                  value={[trimEnd * 100]}
                  onValueChange={([v]) => { setTrimEnd(v / 100); if (v / 100 <= trimStart) setTrimStart(Math.max(0, v / 100 - 0.05)) }}
                  max={100}
                  step={0.5}
                  className="flex-1"
                />
                <span className="w-14 text-right text-xs text-muted-foreground">{formatTime(trimEnd * videoDuration)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Trimmed duration: {trimDuration.toFixed(1)}s</p>
          </div>
        )}

        {/* ── Text panel ───────────────────────────────────────── */}
        {editMode === "text" && !showPublish && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Add Text</p>

            {/* Style presets */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {TEXT_STYLES.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setNewTextStyle(s)}
                  className={cn(
                    "flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                    newTextStyle.name === s.name ? "ring-2 ring-violet-500" : "ring-1 ring-border"
                  )}
                  style={{ color: s.color, background: s.bg || "rgba(255,255,255,0.1)", textShadow: s.stroke ? `1px 1px 0 ${s.stroke}` : undefined }}
                >
                  {s.name}
                </button>
              ))}
            </div>

            {/* Font selector */}
            <div className="flex gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setNewFont(f.family)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs transition-all",
                    newFont === f.family ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" : "bg-muted text-muted-foreground"
                  )}
                  style={{ fontFamily: f.family }}
                >
                  {f.name}
                </button>
              ))}
            </div>

            {/* Font size */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Size</span>
              <Slider value={[newFontSize]} onValueChange={([v]) => setNewFontSize(v)} min={16} max={72} step={2} className="flex-1" />
              <span className="w-8 text-right text-xs text-muted-foreground">{newFontSize}</span>
            </div>

            {/* Text input + add */}
            <div className="flex gap-2">
              <Input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Type text overlay…"
                className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") addText() }}
              />
              <Button onClick={addText} size="sm" className="rounded-full bg-violet-600 px-4">Add</Button>
            </div>

            {/* Existing texts */}
            {textOverlays.length > 0 && (
              <div className="space-y-1.5">
                {textOverlays.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="truncate text-sm" style={{ color: t.color, fontFamily: t.font }}>
                      {t.text}
                    </span>
                    <button onClick={() => removeText(t.id)} className="ml-2 text-muted-foreground hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Filters panel ────────────────────────────────────── */}
        {editMode === "filters" && !showPublish && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Filters</p>
            <div className="grid grid-cols-4 gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl p-2 text-xs transition-all",
                    filter.id === f.id ? "ring-2 ring-violet-500 bg-violet-500/10" : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  <div
                    className="h-12 w-12 rounded-lg bg-gradient-to-br from-violet-400 to-cyan-400"
                    style={{ filter: f.css || undefined }}
                  />
                  <span className="text-muted-foreground">{f.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Speed panel ──────────────────────────────────────── */}
        {editMode === "speed" && !showPublish && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Speed</p>
            <div className="flex items-center justify-center gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => { setSpeed(s.value); if (videoRef.current) videoRef.current.playbackRate = s.value }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-all",
                    speed === s.value
                      ? "bg-gradient-to-r from-violet-600 to-cyan-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {speed < 1 ? "Slow motion" : speed === 1 ? "Normal speed" : speed <= 2 ? "Fast" : "Hyper speed"}
            </p>
          </div>
        )}

        {/* ── Stickers panel ───────────────────────────────────── */}
        {editMode === "stickers" && !showPublish && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Stickers</p>
            <div className="grid grid-cols-10 gap-1.5">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSelectedSticker(s); addSticker() }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all hover:scale-110",
                    selectedSticker === s ? "bg-violet-500/20 ring-1 ring-violet-500/30" : "hover:bg-muted"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            {stickerOverlays.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {stickerOverlays.map((s) => (
                  <div key={s.id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                    <span className="text-lg">{s.emoji}</span>
                    <button onClick={() => removeSticker(s.id)} className="text-muted-foreground hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Music panel ──────────────────────────────────────── */}
        {editMode === "music" && !showPublish && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Music</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={cn("rounded-full p-2", isMuted ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground")}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <div className="flex-1">
                <Slider
                  value={[isMuted ? 0 : volume * 100]}
                  onValueChange={([v]) => { setVolume(v / 100); setIsMuted(false); if (videoRef.current) videoRef.current.volume = v / 100 }}
                  max={100}
                  className="w-full"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Adjust audio volume or mute the original sound</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* PUBLISH PANEL */}
        {/* ═══════════════════════════════════════════════════════ */}
        {showPublish && (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Publish Reel</p>

            <div className="space-y-1.5">
              <Label htmlFor="reel-title">Title *</Label>
              <Input
                id="reel-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your reel a catchy title"
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reel-desc">Description</Label>
              <Textarea
                id="reel-desc"
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

            {/* Edit summary */}
            <div className="flex flex-wrap gap-2 text-xs">
              {filter.id !== "none" && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-400">{filter.name} filter</span>}
              {speed !== 1 && <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-cyan-400">{speed}× speed</span>}
              {textOverlays.length > 0 && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-400">{textOverlays.length} text{textOverlays.length > 1 ? "s" : ""}</span>}
              {stickerOverlays.length > 0 && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400">{stickerOverlays.length} sticker{stickerOverlays.length > 1 ? "s" : ""}</span>}
              {(trimStart > 0 || trimEnd < 1) && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-400">Trimmed</span>}
            </div>

            <Button
              onClick={handlePublish}
              disabled={uploading || !videoFile}
              className="h-12 w-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-base font-bold"
            >
              {uploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {uploadLabel || "Publishing…"}</>
              ) : (
                "Publish Reel"
              )}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}
