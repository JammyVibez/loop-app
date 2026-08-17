"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, Share2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ShareAsImageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: {
    id: string
    content: string
    author: {
      username: string
      display_name: string
      avatar_url?: string
      is_verified?: boolean
    }
    media_url?: string
  }
}

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1080
const EXPORT_SCALE = 1.9 // 2052×2052 — crisp for social, ~20% faster to encode than 2160
const BRAND = "#6366f1"
const DOMAIN = "loopapp.me"
const AVATAR_LOAD_TIMEOUT_MS = 1500

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max).trimEnd() + "…"
}

/**
 * Load an avatar with a hard, short timeout. The card renders instantly with
 * a letter-avatar fallback — the real avatar composites in when (and if) it
 * arrives, so a slow image never blocks the generation.
 */
type AvatarSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap

function avatarDimensions(src: AvatarSource): { w: number; h: number } {
  if (typeof HTMLImageElement !== "undefined" && src instanceof HTMLImageElement) {
    return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height }
  }
  return { w: src.width, h: src.height }
}

function loadAvatar(src: string): Promise<AvatarSource | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: AvatarSource | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(null), AVATAR_LOAD_TIMEOUT_MS)

    if (typeof createImageBitmap === "function") {
      fetch(src, { mode: "cors", credentials: "include" })
        .then((res) => {
          if (!res.ok) throw new Error("fetch failed")
          return res.blob()
        })
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => finish(bitmap))
        .catch(() => {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.onload = () => finish(img)
          img.onerror = () => finish(null)
          img.src = src
        })
      return
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => finish(img)
    img.onerror = () => finish(null)
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function setupCanvas(canvas: HTMLCanvasElement, scale: number) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  canvas.width = Math.round(CARD_WIDTH * scale)
  canvas.height = Math.round(CARD_HEIGHT * scale)
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  return ctx
}

/** Draws the full branded card at the given scale. Avatar is drawn from the
 *  provided source (an image/bitmap or null for the letter fallback). */
function drawCardBase(
  canvas: HTMLCanvasElement,
  post: ShareAsImageModalProps["post"],
  scale: number,
  avatarSrc: AvatarSource | null,
) {
  const ctx = setupCanvas(canvas, scale)
  if (!ctx) return

  // Background — deep navy with a subtle indigo radial glow (Loop branding).
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT)
  bg.addColorStop(0, "#0f172a")
  bg.addColorStop(0.55, "#111827")
  bg.addColorStop(1, "#1e1b4b")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  const glow = ctx.createRadialGradient(CARD_WIDTH * 0.15, CARD_HEIGHT * 0.1, 50, CARD_WIDTH * 0.15, CARD_HEIGHT * 0.1, 700)
  glow.addColorStop(0, "rgba(99,102,241,0.28)")
  glow.addColorStop(1, "rgba(99,102,241,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  const glow2 = ctx.createRadialGradient(CARD_WIDTH * 0.9, CARD_HEIGHT * 0.95, 50, CARD_WIDTH * 0.9, CARD_HEIGHT * 0.95, 640)
  glow2.addColorStop(0, "rgba(34,211,238,0.16)")
  glow2.addColorStop(1, "rgba(34,211,238,0)")
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // Decorative rings
  ctx.strokeStyle = "rgba(255,255,255,0.04)"
  ctx.lineWidth = 2
  for (const r of [180, 320, 460]) {
    ctx.beginPath()
    ctx.arc(CARD_WIDTH - 140, CARD_HEIGHT - 220, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  const margin = 90
  const maxTextWidth = CARD_WIDTH - margin * 2

  // --- Avatar ---
  const avatarSize = 170

  const ring = ctx.createLinearGradient(margin, 0, margin + avatarSize, avatarSize)
  ring.addColorStop(0, BRAND)
  ring.addColorStop(1, "#22d3ee")
  ctx.save()
  ctx.beginPath()
  ctx.arc(margin + avatarSize / 2, margin + avatarSize / 2, avatarSize / 2 + 12, 0, Math.PI * 2)
  ctx.fillStyle = ring
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(margin + avatarSize / 2, margin + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = "#334155"
  ctx.fillRect(margin, margin, avatarSize, avatarSize)
  if (avatarSrc) {
    const { w, h } = avatarDimensions(avatarSrc)
    const size = Math.min(w, h)
    const sx = (w - size) / 2
    const sy = (h - size) / 2
    ctx.drawImage(avatarSrc, sx, sy, size, size, margin, margin, avatarSize, avatarSize)
  } else {
    ctx.font = "bold 80px system-ui, sans-serif"
    ctx.fillStyle = "#e2e8f0"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText((post.author.display_name || "U").charAt(0).toUpperCase(), margin + avatarSize / 2, margin + avatarSize / 2 + 6)
  }
  ctx.restore()

  // --- Display name + verified badge ---
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.font = "bold 52px system-ui, sans-serif"
  ctx.fillStyle = "#f8fafc"
  const name = truncate(post.author.display_name || post.author.username || "User", 22)
  const nameWidth = ctx.measureText(name).width
  ctx.fillText(name, margin + avatarSize + 60, margin + 68)

  if (post.author.is_verified) {
    const badgeX = margin + avatarSize + 60 + nameWidth + 24
    const badgeY = margin + 68 - 42
    ctx.save()
    ctx.beginPath()
    ctx.arc(badgeX + 24, badgeY + 24, 24, 0, Math.PI * 2)
    ctx.fillStyle = "#38bdf8"
    ctx.fill()
    ctx.fillStyle = "#0f172a"
    ctx.font = "bold 34px system-ui, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("✓", badgeX + 24, badgeY + 25)
    ctx.restore()
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
  }

  // --- Username ---
  ctx.font = "normal 34px system-ui, sans-serif"
  ctx.fillStyle = "#94a3b8"
  ctx.fillText(`@${truncate(post.author.username || "user", 26)}`, margin + avatarSize + 60, margin + 120)

  // --- Divider ---
  ctx.strokeStyle = "rgba(148,163,184,0.25)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(margin, margin + avatarSize + 80)
  ctx.lineTo(CARD_WIDTH - margin, margin + avatarSize + 80)
  ctx.stroke()

  // --- Post text (truncated) ---
  const textStartY = margin + avatarSize + 150
  const bodyText = truncate(post.content || "Shared a loop", 420)
  ctx.font = "normal 46px system-ui, sans-serif"
  ctx.fillStyle = "#f1f5f9"

  const words = bodyText.split(" ")
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxTextWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
    if (lines.length >= 8) break
  }
  if (line) lines.push(line)
  const shownLines = lines.slice(0, 8)
  let y = textStartY
  for (const l of shownLines) {
    ctx.fillText(l, margin, y)
    y += 62
  }

  // --- Bottom branding bar ---
  const barY = CARD_HEIGHT - 190
  ctx.strokeStyle = "rgba(99,102,241,0.5)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(margin, barY)
  ctx.lineTo(CARD_WIDTH - margin, barY)
  ctx.stroke()

  ctx.save()
  roundRect(ctx, margin, barY + 34, 76, 76, 20)
  const logoBg = ctx.createLinearGradient(margin, barY + 34, margin + 76, barY + 110)
  logoBg.addColorStop(0, BRAND)
  logoBg.addColorStop(1, "#22d3ee")
  ctx.fillStyle = logoBg
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.font = "bold 52px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("L", margin + 38, barY + 74)
  ctx.restore()

  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.font = "bold 40px system-ui, sans-serif"
  ctx.fillStyle = "#f8fafc"
  ctx.fillText("Loop", margin + 100, barY + 76)
  ctx.font = "normal 28px system-ui, sans-serif"
  ctx.fillStyle = "#94a3b8"
  ctx.fillText("Build together. Not just post into the void.", margin + 100, barY + 118)

  ctx.font = "600 28px ui-monospace, monospace"
  ctx.fillStyle = "rgba(148,163,184,0.9)"
  ctx.textAlign = "right"
  ctx.fillText(`${DOMAIN}/loop/${post.id}`, CARD_WIDTH - margin, barY + 76)
  ctx.textAlign = "left"
}

/** Encode a canvas as a JPEG blob (fast, async). */
function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas empty"))), "image/jpeg", quality)
  })
}

/* ------------------------------------------------------------------ */
/* Instant HTML preview — the same card, rendered as JSX so the modal   */
/* shows the share card in a single frame with zero encoding.           */
/* ------------------------------------------------------------------ */

function ShareCardPreview({ post }: { post: ShareAsImageModalProps["post"] }) {
  const name = truncate(post.author.display_name || post.author.username || "User", 22)
  const bodyText = truncate(post.content || "Shared a loop", 420)
  return (
    <div
      className="relative aspect-square w-full select-none overflow-hidden rounded-xl bg-[#0f172a] text-left"
      style={{ containerType: "inline-size" }}
    >
      {/* Background gradient + glows (mirrors the canvas card) */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(140deg, #0f172a 0%, #111827 55%, #1e1b4b 100%)",
        }}
      />
      <div
        className="absolute -left-10 -top-12 h-56 w-56 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.28) 0%, rgba(99,102,241,0) 70%)" }}
      />
      <div
        className="absolute -bottom-12 -right-8 h-48 w-48 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.16) 0%, rgba(34,211,238,0) 70%)" }}
      />
      {/* Decorative rings */}
      <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full border border-white/5" />
      <div className="absolute -bottom-8 -right-8 h-36 w-36 rounded-full border border-white/5" />

      <div className="relative flex h-full flex-col p-[8%]">
        {/* Header: avatar + identity */}
        <div className="flex items-center gap-[5%]">
          <span className="flex aspect-square w-[16%] shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 p-[4%]">
            <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-slate-700 text-[9cqw] font-bold text-slate-200">
              {post.author.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[clamp(11px,3.2cqw,22px)] font-bold leading-tight text-slate-50">
              <span className="truncate">{name}</span>
              {post.author.is_verified && (
                <span className="flex h-[1.2em] w-[1.2em] shrink-0 items-center justify-center rounded-full bg-sky-400 text-[0.8em] font-bold text-slate-900">
                  ✓
                </span>
              )}
            </p>
            <p className="truncate text-[clamp(9px,2.4cqw,16px)] text-slate-400">@{truncate(post.author.username || "user", 26)}</p>
          </div>
        </div>

        <div className="mt-[6%] h-px w-full bg-slate-400/25" />

        {/* Body text */}
        <p className="mt-[6%] whitespace-pre-line text-[clamp(12px,3.6cqw,26px)] leading-relaxed text-slate-100 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:8] overflow-hidden">
          {bodyText}
        </p>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Branding bar */}
        <div className="mt-[4%] h-px w-full bg-indigo-500/50" />
        <div className="mt-[4%] flex items-center gap-[3%]">
          <span className="flex h-[clamp(20px,6cqw,44px)] w-[clamp(20px,6cqw,44px)] shrink-0 items-center justify-center rounded-[30%] bg-gradient-to-tr from-indigo-500 to-cyan-400 text-[clamp(12px,3.6cqw,26px)] font-bold text-white">
            L
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[clamp(10px,2.8cqw,20px)] font-bold leading-tight text-slate-50">Loop</p>
            <p className="truncate text-[clamp(8px,1.9cqw,14px)] text-slate-400">Build together. Not just post into the void.</p>
          </div>
          <p className="shrink-0 font-mono text-[clamp(8px,2cqw,15px)] font-semibold text-slate-400">
            {DOMAIN}/loop/{post.id}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function ShareAsImageModal({ open, onOpenChange, post }: ShareAsImageModalProps) {
  const { toast } = useToast()
  const exportCanvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)
  const [exporting, setExporting] = useState(false)
  const avatarRef = useRef<AvatarSource | null>(null)
  const cachedBlobRef = useRef<Blob | null>(null)
  const generationRef = useRef(0)

  const renderKey = useMemo(
    () =>
      [
        post.id,
        post.content,
        post.media_url,
        post.author.username,
        post.author.display_name,
        post.author.avatar_url,
        post.author.is_verified ? "1" : "0",
      ].join("|"),
    [post.id, post.content, post.media_url, post.author.username, post.author.display_name, post.author.avatar_url, post.author.is_verified],
  )

  // Pre-generate the full-res export blob in the background as soon as the
  // modal opens, so Download/Share are instant by the time the user taps.
  // The preview is plain HTML (rendered in the same frame), so the modal
  // itself never waits on an encode.
  useEffect(() => {
    if (!open) {
      setRendered(false)
      setExporting(false)
      cachedBlobRef.current = null
      avatarRef.current = null
      return
    }
    const gen = ++generationRef.current
    let cancelled = false
    setRendered(false)

    const generate = async () => {
      const canvas = exportCanvasRef.current
      if (!canvas) return
      try {
        drawCardBase(canvas, post, EXPORT_SCALE, avatarRef.current)
        const blob = await canvasToJpegBlob(canvas, 0.92)
        if (cancelled || gen !== generationRef.current) return
        cachedBlobRef.current = blob
        setRendered(true)

        // Avatar arrives asynchronously — redraw + re-encode so the download
        // includes the real avatar. Never blocks the initial render.
        const avatar = post.author.avatar_url ? await loadAvatar(post.author.avatar_url) : null
        if (cancelled || gen !== generationRef.current) return
        avatarRef.current = avatar
        drawCardBase(canvas, post, EXPORT_SCALE, avatar)
        const blob2 = await canvasToJpegBlob(canvas, 0.92)
        if (cancelled || gen !== generationRef.current) return
        cachedBlobRef.current = blob2
      } catch (error) {
        console.error("Share card pre-render error:", error)
        if (!cancelled) {
          // Non-fatal: Download will generate on demand.
          setRendered(false)
        }
      }
    }

    const run = () => void generate()
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 1500 })
      return () => {
        cancelled = true
        cancelIdleCallback(id)
      }
    }
    const t = window.setTimeout(run, 80)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, renderKey])

  /** Returns a ready-to-share JPEG blob, generating it on demand if the idle
   *  pre-generation hasn't finished yet (rare — the user tapped fast). */
  const getExportBlob = async (): Promise<Blob> => {
    if (cachedBlobRef.current) return cachedBlobRef.current
    const canvas = exportCanvasRef.current
    if (!canvas) throw new Error("Canvas not ready")
    drawCardBase(canvas, post, EXPORT_SCALE, avatarRef.current)
    const blob = await canvasToJpegBlob(canvas, 0.92)
    cachedBlobRef.current = blob
    return blob
  }

  const download = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const blob = await getExportBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `loop-${post.id}.jpg`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast({ title: "Image downloaded", description: "Share it anywhere." })
    } catch (error: any) {
      toast({ title: "Download failed", description: error?.message || "Unknown error", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const shareNative = async () => {
    try {
      const blob = await getExportBlob()
      const file = new File([blob], `loop-${post.id}.jpg`, { type: "image/jpeg" })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Loop", text: post.content.slice(0, 120) })
        toast({ title: "Shared!" })
      } else {
        await download()
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return
      toast({ title: "Couldn't share", description: error.message || "Unknown error", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-sky-500" /> Share as image
          </DialogTitle>
          <DialogDescription>
            A branded share card with your profile, the post, and Loop branding — perfect for X, Instagram, or anywhere else.
          </DialogDescription>
        </DialogHeader>

        {/* Hidden full-res export canvas */}
        <canvas ref={exportCanvasRef} className="hidden" />

        <div className="relative w-full overflow-hidden rounded-xl border border-border">
          <ShareCardPreview post={post} />
          {!rendered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/70 backdrop-blur-[1px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Preparing high-res image…</p>
            </div>
          )}
          {!post.media_url && (
            <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                Card shows the post text; long posts are truncated automatically.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => void download()} disabled={exporting}>
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            Download
          </Button>
          <Button onClick={() => void shareNative()}>
            <Share2 className="mr-1.5 h-4 w-4" /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
