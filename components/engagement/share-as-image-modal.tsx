"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, Share2 } from "lucide-react"

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
const BRAND = "#6366f1"
const BRAND_DARK = "#4338ca"
const DOMAIN = "loopapp.me"
const IMAGE_LOAD_TIMEOUT_MS = 4000

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max).trimEnd() + "…"
}

/**
 * Load an image with a hard timeout. A slow or hung avatar URL must never
 * block the whole share card — we fall back to the initial-letter avatar
 * and keep the generation snappy.
 */
function loadImage(src: string, timeoutMs = IMAGE_LOAD_TIMEOUT_MS): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: HTMLImageElement | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(null), timeoutMs)
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

/** Draw the full branded card onto the canvas. Resolves once the avatar is drawn (or timed out). */
async function drawCard(canvas: HTMLCanvasElement, post: ShareAsImageModalProps["post"]): Promise<void> {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const scale = 2
  canvas.width = CARD_WIDTH * scale
  canvas.height = CARD_HEIGHT * scale
  ctx.scale(scale, scale)

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

  // --- Avatar (loads in parallel with nothing else pending; 4s timeout) ---
  const avatarSize = 170
  const avatarImg = post.author.avatar_url ? await loadImage(post.author.avatar_url) : null

  // Avatar ring
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
  if (avatarImg) {
    const size = Math.min(avatarImg.width, avatarImg.height)
    const sx = (avatarImg.width - size) / 2
    const sy = (avatarImg.height - size) / 2
    ctx.drawImage(avatarImg, sx, sy, size, size, margin, margin, avatarSize, avatarSize)
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

  // Manual word wrap
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

  // Loop logomark — rounded square with "L"
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

  // Domain chip bottom-right
  ctx.font = "600 28px ui-monospace, monospace"
  ctx.fillStyle = "rgba(148,163,184,0.9)"
  ctx.textAlign = "right"
  ctx.fillText(`${DOMAIN}/loop/${post.id}`, CARD_WIDTH - margin, barY + 76)
  ctx.textAlign = "left"
}

/** Encode the canvas as a JPEG blob (fast). */
function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas empty"))), "image/jpeg", quality)
  })
}

export function ShareAsImageModal({ open, onOpenChange, post }: ShareAsImageModalProps) {
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Only re-render when the content actually changed — not on every parent
  // render (the post prop object identity can change per render).
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

  useEffect(() => {
    if (!open) {
      setRendered(false)
      setPreviewUrl(null)
      setBusy(false)
      return
    }
    let cancelled = false
    setBusy(true)

    const render = async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        await drawCard(canvas, post)
        if (cancelled) return
        // JPEG encodes several times faster than PNG at 2160×2160 — this is
        // what keeps the preview snappy. Download/share use the same fast path.
        setPreviewUrl(canvas.toDataURL("image/jpeg", 0.85))
        setRendered(true)
      } catch (error) {
        console.error("Share card render error:", error)
        toast({ title: "Couldn't generate the share card", description: "Please try again.", variant: "destructive" })
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    void render()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, renderKey])

  const download = async () => {
    const canvas = canvasRef.current
    if (!canvas || exporting) return
    setExporting(true)
    try {
      const blob = await canvasToJpegBlob(canvas, 0.95)
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
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const blob = await canvasToJpegBlob(canvas, 0.92)
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

        <canvas ref={canvasRef} className="hidden" />

        <div className="relative w-full overflow-hidden rounded-xl border border-border">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Share card preview" className="w-full" />
          ) : (
            <div className="flex aspect-square items-center justify-center bg-muted text-muted-foreground">
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : "Generating…"}
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
          <Button variant="outline" onClick={() => void download()} disabled={!rendered || exporting}>
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            Download
          </Button>
          <Button onClick={() => void shareNative()} disabled={!rendered}>
            <Share2 className="mr-1.5 h-4 w-4" /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
