"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2,
  Download,
  Share2,
  Heart,
  MessageCircle,
  GitBranch,
  Users,
  Swords,
  Zap,
  Globe,
} from "lucide-react"
import { optimizeImageUrl } from "@/lib/optimize-image"

interface ShareAsImageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: {
    id: string
    content: string
    content_type?: string
    author: {
      username: string
      display_name: string
      avatar_url?: string
      is_verified?: boolean
      is_premium?: boolean
      is_sponsor?: boolean
      is_team?: boolean
    }
    media_url?: string
    media_type?: string
    stats?: {
      likes_count?: number
      comments_count?: number
      branches_count?: number
      shares_count?: number
    }
  }
}

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350
const EXPORT_SCALE = 1.5
const DOMAIN = "loopapp.me"
const SITE_URL = `https://www.${DOMAIN}`
const AVATAR_LOAD_TIMEOUT_MS = 1500
const LOGO_URL = "/icons/icon.svg"
let cachedLogoImg: HTMLImageElement | null = null
function loadLogo(): Promise<HTMLImageElement | null> {
  if (cachedLogoImg) return Promise.resolve(cachedLogoImg)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => { cachedLogoImg = img; resolve(img) }
    img.onerror = () => resolve(null)
    img.src = LOGO_URL
  })
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max).trimEnd() + "…"
}

function formatCount(n: number | undefined | null): string {
  const value = Math.max(0, Number(n || 0))
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (value >= 1_000) return (value / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
  return String(value)
}

/* ── Avatar loading ── */
type AvatarSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap
function avatarDimensions(src: AvatarSource): { w: number; h: number } {
  if (typeof HTMLImageElement !== "undefined" && src instanceof HTMLImageElement) {
    return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height }
  }
  return { w: (src as any).width, h: (src as any).height }
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
        .then((res) => { if (!res.ok) throw new Error("fetch failed"); return res.blob() })
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

/* ── Canvas helpers ── */
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

/* ── Stat icons for canvas ── */
function drawHeartIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.32)
  ctx.bezierCurveTo(x, y - s * 0.1, x - s / 2, y - s * 0.05, x - s / 2, y + s * 0.34)
  ctx.bezierCurveTo(x - s / 2, y + s * 0.72, x - s * 0.05, y + s * 0.86, x, y + s)
  ctx.bezierCurveTo(x + s * 0.05, y + s * 0.86, x + s / 2, y + s * 0.72, x + s / 2, y + s * 0.34)
  ctx.bezierCurveTo(x + s / 2, y - s * 0.05, x, y - s * 0.1, x, y + s * 0.32)
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

function drawCommentIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, x - s / 2, y - s * 0.36, s, s * 0.78, s * 0.2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - s * 0.12, y + s * 0.42)
  ctx.lineTo(x - s * 0.12, y + s * 0.66)
  ctx.lineTo(x + s * 0.24, y + s * 0.42)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawRepostIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(2, s * 0.08)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  // Simple repost arrows
  ctx.beginPath()
  ctx.moveTo(x - s * 0.3, y + s * 0.1)
  ctx.lineTo(x - s * 0.3, y - s * 0.15)
  ctx.quadraticCurveTo(x - s * 0.3, y - s * 0.35, x - s * 0.1, y - s * 0.35)
  ctx.lineTo(x + s * 0.15, y - s * 0.35)
  ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.35, x + s * 0.35, y - s * 0.15)
  ctx.lineTo(x + s * 0.35, y + s * 0.1)
  ctx.stroke()
  ctx.restore()
}

/* ── Canvas card drawing ── */
function drawCard(
  canvas: HTMLCanvasElement,
  post: ShareAsImageModalProps["post"],
  scale: number,
  avatarSrc: AvatarSource | null,
) {
  const ctx = setupCanvas(canvas, scale)
  if (!ctx) return
  const m = 72 // margin
  const innerW = CARD_WIDTH - m * 2
  const cx = CARD_WIDTH / 2

  // ── Full-bleed dark gradient background ──
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH * 0.4, CARD_HEIGHT)
  bg.addColorStop(0, "#0c0a1a")
  bg.addColorStop(0.4, "#100e2a")
  bg.addColorStop(1, "#0a0818")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // ── Subtle grid pattern ──
  ctx.save()
  ctx.strokeStyle = "rgba(99,102,241,0.03)"
  ctx.lineWidth = 1
  for (let gx = 0; gx < CARD_WIDTH; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CARD_HEIGHT); ctx.stroke()
  }
  for (let gy = 0; gy < CARD_HEIGHT; gy += 40) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CARD_WIDTH, gy); ctx.stroke()
  }
  ctx.restore()

  // ── Decorative corner accents (pink slashes) ──
  ctx.save()
  ctx.strokeStyle = "rgba(236,72,153,0.35)"
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  // Top-right
  ctx.beginPath(); ctx.moveTo(850, 110); ctx.lineTo(900, 60); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(870, 140); ctx.lineTo(930, 80); ctx.stroke()
  // Top-left
  ctx.strokeStyle = "rgba(139,92,246,0.25)"
  ctx.beginPath(); ctx.moveTo(130, 110); ctx.lineTo(80, 60); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(110, 140); ctx.lineTo(50, 80); ctx.stroke()
  ctx.restore()

  // ── Inner dark card panel ──
  const panelX = m, panelY = m, panelW = innerW, panelH = CARD_HEIGHT - m * 2, panelR = 36
  ctx.save()
  roundRect(ctx, panelX, panelY, panelW, panelH, panelR)
  ctx.fillStyle = "rgba(15,13,35,0.85)"
  ctx.fill()
  ctx.strokeStyle = "rgba(99,102,241,0.15)"
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  // ── Top accent stripe ──
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(panelX + panelR, panelY)
  ctx.arcTo(panelX + panelW, panelY, panelX + panelW, panelY + 4, panelR)
  ctx.lineTo(panelX + panelW, panelY + 4)
  ctx.lineTo(panelX, panelY + 4)
  ctx.arcTo(panelX, panelY, panelX + panelR, panelY, panelR)
  ctx.closePath()
  const stripe = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY)
  stripe.addColorStop(0, "#818cf8")
  stripe.addColorStop(0.5, "#a78bfa")
  stripe.addColorStop(1, "#67e8f9")
  ctx.fillStyle = stripe
  ctx.fill()
  ctx.restore()

  let y = panelY + 50

  // ── App Logo ──
  const logoSize = 56
  const logoX = cx - logoSize / 2
  ctx.save()
  roundRect(ctx, logoX, y, logoSize, logoSize, 16)
  ctx.clip()
  if (cachedLogoImg) {
    ctx.drawImage(cachedLogoImg, logoX, y, logoSize, logoSize)
  } else {
    const lg = ctx.createLinearGradient(logoX, y, logoX + logoSize, y + logoSize)
    lg.addColorStop(0, "#818cf8"); lg.addColorStop(1, "#a78bfa")
    ctx.fillStyle = lg
    ctx.fillRect(logoX, y, logoSize, logoSize)
    ctx.fillStyle = "#fff"
    ctx.font = "bold 32px system-ui, sans-serif"
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("L", cx, y + logoSize / 2)
  }
  ctx.restore()
  y += logoSize + 18

  // ── "Loop" name ──
  ctx.font = "bold 30px system-ui, sans-serif"
  ctx.fillStyle = "#f1f5f9"
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"
  ctx.fillText("Loop", cx, y + 24)
  y += 32

  // ── Tagline ──
  ctx.font = "500 18px system-ui, sans-serif"
  ctx.fillStyle = "#818cf8"
  ctx.fillText("Build together.", cx, y + 16)
  y += 20
  ctx.font = "16px system-ui, sans-serif"
  ctx.fillStyle = "#94a3b8"
  ctx.fillText("Not just post into the void.", cx, y + 14)
  y += 30

  // ── Cursive "Real posts. Real people." and "Real Loop." ──
  ctx.save()
  ctx.font = "italic 36px Georgia, 'Times New Roman', serif"
  ctx.fillStyle = "#c4b5fd"
  ctx.fillText("Real posts.  Real people.", cx, y + 28)
  y += 42
  // "Real Loop." in gradient blue
  const loopGrad = ctx.createLinearGradient(cx - 140, y, cx + 140, y)
  loopGrad.addColorStop(0, "#818cf8"); loopGrad.addColorStop(0.5, "#6366f1"); loopGrad.addColorStop(1, "#3b82f6")
  ctx.font = "italic 52px Georgia, 'Times New Roman', serif"
  ctx.fillStyle = loopGrad
  ctx.fillText("Real Loop.", cx, y + 42)
  ctx.restore()
  y += 64

  // ── Decorative line ──
  ctx.strokeStyle = "rgba(99,102,241,0.2)"
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(panelX + 60, y); ctx.lineTo(panelX + panelW - 60, y); ctx.stroke()
  y += 30

  // ── Post Card (glass) ──
  const cardPad = 40
  const cardX = panelX + 36
  const cardW = panelW - 72
  // Calculate card height based on content
  ctx.font = "normal 28px system-ui, sans-serif"
  const bodyText = truncate(post.content || "Shared a loop", 300)
  const words = bodyText.split(" ")
  const lines: string[] = []
  let ln = ""
  for (const word of words) {
    const test = ln ? `${ln} ${word}` : word
    if (ctx.measureText(test).width > cardW - cardPad * 2 && ln) { lines.push(ln); ln = word } else { ln = test }
    if (lines.length >= 5) break
  }
  if (ln && lines.length < 5) lines.push(ln)
  const textH = lines.length * 38
  const cardH = cardPad + 70 + textH + 20 + 60 + cardPad // avatar row + text + stats

  ctx.save()
  roundRect(ctx, cardX, y, cardW, cardH, 20)
  ctx.fillStyle = "rgba(255,255,255,0.06)"
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  // Author row inside card
  const aY = y + cardPad
  const avatarSize = 52
  // Gradient ring
  ctx.save()
  const ringG = ctx.createLinearGradient(cardX + cardPad, aY, cardX + cardPad + avatarSize, aY + avatarSize)
  ringG.addColorStop(0, "#818cf8"); ringG.addColorStop(0.5, "#a78bfa"); ringG.addColorStop(1, "#67e8f9")
  ctx.beginPath()
  ctx.arc(cardX + cardPad + avatarSize / 2, aY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2)
  ctx.fillStyle = ringG
  ctx.fill()
  ctx.restore()
  // Avatar clip
  ctx.save()
  ctx.beginPath()
  ctx.arc(cardX + cardPad + avatarSize / 2, aY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = "#334155"
  ctx.fillRect(cardX + cardPad, aY, avatarSize, avatarSize)
  if (avatarSrc) {
    const { w, h } = avatarDimensions(avatarSrc)
    const sz = Math.min(w, h)
    ctx.drawImage(avatarSrc, (w - sz) / 2, (h - sz) / 2, sz, sz, cardX + cardPad, aY, avatarSize, avatarSize)
  } else {
    ctx.font = "bold 28px system-ui, sans-serif"
    ctx.fillStyle = "#e2e8f0"
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText((post.author.display_name || "U").charAt(0).toUpperCase(), cardX + cardPad + avatarSize / 2, aY + avatarSize / 2 + 2)
  }
  ctx.restore()

  // Name
  const nameX = cardX + cardPad + avatarSize + 16
  ctx.textAlign = "left"
  ctx.font = "bold 26px system-ui, sans-serif"
  ctx.fillStyle = "#f1f5f9"
  const name = truncate(post.author.display_name || post.author.username || "User", 24)
  ctx.fillText(name, nameX, aY + 24)
  ctx.font = "18px system-ui, sans-serif"
  ctx.fillStyle = "#64748b"
  ctx.fillText(`@${truncate(post.author.username || "user", 28)}`, nameX, aY + 46)

  // Post text
  let tY = aY + 70
  ctx.font = "28px system-ui, sans-serif"
  ctx.fillStyle = "#cbd5e1"
  for (const l of lines) {
    ctx.fillText(l, cardX + cardPad, tY)
    tY += 38
  }
  tY += 20

  // Stats
  const stats = [
    { icon: drawHeartIcon, count: Number(post.stats?.likes_count || 0), color: "#f472b6" },
    { icon: drawRepostIcon, count: Number(post.stats?.branches_count || 0), color: "#34d399" },
    { icon: drawCommentIcon, count: Number(post.stats?.comments_count || 0), color: "#22d3ee" },
  ]
  let sx = cardX + cardPad
  const iconSz = 20
  for (const s of stats) {
    if (s.count === 0) continue
    s.icon(ctx, sx + iconSz / 2, tY + 20, iconSz, s.color)
    ctx.font = "600 20px system-ui, sans-serif"
    ctx.fillStyle = "#94a3b8"
    ctx.fillText(formatCount(s.count), sx + iconSz + 10, tY + 26)
    sx += iconSz + 10 + ctx.measureText(formatCount(s.count)).width + 30
  }
  y += cardH + 40

  // ── "Join the Loop." Section ──
  ctx.save()
  const joinY = y
  roundRect(ctx, cardX, joinY, cardW, 220, 20)
  ctx.fillStyle = "rgba(255,255,255,0.04)"
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.08)"
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  // "Join the Loop." heading
  ctx.font = "bold 40px system-ui, sans-serif"
  ctx.fillStyle = "#f1f5f9"
  ctx.textAlign = "left"
  ctx.fillText("Join the", cardX + 30, joinY + 50)
  const jtlW = ctx.measureText("Join the").width
  ctx.fillStyle = "#818cf8"
  ctx.fillText(" Loop.", cardX + 30 + jtlW + 4, joinY + 50)

  // Feature icons row
  const features = [
    { icon: "👥", label: "Create together", sub: "with Co-Loop" },
    { icon: "⚔️", label: "Challenge ideas", sub: "with Duels" },
    { icon: "💬", label: "Find your people", sub: "in Circles" },
    { icon: "⚡", label: "Be part of", sub: "something real" },
  ]
  const featStartX = cardX + 30
  const featY = joinY + 90
  const featSpacing = (cardW - 200) / 4 // leave room for QR
  for (let i = 0; i < features.length; i++) {
    const fx = featStartX + i * featSpacing
    ctx.font = "28px system-ui"
    ctx.fillText(features[i].icon, fx, featY + 10)
    ctx.font = "bold 15px system-ui, sans-serif"
    ctx.fillStyle = "#e2e8f0"
    ctx.textAlign = "center"
    ctx.fillText(features[i].label, fx + featSpacing / 2 - featSpacing * 0.1, featY + 45)
    ctx.font = "13px system-ui, sans-serif"
    ctx.fillStyle = "#94a3b8"
    ctx.fillText(features[i].sub, fx + featSpacing / 2 - featSpacing * 0.1, featY + 65)
    ctx.textAlign = "left"
  }

  // QR Code area (right side)
  const qrX = cardX + cardW - 180
  const qrY = joinY + 35
  const qrSize = 100
  ctx.save()
  roundRect(ctx, qrX, qrY, qrSize, qrSize, 8)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.restore()
  // Draw simple QR-like pattern (placeholder)
  ctx.save()
  ctx.fillStyle = "#0f172a"
  const cellSize = qrSize / 10
  // Corner markers
  const drawCorner = (ox: number, oy: number) => {
    ctx.fillRect(ox, oy, cellSize * 3, cellSize)
    ctx.fillRect(ox, oy + cellSize * 2, cellSize * 3, cellSize)
    ctx.fillRect(ox, oy, cellSize, cellSize * 3)
    ctx.fillRect(ox + cellSize * 2, oy, cellSize, cellSize * 3)
  }
  drawCorner(qrX + 6, qrY + 6)
  drawCorner(qrX + qrSize - cellSize * 3 - 6, qrY + 6)
  drawCorner(qrX + 6, qrY + qrSize - cellSize * 3 - 6)
  // Random data cells
  const seed = post.id.charCodeAt(0) || 42
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if ((r < 3 && c < 3) || (r < 3 && c > 6) || (r > 6 && c < 3)) continue
      if ((seed * (r * 10 + c + 1) * 7) % 3 === 0) {
        ctx.fillRect(qrX + c * cellSize + 6, qrY + r * cellSize + 6, cellSize, cellSize)
      }
    }
  }
  ctx.restore()

  // "Download Loop" + "Scan Me" text
  ctx.font = "bold 16px system-ui, sans-serif"
  ctx.fillStyle = "#818cf8"
  ctx.textAlign = "left"
  ctx.fillText("Download Loop", qrX + qrSize + 14, qrY + 20)
  ctx.font = "13px system-ui, sans-serif"
  ctx.fillStyle = "#94a3b8"
  ctx.fillText("and start your journey.", qrX + qrSize + 14, qrY + 40)
  // "Scan Me" in cursive
  ctx.save()
  ctx.font = "italic 22px Georgia, serif"
  ctx.fillStyle = "#818cf8"
  ctx.fillText("Scan Me", qrX + qrSize + 14, qrY + 72)
  ctx.restore()

  // ── Footer ──
  y = panelY + panelH - 70
  ctx.strokeStyle = "rgba(99,102,241,0.15)"
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(contentX(panelX, 40), y); ctx.lineTo(panelX + panelW - 40, y); ctx.stroke()
  y += 30

  // Globe icon + URL
  ctx.font = "18px system-ui, sans-serif"
  ctx.fillStyle = "#64748b"
  ctx.textAlign = "center"
  ctx.fillText(`🌐  www.${DOMAIN}`, cx, y + 14)

  // ── Bottom glow ──
  const glow = ctx.createRadialGradient(cx, CARD_HEIGHT, 0, cx, CARD_HEIGHT, 400)
  glow.addColorStop(0, "rgba(99,102,241,0.08)")
  glow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, CARD_HEIGHT - 400, CARD_WIDTH, 400)
}

function contentX(panelX: number, offset: number) {
  return panelX + offset
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas empty"))), "image/jpeg", quality)
  })
}

/* ── JSX Preview ── */
function ShareCardPreview({ post }: { post: ShareAsImageModalProps["post"] }) {
  const bodyText = truncate(post.content || "Shared a loop", 300)
  const name = truncate(post.author.display_name || post.author.username || "User", 24)
  const stats = [
    { icon: Heart, count: Number(post.stats?.likes_count || 0), color: "text-pink-400" },
    { icon: GitBranch, count: Number(post.stats?.branches_count || 0), color: "text-emerald-400" },
    { icon: MessageCircle, count: Number(post.stats?.comments_count || 0), color: "text-cyan-400" },
  ]

  return (
    <div
      className="relative w-full aspect-[4/5] select-none overflow-hidden rounded-xl text-left"
      style={{ background: "linear-gradient(160deg, #0c0a1a 0%, #100e2a 40%, #0a0818 100%)" }}
    >
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Decorative corner accents */}
      <div className="absolute top-8 right-10 opacity-30">
        <div className="h-16 w-0.5 rotate-[-45deg] bg-pink-400" />
        <div className="mt-1 h-12 w-0.5 -rotate-[30deg] bg-pink-400/70 ml-3" />
      </div>
      <div className="absolute top-8 left-10 opacity-20">
        <div className="h-16 w-0.5 rotate-[45deg] bg-violet-400" />
        <div className="mt-1 h-12 w-0.5 rotate-[30deg] bg-violet-400/70 ml-3" />
      </div>

      {/* Inner panel */}
      <div className="absolute inset-x-[7%] top-[5%] bottom-[5%] overflow-hidden rounded-3xl border border-indigo-500/15 bg-[#0f0d23]/85">
        {/* Top accent stripe */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #818cf8, #a78bfa, #67e8f9)" }} />
      </div>

      {/* Content */}
      <div className="absolute inset-x-[12%] top-[calc(5%+8px)] bottom-[5%] flex flex-col py-[4%]">
        {/* Logo */}
        <div className="flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl">
            <img src="/icons/icon.svg" alt="Loop" className="h-full w-full object-contain" />
          </span>
        </div>
        <p className="mt-2 text-center text-[17px] font-bold text-slate-100">Loop</p>
        <p className="text-center text-[14px] text-indigo-400">Build together.</p>
        <p className="text-center text-[12px] text-slate-400">Not just post into the void.</p>

        {/* Cursive tagline */}
        <div className="mt-3 text-center">
          <p className="font-[Georgia] text-[26px] italic text-violet-300">Real posts.  Real people.</p>
          <p className="font-[Georgia] text-[38px] italic font-bold bg-gradient-to-r from-indigo-400 via-indigo-500 to-blue-400 bg-clip-text text-transparent">
            Real Loop.
          </p>
        </div>

        <div className="my-3 h-px w-full bg-indigo-500/15" />

        {/* Post Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] p-5">
          {/* Author */}
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-[2px]" style={{ background: "linear-gradient(135deg, #818cf8, #a78bfa, #67e8f9)" }}>
              <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-slate-700 text-slate-200 text-lg font-bold">
                {post.author.avatar_url ? (
                  <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : name.charAt(0).toUpperCase()}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-slate-100">{name}</p>
              <p className="truncate text-[12px] text-slate-500">@{truncate(post.author.username || "user", 28)}</p>
            </div>
          </div>
          {/* Body */}
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-300 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:5] overflow-hidden">
            {bodyText}
          </p>
          {/* Stats */}
          {stats.some((s) => s.count > 0) && (
            <div className="mt-3 flex items-center gap-4">
              {stats.filter((s) => s.count > 0).map(({ icon: Icon, count, color }, i) => (
                <span key={i} className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400">
                  <Icon className={`h-4 w-4 ${color}`} strokeWidth={2.2} />
                  {formatCount(count)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Join the Loop section */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="text-[22px] font-bold text-slate-100">
                Join the <span className="text-indigo-400">Loop.</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { emoji: "👥", label: "Create together", sub: "with Co-Loop" },
                  { emoji: "⚔️", label: "Challenge ideas", sub: "with Duels" },
                  { emoji: "💬", label: "Find your people", sub: "in Circles" },
                  { emoji: "⚡", label: "Be part of", sub: "something real" },
                ].map((f, i) => (
                  <div key={i} className="text-center">
                    <span className="text-xl">{f.emoji}</span>
                    <p className="text-[11px] font-bold text-slate-200">{f.label}</p>
                    <p className="text-[9px] text-slate-500">{f.sub}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-center">
              <p className="text-[12px] font-bold text-indigo-400">Download Loop</p>
              <p className="text-[9px] text-slate-500">and start your journey.</p>
              <div className="mt-1 h-20 w-20 rounded-lg bg-white p-1">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(SITE_URL)}&bgcolor=ffffff&color=0f172a`}
                  alt="QR Code"
                  className="h-full w-full"
                  loading="lazy"
                />
              </div>
              <p className="mt-0.5 font-[Georgia] text-[13px] italic text-indigo-400">Scan Me</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <Globe className="h-3 w-3" />
          www.{DOMAIN}
        </div>
      </div>

      {/* Bottom glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-40 w-[80%] rounded-full bg-indigo-500/5 blur-3xl" />
    </div>
  )
}

/* ── Main modal ── */
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
      [post.id, post.content, post.author.username, post.author.display_name, post.author.avatar_url, post.stats?.likes_count ?? "", post.stats?.comments_count ?? "", post.stats?.branches_count ?? ""].join("|"),
    [post.id, post.content, post.author.username, post.author.display_name, post.author.avatar_url, post.stats?.likes_count, post.stats?.comments_count, post.stats?.branches_count],
  )

  useEffect(() => {
    if (!open) { setRendered(false); setExporting(false); cachedBlobRef.current = null; avatarRef.current = null; return }
    const gen = ++generationRef.current
    let cancelled = false
    setRendered(false)
    const generate = async () => {
      const canvas = exportCanvasRef.current
      if (!canvas) return
      try {
        await loadLogo()
        drawCard(canvas, post, EXPORT_SCALE, avatarRef.current)
        if (cancelled || gen !== generationRef.current) return
        cachedBlobRef.current = await canvasToJpegBlob(canvas, 0.92)
        setRendered(true)
        const avatar = post.author.avatar_url ? await loadAvatar(post.author.avatar_url) : null
        if (cancelled || gen !== generationRef.current) return
        avatarRef.current = avatar
        drawCard(canvas, post, EXPORT_SCALE, avatar)
        const blob2 = await canvasToJpegBlob(canvas, 0.92)
        if (cancelled || gen !== generationRef.current) return
        cachedBlobRef.current = blob2
      } catch (error) {
        console.error("Share card pre-render error:", error)
        if (!cancelled) setRendered(false)
      }
    }
    const run = () => void generate()
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 1500 })
      return () => { cancelled = true; cancelIdleCallback(id) }
    }
    const t = window.setTimeout(run, 80)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, renderKey])

  const getExportBlob = async (): Promise<Blob> => {
    if (cachedBlobRef.current) return cachedBlobRef.current
    const canvas = exportCanvasRef.current
    if (!canvas) throw new Error("Canvas not ready")
    drawCard(canvas, post, EXPORT_SCALE, avatarRef.current)
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
      a.href = url; a.download = `loop-${post.id}.jpg`; a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast({ title: "Image downloaded", description: "Share it anywhere." })
    } catch (error: any) {
      toast({ title: "Download failed", description: error?.message || "Unknown error", variant: "destructive" })
    } finally { setExporting(false) }
  }

  const shareNative = async () => {
    try {
      const blob = await getExportBlob()
      const file = new File([blob], `loop-${post.id}.jpg`, { type: "image/jpeg" })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Loop", text: post.content.slice(0, 120) })
        toast({ title: "Shared!" })
      } else { await download() }
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
            <Share2 className="h-4 w-4 text-indigo-400" /> Share as image
          </DialogTitle>
          <DialogDescription>
            A branded share card — perfect for X, Instagram, or anywhere else.
          </DialogDescription>
        </DialogHeader>

        <canvas ref={exportCanvasRef} className="hidden" />

        <div className="relative w-full overflow-hidden rounded-xl border border-border">
          <ShareCardPreview post={post} />
          {!rendered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/70 backdrop-blur-[1px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Preparing high-res image…</p>
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
