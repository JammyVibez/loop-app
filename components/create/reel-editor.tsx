"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import {
  Camera, Upload, X, Play, Pause, SkipBack, SkipForward,
  Type, Palette, Zap, Scissors, Smile, Music, 
  RotateCcw, Video, Image as ImageIcon,  Volume2, VolumeX,
  Undo2, Redo2, Crop, RotateCw, FlipHorizontal, FlipVertical,
  Sun, Contrast, Droplets, Frame, Mic, CircleDot, RectangleHorizontal,
  RectangleVertical, SquareIcon, Sparkles, Sliders, Wand2, Paintbrush,
  LayoutTemplate, Repeat, Timer, Layers
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
import { Spinner } from "@/components/ui/skeletons"

const MAX_VIDEO_BYTES = 50 * 1024 * 1024

// ─── Constants ────────────────────────────────────────────────────
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
  { id: "cyber", name: "Cyber", css: "saturate(1.6) hue-rotate(270deg) contrast(1.2)" },
  { id: "pastel", name: "Pastel", css: "saturate(0.7) brightness(1.15) contrast(0.9)" },
  { id: "dramatic", name: "Dramatic", css: "contrast(1.5) saturate(0.8) brightness(0.9)" },
]

const SPEEDS = [
  { value: 0.25, label: "0.25×", desc: "Ultra slow" },
  { value: 0.5, label: "0.5×", desc: "Slow mo" },
  { value: 0.75, label: "0.75×", desc: "Slightly slow" },
  { value: 1, label: "1×", desc: "Normal" },
  { value: 1.5, label: "1.5×", desc: "Slightly fast" },
  { value: 2, label: "2×", desc: "Fast" },
  { value: 3, label: "3×", desc: "Hyper" },
]

const STICKERS = [
  "😀","😍","🔥","💯","✨","🎉","❤️","👀","💀","🤣",
  "😎","🙌","💪","🌟","🎶","🎬","🏆","💡","🚀","⭐",
  "🌈","🦋","🌊","🎨","📱","💻","🎵","📸","🔮","🎭",
  "👑","💎","🎯","⚡","🍀","🌸","❄️","☀️","🌙","💫",
  "🫠","🤯","🥳","🤩","😤","🫡","💅","🕊️","🔥","⚡",
]

const FONTS = [
  { name: "Sans", family: "system-ui, sans-serif" },
  { name: "Serif", family: "Georgia, serif" },
  { name: "Mono", family: "monospace" },
  { name: "Cursive", family: "cursive" },
  { name: "Display", family: "'Trebuchet MS', sans-serif" },
]

const TEXT_STYLES = [
  { name: "Plain", color: "#ffffff", stroke: "", bg: "" },
  { name: "Bold White", color: "#ffffff", stroke: "#000000", bg: "" },
  { name: "Neon", color: "#00ff88", stroke: "#003322", bg: "" },
  { name: "Fire", color: "#ff4400", stroke: "#220000", bg: "" },
  { name: "Ice", color: "#00ccff", stroke: "#002244", bg: "" },
  { name: "Gold", color: "#ffd700", stroke: "#443300", bg: "" },
  { name: "Pink Pop", color: "#ff69b4", stroke: "#440022", bg: "" },
  { name: "Shadow Box", color: "#ffffff", stroke: "", bg: "rgba(0,0,0,0.6)" },
  { name: "Gradient", color: "#ff6b6b", stroke: "#4ecdc4", bg: "" },
  { name: "Retro", color: "#ffcc02", stroke: "#000000", bg: "rgba(255,0,0,0.3)" },
]

const ASPECT_RATIOS = [
  { id: "9:16", label: "9:16", icon: RectangleVertical, w: 9, h: 16, desc: "Trees/TikTok" },
  { id: "1:1", label: "1:1", icon: SquareIcon, w: 1, h: 1, desc: "Square" },
  { id: "16:9", label: "16:9", icon: RectangleHorizontal, w: 16, h: 9, desc: "Landscape" },
  { id: "4:5", label: "4:5", icon: Crop, w: 4, h: 5, desc: "Instagram" },
]

const BORDERS = [
  { id: "none", name: "None", style: "" },
  { id: "rounded", name: "Rounded", style: "rounded-3xl" },
  { id: "film", name: "Film Strip", style: "border-4 border-white/20" },
  { id: "neon", name: "Neon Glow", style: "ring-2 ring-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.3)]" },
  { id: "polaroid", name: "Polaroid", style: "border-8 border-white shadow-xl" },
  { id: "vignette", name: "Vignette", style: "shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]" },
]

const MUSIC_TRACKS = [
  { id: "none", name: "No Music", icon: "🔇" },
  { id: "chill", name: "Chill Vibes", icon: "🎵", bpm: 80 },
  { id: "upbeat", name: "Upbeat Energy", icon: "⚡", bpm: 120 },
  { id: "dramatic", name: "Dramatic Build", icon: "🎭", bpm: 100 },
  { id: "lofi", name: "Lo-Fi Beats", icon: "🎧", bpm: 75 },
  { id: "cinematic", name: "Cinematic", icon: "🎬", bpm: 90 },
]

const TEMPLATES = [
  { id: "none", name: "Blank", icon: "📋", desc: "Start from scratch" },
  { id: "tiktok", name: "TikTok Viral", icon: "📱", desc: "Bold text + upbeat", filter: "vivid", speed: 1, border: "none", music: "upbeat" },
  { id: "cinematic-reel", name: "Cinematic", icon: "🎬", desc: "Film look + dramatic", filter: "film", speed: 0.75, border: "film", music: "cinematic" },
  { id: "retro", name: "Retro Vibe", icon: "📼", desc: "Vintage aesthetic", filter: "vintage", speed: 1, border: "polaroid", music: "lofi" },
  { id: "noir", name: "Film Noir", icon: "🎞️", desc: "Dark & moody", filter: "noir", speed: 0.75, border: "vignette", music: "dramatic" },
  { id: "dreamy", name: "Dreamy", icon: "☁️", desc: "Soft & ethereal", filter: "pastel", speed: 0.5, border: "rounded", music: "chill" },
  { id: "vlog", name: "Vlog", icon: "🎥", desc: "Clean & bright", filter: "warm", speed: 1, border: "none", music: "upbeat" },
  { id: "music-video", name: "Music Video", icon: "🎶", desc: "Neon + dramatic cuts", filter: "cyber", speed: 1, border: "neon", music: "upbeat" },
  { id: "tutorial", name: "Tutorial", icon: "📖", desc: "Clear text + calm", filter: "none", speed: 1, border: "none", music: "lofi" },
]

const CHROMA_COLORS = [
  { id: "green", name: "Green Screen", color: "#00ff00", alt: "#22c55e" },
  { id: "blue", name: "Blue Screen", color: "#0066ff", alt: "#3b82f6" },
  { id: "white", name: "White BG", color: "#ffffff", alt: "#f3f4f6" },
  { id: "black", name: "Black BG", color: "#000000", alt: "#1a1a1a" },
]

const DOODLE_COLORS = ["#ffffff", "#ff0000", "#00ff00", "#0066ff", "#ffff00", "#ff69b4", "#00ffff", "#ff8800"]

// ─── Types ────────────────────────────────────────────────────────
interface TextOverlay {
  id: string; text: string; x: number; y: number
  fontSize: number; font: string; color: string; stroke: string; bg: string
  startTime: number; endTime: number
}
interface StickerOverlay {
  id: string; emoji: string; x: number; y: number; size: number
  startTime: number; endTime: number
}
interface EditorState {
  filter: string; speed: number; trimStart: number; trimEnd: number
  brightness: number; contrast: number; saturation: number
  rotation: number; flipH: boolean; flipV: boolean
  aspectRatio: string; border: string; vignette: boolean
  textOverlays: TextOverlay[]; stickerOverlays: StickerOverlay[]
  volume: number; isMuted: boolean; musicTrack: string
  isReversed: boolean; loopSection: boolean
  chromaKey: string; chromaStrength: number
  doodlePaths: Array<{ points: Array<{x: number; y: number}>; color: string; size: number }>
}
type EditMode = "trim" | "text" | "filters" | "speed" | "stickers" | "music" | "adjust" | "transform" | "border" | "templates" | "chroma" | "doodle" | "reverse" | "none"

const uid = () => Math.random().toString(36).slice(2, 10)
const formatTime = (s: number) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, "0")}` }

const DEFAULT_STATE: EditorState = {
  filter: "none", speed: 1, trimStart: 0, trimEnd: 1,
  brightness: 100, contrast: 100, saturation: 100,
  rotation: 0, flipH: false, flipV: false,
  aspectRatio: "9:16", border: "none", vignette: false,
  textOverlays: [], stickerOverlays: [],
  volume: 1, isMuted: false, musicTrack: "none",
  isReversed: false, loopSection: false,
  chromaKey: "", chromaStrength: 80,
  doodlePaths: [],
}

// ─── Main Component ───────────────────────────────────────────────
export function TreeEditor({ onTreeCreated }: { onTreeCreated?: (id: string | null) => void }) {
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
  const voiceoverRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceoverChunksRef = useRef<Blob[]>([])

  // Source
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [isPaused, setIsPaused] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)

  // Editor state with undo/redo
  const [state, setState] = useState<EditorState>({ ...DEFAULT_STATE })
  const [history, setHistory] = useState<EditorState[]>([{ ...DEFAULT_STATE }])
  const [historyIdx, setHistoryIdx] = useState(0)

  // UI state
  const [editMode, setEditMode] = useState<EditMode>("none")
  const [showPublish, setShowPublish] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null)

  // Text editor
  const [newText, setNewText] = useState("")
  const [newFont, setNewFont] = useState(FONTS[0].family)
  const [newTextStyle, setNewTextStyle] = useState(TEXT_STYLES[0])
  const [newFontSize, setNewFontSize] = useState(36)

  // Doodle
  const [doodleColor, setDoodleColor] = useState("#ffffff")
  const [doodleSize, setDoodleSize] = useState(3)
  const [isDoodling, setIsDoodling] = useState(false)
  const doodleCanvasRef = useRef<HTMLCanvasElement>(null)
  const doodlePointsRef = useRef<Array<{x: number; y: number}>>([])

  // Publish
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadLabel, setUploadLabel] = useState<string | null>(null)

  // ─── Undo / Redo ────────────────────────────────────────────────
  const pushState = useCallback((next: EditorState) => {
    setHistory((h) => [...h.slice(0, historyIdx + 1), next])
    setHistoryIdx((i) => i + 1)
    setState(next)
  }, [historyIdx])

  const undo = () => {
    if (historyIdx <= 0) return
    const idx = historyIdx - 1
    setHistoryIdx(idx)
    setState({ ...history[idx] })
  }
  const redo = () => {
    if (historyIdx >= history.length - 1) return
    const idx = historyIdx + 1
    setHistoryIdx(idx)
    setState({ ...history[idx] })
  }

  const update = (patch: Partial<EditorState>) => {
    const next = { ...state, ...patch }
    pushState(next)
  }

  // ─── Camera ─────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); setIsPaused(false) }
    } catch {
      toast({ title: "Camera access denied", variant: "destructive" })
    }
  }

  const stopCamera = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null }

  const toggleRecord = () => {
    if (!streamRef.current) return
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      return
    }
    chunksRef.current = []
    const mr = new MediaRecorder(streamRef.current, { mimeType: "video/webm" })
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" })
      loadVideoFile(new File([blob], "tree.webm", { type: "video/webm" }))
      stopCamera()
    }
    mediaRecorderRef.current = mr
    mr.start()
    setIsRecording(true)
    setTimeout(() => { if (mr.state === "recording") mr.stop() }, 60000)
  }

  // ─── Voiceover ──────────────────────────────────────────────────
  const toggleVoiceover = async () => {
    if (isVoiceRecording) {
      voiceoverRecorderRef.current?.stop()
      setIsVoiceRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceoverChunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => { if (e.data.size > 0) voiceoverChunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(voiceoverChunksRef.current, { type: "audio/webm" })
        setVoiceoverUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
        toast({ title: "Voiceover recorded!", description: "It will play over your video." })
      }
      voiceoverRecorderRef.current = mr
      mr.start()
      setIsVoiceRecording(true)
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" })
    }
  }

  // ─── File loading ───────────────────────────────────────────────
  const loadVideoFile = (file: File) => {
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      toast({ title: "Unsupported file", variant: "destructive" }); return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast({ title: "File too large (max 50MB)", variant: "destructive" }); return
    }
    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setHistory([{ ...DEFAULT_STATE }]); setHistoryIdx(0); setState({ ...DEFAULT_STATE })
    setShowPublish(false); setEditMode("none")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (f) loadVideoFile(f)
  }

  const resetAll = () => {
    setVideoFile(null); setVideoUrl(null); setTitle(""); setDescription(""); setHashtags("")
    setTextOverlays([]); setStickerOverlays([]); setHistory([{ ...DEFAULT_STATE }]); setHistoryIdx(0)
    setState({ ...DEFAULT_STATE }); setShowPublish(false); setEditMode("none"); setVoiceoverUrl(null)
  }

  const setTextOverlays = (fn: TextOverlay[] | ((p: TextOverlay[]) => TextOverlay[])) => {
    setState((s) => ({ ...s, textOverlays: typeof fn === "function" ? fn(s.textOverlays) : fn }))
  }
  const setStickerOverlays = (fn: StickerOverlay[] | ((p: StickerOverlay[]) => StickerOverlay[])) => {
    setState((s) => ({ ...s, stickerOverlays: typeof fn === "function" ? fn(s.stickerOverlays) : fn }))
  }

  // ─── Playback ───────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current; if (!v) return
    if (v.paused) { v.play(); setIsPaused(false) } else { v.pause(); setIsPaused(true) }
  }
  const seek = (frac: number) => { const v = videoRef.current; if (!v || !v.duration) return; v.currentTime = frac * v.duration }
  const seekRel = (d: number) => { const v = videoRef.current; if (!v) return; v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + d)) }

  useEffect(() => {
    const v = videoRef.current; if (!v) return
    const onTime = () => {
      setCurrentTime(v.currentTime)
      const dur = v.duration || 1
      if (v.currentTime >= state.trimEnd * dur && !v.paused) v.currentTime = state.trimStart * dur
    }
    const onLoaded = () => { setVideoDuration(v.duration); update({ trimEnd: 1, trimStart: 0 }) }
    v.addEventListener("timeupdate", onTime); v.addEventListener("loadedmetadata", onLoaded)
    return () => { v.removeEventListener("timeupdate", onTime); v.removeEventListener("loadedmetadata", onLoaded) }
  }, [state.trimStart, state.trimEnd])

  // ─── Canvas preview ─────────────────────────────────────────────
  const buildFilterCSS = useCallback(() => {
    const f = FILTERS.find((x) => x.id === state.filter)
    let css = f?.css || ""
    if (state.brightness !== 100) css += ` brightness(${state.brightness / 100})`
    if (state.contrast !== 100) css += ` contrast(${state.contrast / 100})`
    if (state.saturation !== 100) css += ` saturate(${state.saturation / 100})`
    return css.trim()
  }, [state.filter, state.brightness, state.contrast, state.saturation])

  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || video.readyState < 2) {
      previewAnimRef.current = requestAnimationFrame(renderPreview); return
    }
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const ar = ASPECT_RATIOS.find((a) => a.id === state.aspectRatio) || ASPECT_RATIOS[0]
    const vw = video.videoWidth || 360
    const vh = video.videoHeight || 640
    canvas.width = vw; canvas.height = vh

    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((state.rotation * Math.PI) / 180)
    if (state.flipH) ctx.scale(-1, 1)
    if (state.flipV) ctx.scale(1, -1)
    ctx.filter = buildFilterCSS() || "none"
    ctx.drawImage(video, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
    ctx.filter = "none"
    ctx.restore()

    // Vignette
    if (state.vignette) {
      const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.3, canvas.width / 2, canvas.height / 2, canvas.width * 0.8)
      grad.addColorStop(0, "rgba(0,0,0,0)")
      grad.addColorStop(1, "rgba(0,0,0,0.6)")
      ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Text overlays
    const dur = video.duration || 1
    for (const t of state.textOverlays) {
      if (video.currentTime >= t.startTime && video.currentTime <= t.endTime) {
        ctx.save()
        const x = t.x * canvas.width; const y = t.y * canvas.height
        ctx.font = `bold ${t.fontSize}px ${t.font}`
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        if (t.bg) {
          ctx.fillStyle = t.bg
          const m = ctx.measureText(t.text); const pad = 8
          ctx.fillRect(x - m.width / 2 - pad, y - t.fontSize / 2 - pad, m.width + pad * 2, t.fontSize + pad * 2)
        }
        if (t.stroke) { ctx.strokeStyle = t.stroke; ctx.lineWidth = 3; ctx.strokeText(t.text, x, y) }
        ctx.fillStyle = t.color; ctx.fillText(t.text, x, y)
        ctx.restore()
      }
    }

    // Stickers
    for (const s of state.stickerOverlays) {
      if (video.currentTime >= s.startTime && video.currentTime <= s.endTime) {
        ctx.font = `${s.size}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillText(s.emoji, s.x * canvas.width, s.y * canvas.height)
      }
    }

    // Doodle paths
    for (const path of state.doodlePaths) {
      if (path.points.length < 2) continue
      ctx.save()
      ctx.strokeStyle = path.color
      ctx.lineWidth = path.size
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.moveTo(path.points[0].x * canvas.width, path.points[0].y * canvas.height)
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * canvas.width, path.points[i].y * canvas.height)
      }
      ctx.stroke()
      ctx.restore()
    }

    // Chroma key overlay hint
    if (state.chromaKey) {
      ctx.save()
      ctx.globalAlpha = 0.05
      ctx.fillStyle = state.chromaKey
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }

    previewAnimRef.current = requestAnimationFrame(renderPreview)
  }, [state.filter, state.brightness, state.contrast, state.saturation, state.rotation, state.flipH, state.flipV, state.vignette, state.aspectRatio, state.textOverlays, state.stickerOverlays, state.doodlePaths, state.chromaKey, state.chromaStrength, buildFilterCSS])

  useEffect(() => {
    if (videoUrl) previewAnimRef.current = requestAnimationFrame(renderPreview)
    return () => cancelAnimationFrame(previewAnimRef.current)
  }, [videoUrl, renderPreview])

  // ─── Text / Sticker helpers ─────────────────────────────────────
  const addText = () => {
    if (!newText.trim()) return
    const v = videoRef.current; const dur = v?.duration || 10
    const t: TextOverlay = {
      id: uid(), text: newText.trim(), x: 0.5, y: 0.5, fontSize: newFontSize,
      font: newFont, color: newTextStyle.color, stroke: newTextStyle.stroke, bg: newTextStyle.bg,
      startTime: Math.max(0, currentTime - 1), endTime: Math.min(dur, currentTime + 3),
    }
    pushState({ ...state, textOverlays: [...state.textOverlays, t] })
    setNewText("")
  }
  const removeText = (id: string) => pushState({ ...state, textOverlays: state.textOverlays.filter((t) => t.id !== id) })

  const addSticker = (emoji: string) => {
    const v = videoRef.current; const dur = v?.duration || 10
    const s: StickerOverlay = {
      id: uid(), emoji, x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.4, size: 48,
      startTime: Math.max(0, currentTime - 0.5), endTime: Math.min(dur, currentTime + 2),
    }
    pushState({ ...state, stickerOverlays: [...state.stickerOverlays, s] })
  }
  const removeSticker = (id: string) => pushState({ ...state, stickerOverlays: state.stickerOverlays.filter((s) => s.id !== id) })

  // ─── Publish ────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!requireAuth("post")) return
    if (!videoFile) { toast({ title: "Add media first", variant: "destructive" }); return }
    if (!title.trim()) { toast({ title: "Title required", variant: "destructive" }); return }
    setUploading(true)
    try {
      setUploadLabel("Uploading…")
      const uploaded = await uploadMediaFile(videoFile, { type: "video", folder: "reels", authHeaders: getAuthHeader() })
      setUploadLabel("Publishing…")
      const tags = hashtags.split(/[ ,#]+/).map((t) => t.trim().toLowerCase()).filter(Boolean)
      const treeRes = await fetch("/api/trees", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: title.trim(), description: description.trim(), content_type: "video",
          content_url: uploaded.url, thumbnail_url: null,
          duration: uploaded.duration || Math.round(videoDuration), hashtags: tags,
        }),
      })
      const { data } = await parseJsonResponse<any>(treeRes)
      if (!treeRes.ok) throw new Error(data?.error || "Failed")
      toast({ title: "Tree published! 🎬" }); resetAll(); onTreeCreated?.(data?.data?.reel?.id || null)
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" })
    } finally { setUploading(false); setUploadLabel(null) }
  }

  // ─── Cleanup ────────────────────────────────────────────────────
  useEffect(() => {
    return () => { stopCamera(); if (videoUrl) URL.revokeObjectURL(videoUrl); cancelAnimationFrame(previewAnimRef.current) }
  }, [videoUrl])

  // ─── Derived ────────────────────────────────────────────────────
  const progress = videoDuration > 0 ? currentTime / videoDuration : 0
  const trimDuration = videoDuration * (state.trimEnd - state.trimStart)
  const filterObj = FILTERS.find((f) => f.id === state.filter) || FILTERS[0]

  // ─── Guest guard ────────────────────────────────────────────────
  if (isGuest) {
    return (<>
      {LoginGateDialog}
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <Video className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">Sign in to create a Tree</p>
        <Button className="mt-4 rounded-full" onClick={() => requireAuth("post")}>Sign in</Button>
      </div>
    </>)
  }

  // ═══════════════════════════════════════════════════════════════
  // SOURCE SELECTION
  // ═══════════════════════════════════════════════════════════════
  if (!videoUrl) {
    return (<>
      {LoginGateDialog}
      <div className="space-y-3">
        <button onClick={startCamera} className="flex w-full items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-5 text-left transition-all hover:border-violet-500/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-orange-500"><Camera className="h-6 w-6 text-white" /></div>
          <div><p className="font-semibold text-foreground">Record Video</p><p className="text-sm text-muted-foreground">Use your camera to record</p></div>
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="flex w-full items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5 text-left transition-all hover:border-amber-500/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-orange-500"><Upload className="h-6 w-6 text-white" /></div>
          <div><p className="font-semibold text-foreground">Upload Video</p><p className="text-sm text-muted-foreground">MP4, WebM, MOV — up to 50MB</p></div>
          <input ref={fileInputRef} type="file" accept="video/*,image/*" className="hidden" onChange={handleFileUpload} />
        </button>
        <button onClick={() => cameraInputRef.current?.click()} className="flex w-full items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-5 text-left transition-all hover:border-emerald-500/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500"><ImageIcon className="h-6 w-6 text-white" /></div>
          <div><p className="font-semibold text-foreground">Photo to Tree</p><p className="text-sm text-muted-foreground">Turn a photo into a tree</p></div>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
        </button>
      </div>
    </>)
  }

  // ═══════════════════════════════════════════════════════════════
  // EDITOR
  // ═══════════════════════════════════════════════════════════════
  return (<>
    {LoginGateDialog}
    <div className="space-y-3">
      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={resetAll} className="h-8 w-8"><RotateCcw className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={undo} disabled={historyIdx <= 0} className="h-8 w-8"><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={historyIdx >= history.length - 1} className="h-8 w-8"><Redo2 className="h-4 w-4" /></Button>
        </div>
        <span className="text-xs text-muted-foreground">{trimDuration.toFixed(1)}s {state.speed !== 1 && `· ${state.speed}×`} {state.aspectRatio !== "9:16" && `· ${state.aspectRatio}`}</span>
        <Button size="sm" onClick={() => setShowPublish(!showPublish)} className="rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-500 px-4 font-bold">
          {showPublish ? "Edit" : "Next"}
        </Button>
      </div>

      {/* ── Preview ─────────────────────────────────────── */}
      <div className={cn("relative overflow-hidden border border-border bg-black", BORDERS.find((b) => b.id === state.border)?.style || "")}>
        <video ref={videoRef} src={videoUrl} className="hidden" crossOrigin="anonymous" playsInline muted={state.isMuted} loop />
        <canvas ref={canvasRef} className="w-full" style={{ aspectRatio: ASPECT_RATIOS.find((a) => a.id === state.aspectRatio)?.w + "/" + ASPECT_RATIOS.find((a) => a.id === state.aspectRatio)?.h, maxHeight: "55vh" }} />
        {/* Doodle overlay canvas */}
        {editMode === "doodle" && (
          <canvas
            ref={doodleCanvasRef}
            className="absolute inset-0 h-full w-full cursor-crosshair"
            style={{ zIndex: 15 }}
            onMouseDown={(e) => {
              setIsDoodling(true)
              const rect = e.currentTarget.getBoundingClientRect()
              const x = (e.clientX - rect.left) / rect.width
              const y = (e.clientY - rect.top) / rect.height
              doodlePointsRef.current = [{ x, y }]
            }}
            onMouseMove={(e) => {
              if (!isDoodling) return
              const rect = e.currentTarget.getBoundingClientRect()
              const x = (e.clientX - rect.left) / rect.width
              const y = (e.clientY - rect.top) / rect.height
              doodlePointsRef.current.push({ x, y })
            }}
            onMouseUp={() => {
              if (!isDoodling) return
              setIsDoodling(false)
              if (doodlePointsRef.current.length > 1) {
                update({ doodlePaths: [...state.doodlePaths, { points: [...doodlePointsRef.current], color: doodleColor, size: doodleSize }] })
              }
              doodlePointsRef.current = []
            }}
          />
        )}
        {/* Overlays on canvas */}
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center" style={{ zIndex: editMode === "doodle" ? 0 : 10 }}>
          {isPaused && <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"><Play className="h-7 w-7 text-white fill-white" /></div>}
        </button>
        {state.speed !== 1 && <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">{state.speed}×</div>}
        {filterObj.id !== "none" && <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">{filterObj.name}</div>}
        {state.isReversed && <div className="absolute left-2 top-8 rounded-full bg-orange-500/60 px-2 py-0.5 text-[10px] font-bold text-white">⟲ Reversed</div>}
        {state.chromaKey && <div className="absolute right-2 top-8 rounded-full bg-green-500/60 px-2 py-0.5 text-[10px] font-bold text-white">⚡ Chroma</div>}
        {state.loopSection && <div className="absolute left-2 top-8 rounded-full bg-cyan-500/60 px-2 py-0.5 text-[10px] font-bold text-white">🔁 Loop</div>}
        {isRecording && <div className="absolute left-2 bottom-2 flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white"><CircleDot className="h-3 w-3 animate-pulse" /> REC</div>}
        {voiceoverUrl && <div className="absolute right-2 bottom-2 rounded-full bg-emerald-600/80 px-2 py-0.5 text-[10px] font-bold text-white">🎙️ VO</div>}
      </div>

      {/* ── Timeline ────────────────────────────────────── */}
      <div className="space-y-1 px-1">
        <div className="relative h-2 w-full cursor-pointer rounded-full bg-muted" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width) }}>
          <div className="absolute h-full rounded-full bg-violet-500/30" style={{ left: `${state.trimStart * 100}%`, width: `${(state.trimEnd - state.trimStart) * 100}%` }} />
          <div className="absolute h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${progress * 100}%` }} />
          <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg ring-2 ring-violet-500" style={{ left: `${progress * 100}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground"><span>{formatTime(currentTime)}</span><span>{formatTime(videoDuration)}</span></div>
      </div>

      {/* ── Transport ───────────────────────────────────── */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => seekRel(-5)} className="text-muted-foreground hover:text-foreground"><SkipBack className="h-5 w-5" /></button>
        <button onClick={togglePlay} className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-500 text-white shadow-lg">
          {isPaused ? <Play className="h-5 w-5 fill-white" /> : <Pause className="h-5 w-5" />}
        </button>
        <button onClick={() => seekRel(5)} className="text-muted-foreground hover:text-foreground"><SkipForward className="h-5 w-5" /></button>
      </div>

      {/* ── Quick actions ────────────────────────────────── */}
      {!showPublish && (
        <div className="flex items-center justify-center gap-3">
          <Button variant={isRecording ? "destructive" : "outline"} size="sm" onClick={toggleRecord} className="rounded-full gap-1.5">
            {isRecording ? <><CircleDot className="h-4 w-4 animate-pulse" /> Stop</> : <><Camera className="h-4 w-4" /> Record</>}
          </Button>
          <Button variant={isVoiceRecording ? "destructive" : "outline"} size="sm" onClick={toggleVoiceover} className="rounded-full gap-1.5">
            {isVoiceRecording ? <><CircleDot className="h-4 w-4 animate-pulse" /> Stop VO</> : <><Mic className="h-4 w-4" /> Voiceover</>}
          </Button>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────── */}
      {!showPublish && (
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1">
          {([
            { mode: "templates" as EditMode, icon: LayoutTemplate, label: "Styles" },
            { mode: "trim" as EditMode, icon: Scissors, label: "Trim" },
            { mode: "text" as EditMode, icon: Type, label: "Text" },
            { mode: "filters" as EditMode, icon: Palette, label: "Filters" },
            { mode: "adjust" as EditMode, icon: Sliders, label: "Adjust" },
            { mode: "speed" as EditMode, icon: Zap, label: "Speed" },
            { mode: "reverse" as EditMode, icon: Repeat, label: "Reverse" },
            { mode: "transform" as EditMode, icon: RotateCw, label: "Transform" },
            { mode: "stickers" as EditMode, icon: Smile, label: "Stickers" },
            { mode: "doodle" as EditMode, icon: Paintbrush, label: "Draw" },
            { mode: "chroma" as EditMode, icon: Wand2, label: "Chroma" },
            { mode: "border" as EditMode, icon: Frame, label: "Frame" },
            { mode: "music" as EditMode, icon: Music, label: "Audio" },
          ]).map(({ mode, icon: Icon, label }) => (
            <button key={mode} onClick={() => setEditMode(editMode === mode ? "none" : mode)}
              className={cn("flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10px] transition-all",
                editMode === mode ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" : "text-muted-foreground hover:bg-muted/50")}>
              <Icon className="h-4 w-4" /><span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* PANELS */}
      {/* ═══════════════════════════════════════════════════ */}

      {/* ── Trim ─────────────────────────────────────────── */}
      {editMode === "trim" && !showPublish && (
        <Panel title="Trim">
          <SliderRow label="Start" value={state.trimStart * 100} max={100} onValueChange={([v]) => update({ trimStart: v / 100 })} display={formatTime(state.trimStart * videoDuration)} />
          <SliderRow label="End" value={state.trimEnd * 100} max={100} onValueChange={([v]) => update({ trimEnd: v / 100 })} display={formatTime(state.trimEnd * videoDuration)} />
          <p className="text-xs text-muted-foreground">Duration: {trimDuration.toFixed(1)}s</p>
        </Panel>
      )}

      {/* ── Text ─────────────────────────────────────────── */}
      {editMode === "text" && !showPublish && (
        <Panel title="Text Overlay">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {TEXT_STYLES.map((s) => (
              <button key={s.name} onClick={() => setNewTextStyle(s)}
                className={cn("flex-shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all", newTextStyle.name === s.name ? "ring-2 ring-violet-500" : "ring-1 ring-border")}
                style={{ color: s.color, background: s.bg || "rgba(255,255,255,0.1)" }}>{s.name}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {FONTS.map((f) => (
              <button key={f.name} onClick={() => setNewFont(f.family)}
                className={cn("rounded-lg px-2.5 py-1 text-[10px] transition-all", newFont === f.family ? "bg-violet-500/20 text-violet-400" : "bg-muted text-muted-foreground")}
                style={{ fontFamily: f.family }}>{f.name}</button>
            ))}
          </div>
          <SliderRow label="Size" value={newFontSize} min={16} max={72} step={2} onValueChange={([v]) => setNewFontSize(v)} display={`${newFontSize}px`} />
          <div className="flex gap-2">
            <Input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Type text…" className="flex-1" onKeyDown={(e) => e.key === "Enter" && addText()} />
            <Button onClick={addText} size="sm" className="rounded-full bg-violet-600 px-3">Add</Button>
          </div>
          {state.textOverlays.length > 0 && (
            <div className="space-y-1">
              {state.textOverlays.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5">
                  <span className="truncate text-xs" style={{ color: t.color, fontFamily: t.font }}>{t.text}</span>
                  <button onClick={() => removeText(t.id)} className="ml-2 text-muted-foreground hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* ── Filters ──────────────────────────────────────── */}
      {editMode === "filters" && !showPublish && (
        <Panel title="Filters">
          <div className="grid grid-cols-5 gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => update({ filter: f.id })}
                className={cn("flex flex-col items-center gap-1 rounded-xl p-1.5 text-[10px] transition-all", state.filter === f.id ? "ring-2 ring-violet-500 bg-violet-500/10" : "bg-muted/50 hover:bg-muted")}>
                <div className="h-10 w-full rounded-lg bg-gradient-to-br from-violet-400 to-cyan-400" style={{ filter: f.css || undefined }} />
                <span className="text-muted-foreground">{f.name}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Adjust (color) ───────────────────────────────── */}
      {editMode === "adjust" && !showPublish && (
        <Panel title="Color Adjustments">
          <SliderRow label="Brightness" icon={<Sun className="h-3.5 w-3.5" />} value={state.brightness} min={50} max={150} onValueChange={([v]) => update({ brightness: v })} display={`${state.brightness}%`} />
          <SliderRow label="Contrast" icon={<Contrast className="h-3.5 w-3.5" />} value={state.contrast} min={50} max={200} onValueChange={([v]) => update({ contrast: v })} display={`${state.contrast}%`} />
          <SliderRow label="Saturation" icon={<Droplets className="h-3.5 w-3.5" />} value={state.saturation} min={0} max={200} onValueChange={([v]) => update({ saturation: v })} display={`${state.saturation}%`} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Vignette</span>
            <button onClick={() => update({ vignette: !state.vignette })}
              className={cn("h-6 w-11 rounded-full transition-all", state.vignette ? "bg-violet-600" : "bg-muted")}>
              <div className={cn("h-5 w-5 rounded-full bg-white transition-transform", state.vignette ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => update({ brightness: 100, contrast: 100, saturation: 100, vignette: false })} className="w-full text-xs">Reset adjustments</Button>
        </Panel>
      )}

      {/* ── Speed ────────────────────────────────────────── */}
      {editMode === "speed" && !showPublish && (
        <Panel title="Speed">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {SPEEDS.map((s) => (
              <button key={s.value} onClick={() => { update({ speed: s.value }); if (videoRef.current) videoRef.current.playbackRate = s.value }}
                className={cn("flex flex-col items-center rounded-xl px-3 py-2 text-xs transition-all",
                  state.speed === s.value ? "bg-gradient-to-r from-fuchsia-500 to-orange-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                <span className="font-bold">{s.label}</span><span className="text-[9px] opacity-70">{s.desc}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Transform ────────────────────────────────────── */}
      {editMode === "transform" && !showPublish && (
        <Panel title="Transform">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Aspect Ratio</p>
            <div className="flex gap-2">
              {ASPECT_RATIOS.map((ar) => (
                <button key={ar.id} onClick={() => update({ aspectRatio: ar.id })}
                  className={cn("flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs transition-all flex-1",
                    state.aspectRatio === ar.id ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" : "bg-muted text-muted-foreground")}>
                  <ar.icon className="h-5 w-5" /><span className="font-medium">{ar.label}</span><span className="text-[9px] opacity-60">{ar.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-xs font-medium text-muted-foreground">Rotate & Flip</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => update({ rotation: (state.rotation + 90) % 360 })} className="flex-1 gap-1.5 rounded-xl"><RotateCw className="h-4 w-4" /> 90°</Button>
              <Button variant="outline" size="sm" onClick={() => update({ flipH: !state.flipH })} className={cn("flex-1 gap-1.5 rounded-xl", state.flipH && "bg-violet-500/20 text-violet-400")}><FlipHorizontal className="h-4 w-4" /> Flip H</Button>
              <Button variant="outline" size="sm" onClick={() => update({ flipV: !state.flipV })} className={cn("flex-1 gap-1.5 rounded-xl", state.flipV && "bg-violet-500/20 text-violet-400")}><FlipVertical className="h-4 w-4" /> Flip V</Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => update({ rotation: 0, flipH: false, flipV: false, aspectRatio: "9:16" })} className="w-full text-xs">Reset transform</Button>
          </div>
        </Panel>
      )}

      {/* ── Stickers ─────────────────────────────────────── */}
      {editMode === "stickers" && !showPublish && (
        <Panel title="Stickers">
          <div className="grid grid-cols-10 gap-1">
            {STICKERS.map((s) => (
              <button key={s} onClick={() => addSticker(s)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-all hover:scale-110 hover:bg-muted">{s}</button>
            ))}
          </div>
          {state.stickerOverlays.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {state.stickerOverlays.map((s) => (
                <div key={s.id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <span className="text-sm">{s.emoji}</span>
                  <button onClick={() => removeSticker(s.id)} className="text-muted-foreground hover:text-red-500"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* ── Border / Frame ────────────────────────────────── */}
      {editMode === "border" && !showPublish && (
        <Panel title="Frame & Border">
          <div className="grid grid-cols-3 gap-2">
            {BORDERS.map((b) => (
              <button key={b.id} onClick={() => update({ border: b.id })}
                className={cn("flex flex-col items-center gap-1 rounded-xl p-3 text-xs transition-all",
                  state.border === b.id ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" : "bg-muted text-muted-foreground")}>
                <div className={cn("h-10 w-8 rounded bg-gradient-to-br from-violet-400 to-cyan-400", b.style)} />
                <span>{b.name}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Music / Audio ────────────────────────────────── */}
      {editMode === "music" && !showPublish && (
        <Panel title="Audio">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button onClick={() => update({ isMuted: !state.isMuted })}
                className={cn("rounded-full p-2", state.isMuted ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground")}>
                {state.isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <Slider value={[state.isMuted ? 0 : state.volume * 100]} onValueChange={([v]) => { update({ volume: v / 100, isMuted: false }); if (videoRef.current) videoRef.current.volume = v / 100 }} max={100} className="flex-1" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Background Music</p>
            <div className="space-y-1.5">
              {MUSIC_TRACKS.map((m) => (
                <button key={m.id} onClick={() => update({ musicTrack: m.id })}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all",
                    state.musicTrack === m.id ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" : "bg-muted/50 text-muted-foreground hover:bg-muted")}>
                  <span className="text-lg">{m.icon}</span>
                  <div className="text-left"><p className="font-medium">{m.name}</p>{m.bpm && <p className="text-[10px] opacity-60">{m.bpm} BPM</p>}</div>
                  {state.musicTrack === m.id && <Check className="ml-auto h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        </Panel>
      )}

      {/* ── Templates ────────────────────────────────────── */}
      {editMode === "templates" && !showPublish && (
        <Panel title="Style Templates">
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => {
                if (t.id === "none") { update({ filter: "none", speed: 1, border: "none", musicTrack: "none" }); return }
                update({ filter: t.filter || "none", speed: t.speed || 1, border: t.border || "none", musicTrack: t.music || "none" })
                toast({ title: `${t.name} template applied!`, duration: 1500 })
              }} className={cn("flex flex-col items-center gap-1 rounded-xl p-3 text-center transition-all",
                "bg-muted/50 hover:bg-violet-500/10 hover:ring-1 hover:ring-violet-500/30")}>
                <span className="text-2xl">{t.icon}</span>
                <span className="text-[10px] font-medium text-foreground">{t.name}</span>
                <span className="text-[9px] text-muted-foreground leading-tight">{t.desc}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Reverse ──────────────────────────────────────── */}
      {editMode === "reverse" && !showPublish && (
        <Panel title="Reverse & Loop">
          <button onClick={() => update({ isReversed: !state.isReversed })}
            className={cn("flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all",
              state.isReversed ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" : "bg-muted/50 text-muted-foreground")}>
            <Repeat className="h-5 w-5" />
            <div className="text-left">
              <p className="font-medium">{state.isReversed ? "Reversed" : "Normal"}</p>
              <p className="text-[10px] opacity-60">{state.isReversed ? "Video plays backwards" : "Toggle to reverse playback"}</p>
            </div>
          </button>
          <button onClick={() => update({ loopSection: !state.loopSection })}
            className={cn("flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all",
              state.loopSection ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" : "bg-muted/50 text-muted-foreground")}>
            <Timer className="h-5 w-5" />
            <div className="text-left">
              <p className="font-medium">{state.loopSection ? "Loop Active" : "Loop Trimmed Section"}</p>
              <p className="text-[10px] opacity-60">Repeat trimmed section continuously</p>
            </div>
          </button>
          <div className="rounded-xl bg-muted/30 p-3 text-[10px] text-muted-foreground">
            <p>💡 Reverse plays the trimmed section backwards. Combined with loop, it creates a boomerang effect.</p>
          </div>
        </Panel>
      )}

      {/* ── Chroma Key ───────────────────────────────────── */}
      {editMode === "chroma" && !showPublish && (
        <Panel title="Chroma Key (Green Screen)">
          <div className="grid grid-cols-2 gap-2">
            {CHROMA_COLORS.map((c) => (
              <button key={c.id} onClick={() => update({ chromaKey: state.chromaKey === c.color ? "" : c.color })}
                className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all",
                  state.chromaKey === c.color ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" : "bg-muted/50 text-muted-foreground")}>
                <span className="h-4 w-4 rounded-full ring-1 ring-border" style={{ backgroundColor: c.color }} />
                <span>{c.name}</span>
                {state.chromaKey === c.color && <Check className="ml-auto h-3 w-3" />}
              </button>
            ))}
          </div>
          {state.chromaKey && (
            <div className="space-y-1.5">
              <SliderRow label="Strength" icon={<Wand2 className="h-3 w-3" />} value={state.chromaStrength} min={10} max={100} onValueChange={([v]) => update({ chromaStrength: v })} display={`${state.chromaStrength}%`} />
              <button onClick={() => update({ chromaKey: "" })} className="w-full rounded-xl bg-red-500/10 py-2 text-xs text-red-400 hover:bg-red-500/20">Remove Chroma Key</button>
            </div>
          )}
          <div className="rounded-xl bg-muted/30 p-3 text-[10px] text-muted-foreground">
            <p>💡 Chroma key removes a color from your video. Works best with solid green/blue backgrounds. This is a CSS-based preview — full chroma processing happens during export.</p>
          </div>
        </Panel>
      )}

      {/* ── Doodle ───────────────────────────────────────── */}
      {editMode === "doodle" && !showPublish && (
        <Panel title="Draw / Doodle">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">Color:</span>
            {DOODLE_COLORS.map((c) => (
              <button key={c} className="h-6 w-6 rounded-full ring-1 ring-border transition-transform hover:scale-110"
                style={{ backgroundColor: c }} onClick={() => {}} />
            ))}
          </div>
          <div className="space-y-2">
            <div className="relative rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center">
              <Paintbrush className="mx-auto mb-1 h-6 w-6 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground">Tap the video to draw on it</p>
              <p className="text-[9px] text-muted-foreground/60">Doodles appear as overlays on the final video</p>
            </div>
            {state.doodlePaths.length > 0 && (
              <button onClick={() => update({ doodlePaths: [] })} className="w-full rounded-xl bg-red-500/10 py-2 text-xs text-red-400 hover:bg-red-500/20">
                Clear All Doodles
              </button>
            )}
          </div>
        </Panel>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* PUBLISH PANEL */}
      {/* ═══════════════════════════════════════════════════ */}
      {showPublish && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Publish Tree</p>
          <div className="space-y-1.5">
            <Label htmlFor="tree-title">Title *</Label>
            <Input id="tree-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Catchy title" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tree-desc">Description</Label>
            <Textarea id="tree-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this about?" className="min-h-[70px]" maxLength={500} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reel-tags">Hashtags</Label>
            <Input id="reel-tags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="dance comedy tutorial" />
          </div>
          {/* Edit summary */}
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {filterObj.id !== "none" && <Tag>{filterObj.name}</Tag>}
            {state.speed !== 1 && <Tag>{state.speed}×</Tag>}
            {state.textOverlays.length > 0 && <Tag>{state.textOverlays.length} text</Tag>}
            {state.stickerOverlays.length > 0 && <Tag>{state.stickerOverlays.length} stickers</Tag>}
            {(state.trimStart > 0 || state.trimEnd < 1) && <Tag>Trimmed</Tag>}
            {state.rotation !== 0 && <Tag>{state.rotation}°</Tag>}
            {state.flipH && <Tag>Flipped H</Tag>}
            {state.vignette && <Tag>Vignette</Tag>}
            {state.border !== "none" && <Tag>{BORDERS.find((b) => b.id === state.border)?.name}</Tag>}
            {state.musicTrack !== "none" && <Tag>🎵 Music</Tag>}
            {voiceoverUrl && <Tag>🎙️ VO</Tag>}
            {state.isReversed && <Tag>⟲ Reversed</Tag>}
            {state.loopSection && <Tag>🔁 Loop</Tag>}
            {state.chromaKey && <Tag>⚡ Chroma</Tag>}
            {state.doodlePaths.length > 0 && <Tag>✏️ {state.doodlePaths.length} doodles</Tag>}
          </div>
          <Button onClick={handlePublish} disabled={uploading || !videoFile} className="h-12 w-full rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-500 text-base font-bold">
            {uploading ? <><Spinner className="mr-2 h-4 w-4" /> {uploadLabel || "Publishing…"}</> : "Publish Tree"}
          </Button>
        </div>
      )}
    </div>
  </>)
}

// ─── Small components ─────────────────────────────────────────────
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-2.5 rounded-2xl border border-border bg-card p-3"><p className="text-xs font-semibold text-foreground">{title}</p>{children}</div>
}
function SliderRow({ label, icon, value, min = 0, max = 100, step = 1, onValueChange, display }: {
  label: string; icon?: React.ReactNode; value: number; min?: number; max?: number; step?: number; onValueChange: (v: number[]) => void; display: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="w-16 text-[10px] text-muted-foreground">{label}</span>
      <Slider value={[value]} onValueChange={onValueChange} min={min} max={max} step={step} className="flex-1" />
      <span className="w-10 text-right text-[10px] text-muted-foreground">{display}</span>
    </div>
  )
}
function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-400">{children}</span>
}
function Check({ className }: { className?: string }) {
  return <svg className={cn("h-4 w-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
}
