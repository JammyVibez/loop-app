"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
    const finish = (value: AvatarSource | null) => { if (settled) return; settled = true; clearTimeout(timer); resolve(value) }
    const timer = window.setTimeout(() => finish(null), 1500)
    if (typeof createImageBitmap === "function") {
      fetch(src, { mode: "cors", credentials: "include" })
        .then((r) => { if (!r.ok) throw new Error(); return r.blob() })
        .then((b) => createImageBitmap(b))
        .then((b) => finish(b))
        .catch(() => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => finish(img); img.onerror = () => finish(null); img.src = src })
      return
    }
    const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => finish(img); img.onerror = () => finish(null); img.src = src
  })
}

/* ── Canvas helpers ── */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
function setupCanvas(canvas: HTMLCanvasElement, scale: number) {
  const ctx = canvas.getContext("2d"); if (!ctx) return null
  canvas.width = Math.round(CARD_WIDTH * scale); canvas.height = Math.round(CARD_HEIGHT * scale)
  ctx.setTransform(scale, 0, 0, scale, 0, 0); return ctx
}

/* ── Quote highlighting ── */
function drawTextWithQuotes(ctx: CanvasRenderingContext2D, text: string, x: number, startY: number, maxW: number, fontSize: number, normalColor: string, quoteColor: string): number {
  ctx.font = `${fontSize}px system-ui, sans-serif`
  const words = text.split(" ")
  const lines: string[] = []
  let ln = ""
  for (const word of words) {
    const test = ln ? `${ln} ${word}` : word
    if (ctx.measureText(test).width > maxW && ln) { lines.push(ln); ln = word } else { ln = test }
    if (lines.length >= 6) break
  }
  if (ln && lines.length < 6) lines.push(ln)

  let y = startY
  for (const line of lines) {
    // Parse quoted sections
    const parts = line.split(/("[^"]*"|"[^"]*")/)
    let cx = x
    for (const part of parts) {
      if (!part) continue
      const isQuote = part.startsWith('"') || part.startsWith("\u201C")
      ctx.fillStyle = isQuote ? quoteColor : normalColor
      ctx.textAlign = "left"
      ctx.fillText(part, cx, y)
      cx += ctx.measureText(part).width
    }
    y += fontSize * 1.35
  }
  return y
}

/* ── Canvas card drawing ── */
function drawCard(canvas: HTMLCanvasElement, post: ShareAsImageModalProps["post"], scale: number, avatarSrc: AvatarSource | null) {
  const ctx = setupCanvas(canvas, scale)
  if (!ctx) return
  const m = 60
  const innerW = CARD_WIDTH - m * 2
  const cx = CARD_WIDTH / 2

  // ── Background ──
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH * 0.3, CARD_HEIGHT)
  bg.addColorStop(0, "#0b0920"); bg.addColorStop(0.5, "#0e0c28"); bg.addColorStop(1, "#080618")
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // ── Subtle grid pattern ──
  ctx.save(); ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 0.5
  for (let gx = 0; gx < CARD_WIDTH; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CARD_HEIGHT); ctx.stroke() }
  for (let gy = 0; gy < CARD_HEIGHT; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CARD_WIDTH, gy); ctx.stroke() }
  ctx.restore()

  // ── Subtle radial glow at center ──
  const glow = ctx.createRadialGradient(cx, CARD_HEIGHT * 0.35, 0, cx, CARD_HEIGHT * 0.35, 500)
  glow.addColorStop(0, "rgba(99,102,241,0.06)"); glow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = glow; ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  let y = m + 20

  // ── Logo lockup: icon inline with "Loop" wordmark ──
  const logoSize = 48
  ctx.save(); roundRect(ctx, cx - 120, y, logoSize, logoSize, 14); ctx.clip()
  if (cachedLogoImg) { ctx.drawImage(cachedLogoImg, cx - 120, y, logoSize, logoSize) }
  else { const lg = ctx.createLinearGradient(cx - 120, y, cx - 120 + logoSize, y + logoSize); lg.addColorStop(0, "#818cf8"); lg.addColorStop(1, "#a78bfa"); ctx.fillStyle = lg; ctx.fillRect(cx - 120, y, logoSize, logoSize); ctx.fillStyle = "#fff"; ctx.font = "bold 28px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("L", cx - 120 + logoSize / 2, y + logoSize / 2) }
  ctx.restore()
  // "Loop" wordmark next to icon
  ctx.font = "bold 38px system-ui, sans-serif"; ctx.fillStyle = "#f1f5f9"; ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.fillText("Loop", cx - 62, y + logoSize / 2)
  y += logoSize + 14

  // ── Tagline ──
  ctx.font = "500 18px system-ui, sans-serif"; ctx.fillStyle = "#818cf8"; ctx.textAlign = "center"
  ctx.fillText("Build together.", cx, y + 12); y += 18
  ctx.font = "16px system-ui, sans-serif"; ctx.fillStyle = "#7c83a4"
  ctx.fillText("Not just post into the void.", cx, y + 12); y += 28

  // ── Hand-drawn accent marks flanking "Real posts. Real people." ──
  ctx.save()
  ctx.strokeStyle = "rgba(168,85,247,0.5)"; ctx.lineWidth = 2.5; ctx.lineCap = "round"
  // Left squiggle
  ctx.beginPath(); ctx.moveTo(cx - 260, y + 5); ctx.bezierCurveTo(cx - 270, y - 8, cx - 250, y - 15, cx - 255, y + 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx - 265, y + 18); ctx.bezierCurveTo(cx - 275, y + 8, cx - 248, y + 5, cx - 252, y + 20); ctx.stroke()
  // Right squiggle
  ctx.strokeStyle = "rgba(34,211,238,0.4)"
  ctx.beginPath(); ctx.moveTo(cx + 255, y + 5); ctx.bezierCurveTo(cx + 265, y - 8, cx + 245, y - 15, cx + 250, y + 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx + 260, y + 18); ctx.bezierCurveTo(cx + 270, y + 8, cx + 243, y + 5, cx + 247, y + 20); ctx.stroke()
  ctx.restore()

  // ── "Real posts. Real people." ──
  ctx.save()
  ctx.font = "italic 34px Georgia, 'Times New Roman', serif"; ctx.fillStyle = "#c4b5fd"; ctx.textAlign = "center"
  ctx.fillText("Real posts.  Real people.", cx, y + 22)
  ctx.restore()
  y += 38

  // ── "Real Loop." in bold brush-script with curved underline swash ──
  ctx.save()
  const rlGrad = ctx.createLinearGradient(cx - 180, y, cx + 180, y)
  rlGrad.addColorStop(0, "#6366f1"); rlGrad.addColorStop(0.3, "#818cf8"); rlGrad.addColorStop(0.7, "#3b82f6"); rlGrad.addColorStop(1, "#6366f1")
  ctx.font = "italic bold 60px Georgia, 'Times New Roman', serif"; ctx.fillStyle = rlGrad; ctx.textAlign = "center"
  ctx.fillText("Real Loop.", cx, y + 48)
  // Curved underline swash
  ctx.strokeStyle = "#6366f1"; ctx.lineWidth = 3; ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(cx - 140, y + 58)
  ctx.bezierCurveTo(cx - 60, y + 72, cx + 60, y + 52, cx + 140, y + 65)
  ctx.stroke()
  ctx.restore()
  y += 82

  // ── Thin divider ──
  ctx.strokeStyle = "rgba(99,102,241,0.12)"; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(m + 40, y); ctx.lineTo(m + innerW - 40, y); ctx.stroke()
  y += 28

  // ── Post card with glowing gradient border ──
  const cardX = m + 20, cardW = innerW - 40
  // Calculate card height
  ctx.font = "28px system-ui, sans-serif"
  const bodyText = truncate(post.content || "Shared a loop", 350)
  const textH = drawTextWithQuotes(ctx, bodyText, 0, 0, cardW - 80, 28, "#cbd5e1", "#a78bfa") - 0
  const cardH = 50 + 65 + textH + 24 + 52 + 36 // padding + avatar + text + gap + stats + bottom pad

  // Glow border effect
  ctx.save()
  ctx.shadowColor = "rgba(99,102,241,0.4)"; ctx.shadowBlur = 20; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0
  roundRect(ctx, cardX, y, cardW, cardH, 24)
  ctx.strokeStyle = "rgba(139,92,246,0.5)"; ctx.lineWidth = 2; ctx.stroke()
  ctx.shadowBlur = 0
  // Inner gradient border
  const borderGrad = ctx.createLinearGradient(cardX, y, cardX + cardW, y + cardH)
  borderGrad.addColorStop(0, "rgba(139,92,246,0.3)"); borderGrad.addColorStop(0.5, "rgba(34,211,238,0.2)"); borderGrad.addColorStop(1, "rgba(99,102,241,0.3)")
  roundRect(ctx, cardX, y, cardW, cardH, 24)
  ctx.strokeStyle = borderGrad; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.restore()

  // Card fill
  roundRect(ctx, cardX, y, cardW, cardH, 24)
  ctx.fillStyle = "rgba(15,13,35,0.7)"; ctx.fill()

  // Avatar + name
  const aY = y + 28
  const avSize = 48
  // Gradient ring
  ctx.save()
  const ringG = ctx.createLinearGradient(cardX + 32, aY, cardX + 32 + avSize, aY + avSize)
  ringG.addColorStop(0, "#818cf8"); ringG.addColorStop(0.5, "#a78bfa"); ringG.addColorStop(1, "#67e8f9")
  ctx.beginPath(); ctx.arc(cardX + 32 + avSize / 2, aY + avSize / 2, avSize / 2 + 4, 0, Math.PI * 2); ctx.fillStyle = ringG; ctx.fill()
  ctx.restore()
  // Avatar clip
  ctx.save(); ctx.beginPath(); ctx.arc(cardX + 32 + avSize / 2, aY + avSize / 2, avSize / 2, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = "#334155"; ctx.fillRect(cardX + 32, aY, avSize, avSize)
  if (avatarSrc) {
    const { w, h } = avatarDimensions(avatarSrc); const sz = Math.min(w, h)
    ctx.drawImage(avatarSrc, (w - sz) / 2, (h - sz) / 2, sz, sz, cardX + 32, aY, avSize, avSize)
  } else {
    ctx.font = "bold 24px system-ui"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText((post.author.display_name || "U").charAt(0).toUpperCase(), cardX + 32 + avSize / 2, aY + avSize / 2 + 2)
  }
  ctx.restore()

  // Name
  const nameX = cardX + 32 + avSize + 14
  ctx.textAlign = "left"; ctx.font = "bold 24px system-ui, sans-serif"; ctx.fillStyle = "#f1f5f9"
  const name = truncate(post.author.display_name || post.author.username || "User", 24)
  ctx.fillText(name, nameX, aY + 22)
  ctx.font = "17px system-ui, sans-serif"; ctx.fillStyle = "#64748b"
  ctx.fillText(`@${truncate(post.author.username || "user", 28)}`, nameX, aY + 44)

  // Post text with quote highlighting
  const textY = aY + 70
  drawTextWithQuotes(ctx, bodyText, cardX + 32, textY, cardW - 64, 28, "#cbd5e1", "#a78bfa")
  const statsY = textY + textH + 16

  // Stats as pill badges
  const stats = [
    { icon: "heart", count: Number(post.stats?.likes_count || 0), bg: "rgba(244,114,182,0.15)", fg: "#f472b6" },
    { icon: "repost", count: Number(post.stats?.branches_count || 0), bg: "rgba(52,211,153,0.15)", fg: "#34d399" },
    { icon: "comment", count: Number(post.stats?.comments_count || 0), bg: "rgba(34,211,238,0.15)", fg: "#22d3ee" },
  ]
  let sx = cardX + 32
  for (const s of stats) {
    const label = formatCount(s.count)
    ctx.font = "600 18px system-ui, sans-serif"
    const pillW = 18 + 22 + ctx.measureText(label).width + 24
    roundRect(ctx, sx, statsY, pillW, 38, 19)
    ctx.fillStyle = s.bg; ctx.fill()
    // Icon
    const iconX = sx + 19, iconY = statsY + 19
    if (s.icon === "heart") {
      ctx.save(); ctx.fillStyle = s.fg; ctx.beginPath()
      ctx.moveTo(iconX, iconY + 5); ctx.bezierCurveTo(iconX, iconY - 1.5, iconX - 6, iconY - 0.8, iconX - 6, iconY + 5.5)
      ctx.bezierCurveTo(iconX - 6, iconY + 11, iconX - 0.8, iconY + 13, iconX, iconY + 16)
      ctx.bezierCurveTo(iconX + 0.8, iconY + 13, iconX + 6, iconY + 11, iconX + 6, iconY + 5.5)
      ctx.bezierCurveTo(iconX + 6, iconY - 0.8, iconX, iconY - 1.5, iconX, iconY + 5); ctx.fill(); ctx.restore()
    } else if (s.icon === "comment") {
      ctx.save(); ctx.fillStyle = s.fg; roundRect(ctx, iconX - 6, iconY - 5, 12, 9, 3); ctx.fill()
      ctx.beginPath(); ctx.moveTo(iconX - 2, iconY + 4); ctx.lineTo(iconX - 2, iconY + 7); ctx.lineTo(iconX + 1, iconY + 4); ctx.fill(); ctx.restore()
    } else {
      ctx.save(); ctx.strokeStyle = s.fg; ctx.lineWidth = 2; ctx.lineCap = "round"
      ctx.beginPath(); ctx.moveTo(iconX, iconY - 5); ctx.lineTo(iconX, iconY + 3); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(iconX - 5, iconY - 1); ctx.lineTo(iconX, iconY - 6); ctx.lineTo(iconX + 5, iconY - 1); ctx.stroke()
      ctx.restore()
    }
    ctx.font = "600 18px system-ui, sans-serif"; ctx.fillStyle = s.fg; ctx.textAlign = "left"; ctx.textBaseline = "middle"
    ctx.fillText(label, sx + 40, statsY + 20)
    sx += pillW + 12
  }
  y += cardH + 32

  // ── "Join the Loop" section with glow border ──
  const joinH = 200
  // Glow shadow
  ctx.save()
  ctx.shadowColor = "rgba(99,102,241,0.3)"; ctx.shadowBlur = 18
  roundRect(ctx, cardX, y, cardW, joinH, 24)
  ctx.fillStyle = "rgba(15,13,35,0.65)"; ctx.fill()
  ctx.shadowBlur = 0
  // Gradient border
  const jGrad = ctx.createLinearGradient(cardX, y, cardX + cardW, y)
  jGrad.addColorStop(0, "rgba(139,92,246,0.35)"); jGrad.addColorStop(0.5, "rgba(34,211,238,0.2)"); jGrad.addColorStop(1, "rgba(99,102,241,0.35)")
  roundRect(ctx, cardX, y, cardW, joinH, 24); ctx.strokeStyle = jGrad; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.restore()

  // "Join the Loop."
  ctx.font = "bold 38px system-ui, sans-serif"; ctx.fillStyle = "#f1f5f9"; ctx.textAlign = "left"
  ctx.fillText("Join the ", cardX + 28, y + 45)
  const jtw = ctx.measureText("Join the ").width
  ctx.fillStyle = "#818cf8"; ctx.fillText("Loop.", cardX + 28 + jtw, y + 45)

  // Feature icons — single row
  const features = [
    { emoji: "\u{1F465}", label: "Create together", sub: "with Co-Loop" },
    { emoji: "\u2694\uFE0F", label: "Challenge ideas", sub: "with Duels" },
    { emoji: "\u{1F4AC}", label: "Find your people", sub: "in Circles" },
    { emoji: "\u26A1", label: "Be part of", sub: "something real" },
  ]
  const featStartX = cardX + 28
  const featY = y + 80
  const featSpacing = (cardW - 200) / 4
  for (let i = 0; i < features.length; i++) {
    const fx = featStartX + i * featSpacing + featSpacing / 2
    ctx.font = "24px system-ui"; ctx.textAlign = "center"
    ctx.fillText(features[i].emoji, fx, featY + 10)
    ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0"
    ctx.fillText(features[i].label, fx, featY + 36)
    ctx.font = "10px system-ui, sans-serif"; ctx.fillStyle = "#7c83a4"
    ctx.fillText(features[i].sub, fx, featY + 52)
  }

  // QR Code
  const qrX = cardX + cardW - 175
  const qrY = y + 30
  const qrSize = 95
  ctx.save(); roundRect(ctx, qrX, qrY, qrSize, qrSize, 8); ctx.fillStyle = "#fff"; ctx.fill(); ctx.restore()
  // QR pattern
  ctx.save(); ctx.fillStyle = "#0f172a"
  const cellSize = qrSize / 10
  const drawCorner = (ox: number, oy: number) => { ctx.fillRect(ox, oy, cellSize * 3, cellSize); ctx.fillRect(ox, oy + cellSize * 2, cellSize * 3, cellSize); ctx.fillRect(ox, oy, cellSize, cellSize * 3); ctx.fillRect(ox + cellSize * 2, oy, cellSize, cellSize * 3) }
  drawCorner(qrX + 5, qrY + 5); drawCorner(qrX + qrSize - cellSize * 3 - 5, qrY + 5); drawCorner(qrX + 5, qrY + qrSize - cellSize * 3 - 5)
  const seed = post.id.charCodeAt(0) || 42
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) { if ((r < 3 && c < 3) || (r < 3 && c > 6) || (r > 6 && c < 3)) continue; if ((seed * (r * 10 + c + 1) * 7) % 3 === 0) ctx.fillRect(qrX + c * cellSize + 5, qrY + r * cellSize + 5, cellSize, cellSize) }
  ctx.restore()

  // "Download Loop" + "Scan Me" with arrow
  ctx.font = "bold 15px system-ui, sans-serif"; ctx.fillStyle = "#818cf8"; ctx.textAlign = "left"
  ctx.fillText("Download Loop", qrX + qrSize + 12, qrY + 15)
  ctx.font = "12px system-ui, sans-serif"; ctx.fillStyle = "#7c83a4"
  ctx.fillText("and start your journey.", qrX + qrSize + 12, qrY + 33)
  // "Scan Me" handwritten style with curved arrow
  ctx.save()
  ctx.font = "italic bold 14px Georgia, serif"; ctx.fillStyle = "#818cf8"
  ctx.fillText("Scan Me", qrX + qrSize + 12, qrY + 68)
  // Curved arrow pointing left to QR code
  ctx.strokeStyle = "#818cf8"; ctx.lineWidth = 2; ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(qrX + qrSize + 8, qrY + 62)
  ctx.bezierCurveTo(qrX + qrSize + 4, qrY + 56, qrX + qrSize - 8, qrY + 58, qrX + qrSize - 14, qrY + 65)
  ctx.stroke()
  // Arrowhead
  ctx.beginPath(); ctx.moveTo(qrX + qrSize - 14, qrY + 65); ctx.lineTo(qrX + qrSize - 8, qrY + 60); ctx.moveTo(qrX + qrSize - 14, qrY + 65); ctx.lineTo(qrX + qrSize - 18, qrY + 60)
  ctx.stroke()
  ctx.restore()

  // ── Footer ──
  y = CARD_HEIGHT - m - 30
  ctx.strokeStyle = "rgba(99,102,241,0.1)"; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(m + 40, y); ctx.lineTo(m + innerW - 40, y); ctx.stroke()
  y += 22
  ctx.font = "16px system-ui, sans-serif"; ctx.fillStyle = "#4a5072"; ctx.textAlign = "center"
  ctx.fillText(`\uD83C\uDF10  www.${DOMAIN}`, cx, y + 10)

  // Bottom glow
  const bGlow = ctx.createRadialGradient(cx, CARD_HEIGHT, 0, cx, CARD_HEIGHT, 350)
  bGlow.addColorStop(0, "rgba(99,102,241,0.06)"); bGlow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = bGlow; ctx.fillRect(0, CARD_HEIGHT - 350, CARD_WIDTH, 350)
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => { canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas empty"))), "image/jpeg", quality) })
}

/* ── JSX Preview ── */
function ShareCardPreview({ post }: { post: ShareAsImageModalProps["post"] }) {
  const name = truncate(post.author.display_name || post.author.username || "User", 24)
  // Parse quoted text for highlighting
  const renderContent = (text: string) => {
    const parts = text.split(/("[^"]*"|"[^"]*")/)
    return parts.map((part, i) => {
      if (!part) return null
      const isQuote = part.startsWith('"') || part.startsWith("\u201C")
      return isQuote ? (
        <span key={i} className="text-violet-400 font-semibold">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    })
  }
  const stats = [
    { icon: Heart, count: Number(post.stats?.likes_count || 0), bg: "bg-pink-500/15", fg: "text-pink-400" },
    { icon: GitBranch, count: Number(post.stats?.branches_count || 0), bg: "bg-emerald-500/15", fg: "text-emerald-400" },
    { icon: MessageCircle, count: Number(post.stats?.comments_count || 0), bg: "bg-cyan-500/15", fg: "text-cyan-400" },
  ]

  return (
    <div
      className="relative w-full aspect-[4/5] select-none overflow-hidden rounded-xl text-left"
      style={{ background: "linear-gradient(160deg, #0b0920 0%, #0e0c28 50%, #080618 100%)" }}
    >
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Center radial glow */}
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-indigo-500/[0.06] blur-3xl" />

      {/* Outer glow border */}
      <div className="absolute inset-0 rounded-xl" style={{ boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.15), inset 0 0 30px rgba(99,102,241,0.03)" }} />

      {/* Inner panel */}
      <div className="absolute inset-x-[6%] top-[4%] bottom-[4%] overflow-hidden rounded-3xl border border-indigo-500/10 bg-[#0d0b22]/80" />

      {/* Content */}
      <div className="absolute inset-x-[10%] top-[calc(4%+4px)] bottom-[4%] flex flex-col py-[3%]">
        {/* Logo lockup — icon inline with wordmark */}
        <div className="flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
            <img src="/icons/icon.svg" alt="Loop" className="h-full w-full object-contain" />
          </span>
          <span className="text-[28px] font-bold text-slate-100 tracking-tight">Loop</span>
        </div>
        <p className="mt-1 text-center text-[15px] font-medium text-indigo-400">Build together.</p>
        <p className="text-center text-[13px] text-[#7c83a4]">Not just post into the void.</p>

        {/* Hand-drawn accent marks */}
        <div className="relative mt-3 flex items-center justify-center">
          {/* Left squiggles */}
          <svg className="absolute left-[calc(50%-260px)] top-0 h-6 w-8 text-violet-400/50" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M4 20 C8 8, 18 4, 14 18" />
            <path d="M8 22 C14 12, 22 10, 18 22" />
          </svg>
          <p className="font-[Georgia] text-[26px] italic text-violet-300">Real posts.  Real people.</p>
          {/* Right squiggles */}
          <svg className="absolute right-[calc(50%-260px)] top-0 h-6 w-8 text-cyan-400/40" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M28 20 C24 8, 14 4, 18 18" />
            <path d="M24 22 C18 12, 10 10, 14 22" />
          </svg>
        </div>

        {/* "Real Loop." — bold brush script with curved underline swash */}
        <div className="relative text-center">
          <p className="font-[Georgia] text-[48px] italic font-bold bg-gradient-to-r from-indigo-500 via-indigo-400 to-blue-400 bg-clip-text text-transparent leading-tight">
            Real Loop.
          </p>
          {/* Curved underline swash */}
          <svg className="mx-auto -mt-1 h-3 w-[220px]" viewBox="0 0 220 12" fill="none">
            <path d="M10 8 C60 2, 160 12, 210 4" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        <div className="my-3 h-px w-full bg-indigo-500/10" />

        {/* Post Card with glowing gradient border */}
        <div className="rounded-2xl border border-transparent p-[1.5px]" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.4), rgba(34,211,238,0.25), rgba(99,102,241,0.4))" }}>
          <div className="rounded-[15px] bg-[#0d0b22]/90 p-5">
            {/* Author */}
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-[2px]" style={{ background: "linear-gradient(135deg, #818cf8, #a78bfa, #67e8f9)" }}>
                <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-slate-700 text-slate-200 text-base font-bold">
                  {post.author.avatar_url ? (
                    <img src={`/api/image-proxy?url=${encodeURIComponent(post.author.avatar_url)}`} alt="" className="h-full w-full object-cover" />
                  ) : name.charAt(0).toUpperCase()}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-slate-100">{name}</p>
                <p className="truncate text-[11px] text-[#64748b]">@{truncate(post.author.username || "user", 28)}</p>
              </div>
            </div>
            {/* Body with quote highlighting */}
            <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-slate-300 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:5] overflow-hidden">
              {renderContent(truncate(post.content || "Shared a loop", 350))}
            </p>
            {/* Stats as pills */}
            {stats.some((s) => s.count > 0) && (
              <div className="mt-3 flex items-center gap-2">
                {stats.filter((s) => s.count > 0).map(({ icon: Icon, count, bg, fg }, i) => (
                  <span key={i} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${bg} ${fg}`}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                    {formatCount(count)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1" />

        {/* "Join the Loop" section with glow border */}
        <div className="rounded-2xl border border-transparent p-[1.5px]" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.35), rgba(34,211,238,0.2), rgba(99,102,241,0.35))" }}>
          <div className="rounded-[15px] bg-[#0d0b22]/80 p-5">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-[20px] font-bold text-slate-100">
                  Join the <span className="text-indigo-400">Loop.</span>
                </p>
                <div className="mt-3 grid grid-cols-4 gap-1">
                  {[
                    { emoji: "\u{1F465}", label: "Create together", sub: "with Co-Loop" },
                    { emoji: "\u2694\uFE0F", label: "Challenge ideas", sub: "with Duels" },
                    { emoji: "\u{1F4AC}", label: "Find your people", sub: "in Circles" },
                    { emoji: "\u26A1", label: "Be part of", sub: "something real" },
                  ].map((f, i) => (
                    <div key={i} className="text-center">
                      <span className="text-lg">{f.emoji}</span>
                      <p className="text-[9px] font-bold text-slate-200 leading-tight">{f.label}</p>
                      <p className="text-[7px] text-[#7c83a4] leading-tight">{f.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-center">
                <p className="text-[11px] font-bold text-indigo-400">Download Loop</p>
                <p className="text-[8px] text-[#7c83a4]">and start your journey.</p>
                <div className="mt-1 h-[72px] w-[72px] rounded-lg bg-white p-0.5">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(SITE_URL)}&bgcolor=ffffff&color=0f172a`}
                    alt="QR Code" className="h-full w-full" loading="lazy"
                  />
                </div>
                {/* "Scan Me" with curved arrow */}
                <div className="relative mt-1">
                  <svg className="absolute -left-2 -top-6 h-8 w-12 text-indigo-400/70" viewBox="0 0 48 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M36 4 C28 8, 16 14, 8 22" />
                    <path d="M8 22 L14 18" />
                    <path d="M8 22 L12 28" />
                  </svg>
                  <p className="font-[Georgia] text-[13px] italic font-bold text-indigo-400">Scan Me</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-[#4a5072]">
          <Globe className="h-3 w-3" />
          www.{DOMAIN}
        </div>
      </div>

      {/* Bottom glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-32 w-[70%] rounded-full bg-indigo-500/[0.05] blur-3xl" />
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
    () => [post.id, post.content, post.author.username, post.author.display_name, post.author.avatar_url, post.stats?.likes_count ?? "", post.stats?.comments_count ?? "", post.stats?.branches_count ?? ""].join("|"),
    [post.id, post.content, post.author.username, post.author.display_name, post.author.avatar_url, post.stats?.likes_count, post.stats?.comments_count, post.stats?.branches_count],
  )

  useEffect(() => {
    if (!open) { setRendered(false); setExporting(false); cachedBlobRef.current = null; avatarRef.current = null; return }
    const gen = ++generationRef.current; let cancelled = false; setRendered(false)
    const generate = async () => {
      const canvas = exportCanvasRef.current; if (!canvas) return
      try {
        await loadLogo()
        drawCard(canvas, post, EXPORT_SCALE, avatarRef.current)
        if (cancelled || gen !== generationRef.current) return
        cachedBlobRef.current = await canvasToJpegBlob(canvas, 0.92); setRendered(true)
        const avatar = post.author.avatar_url ? await loadAvatar(`/api/image-proxy?url=${encodeURIComponent(post.author.avatar_url)}`) : null
        if (cancelled || gen !== generationRef.current) return
        avatarRef.current = avatar
        drawCard(canvas, post, EXPORT_SCALE, avatar)
        const blob2 = await canvasToJpegBlob(canvas, 0.92)
        if (cancelled || gen !== generationRef.current) return
        cachedBlobRef.current = blob2
      } catch (error) { console.error("Share card error:", error); if (!cancelled) setRendered(false) }
    }
    const run = () => void generate()
    if (typeof requestIdleCallback === "function") { const id = requestIdleCallback(run, { timeout: 1500 }); return () => { cancelled = true; cancelIdleCallback(id) } }
    const t = window.setTimeout(run, 80); return () => { cancelled = true; clearTimeout(t) }
  }, [open, renderKey])

  const getExportBlob = async (): Promise<Blob> => {
    if (cachedBlobRef.current) return cachedBlobRef.current
    const canvas = exportCanvasRef.current; if (!canvas) throw new Error("Canvas not ready")
    drawCard(canvas, post, EXPORT_SCALE, avatarRef.current)
    const blob = await canvasToJpegBlob(canvas, 0.92); cachedBlobRef.current = blob; return blob
  }

  const download = async () => {
    if (exporting) return; setExporting(true)
    try {
      const blob = await getExportBlob(); const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = `loop-${post.id}.jpg`; a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast({ title: "Image downloaded", description: "Share it anywhere." })
    } catch (error: any) { toast({ title: "Download failed", description: error?.message || "Unknown error", variant: "destructive" })
    } finally { setExporting(false) }
  }

  const shareNative = async () => {
    try {
      const blob = await getExportBlob(); const file = new File([blob], `loop-${post.id}.jpg`, { type: "image/jpeg" })
      if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "Loop", text: post.content.slice(0, 120) }); toast({ title: "Shared!" }) }
      else { await download() }
    } catch (error: any) { if (error?.name === "AbortError") return; toast({ title: "Couldn't share", description: error.message || "Unknown error", variant: "destructive" }) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Share2 className="h-4 w-4 text-indigo-400" /> Share as image
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">A branded share card — perfect for X, Instagram, or anywhere else.</DialogDescription>
        </DialogHeader>
        <canvas ref={exportCanvasRef} className="hidden" />
        <div className="relative w-full overflow-hidden rounded-xl border border-border shadow-lg">
          <ShareCardPreview post={post} />
          {!rendered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/70 backdrop-blur-[1px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Preparing high-res image…</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => void download()} disabled={exporting} className="border-border bg-background text-foreground hover:bg-muted">
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} Download
          </Button>
          <Button onClick={() => void shareNative()} className="bg-indigo-600 text-white hover:bg-indigo-700">
            <Share2 className="mr-1.5 h-4 w-4" /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
