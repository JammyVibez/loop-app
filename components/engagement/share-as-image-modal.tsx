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
  Share2 as ShareIcon,
  Crown,
  Zap,
  ShieldCheck,
  Play,
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

export type ShareCardTheme = "dark" | "light"

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1080
const MEDIA_CARD_HEIGHT = 1350
const EXPORT_SCALE = 1.6
const BRAND = "#6366f1"
const DOMAIN = "loopapp.me"
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

/* ── Palette ── */

interface CardPalette {
  bg: [string, string, string]
  cardBg: string
  cardBorder: string
  glowPrimary: string
  glowSecondary: string
  glowAccent: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accentA: string
  accentB: string
  accentC: string
  statBg: string
  statText: string
  statIcon: string
  logoFg: string
  footerSub: string
  divider: string
  mediaBg: string
}

function paletteFor(theme: ShareCardTheme): CardPalette {
  if (theme === "light") {
    return {
      bg: ["#0f0a2e", "#1a1145", "#0d0b2e"],
      cardBg: "rgba(255,255,255,0.92)",
      cardBorder: "rgba(255,255,255,0.3)",
      glowPrimary: "rgba(99,102,241,0.35)",
      glowSecondary: "rgba(168,85,247,0.25)",
      glowAccent: "rgba(34,211,238,0.2)",
      textPrimary: "#0f172a",
      textSecondary: "#334155",
      textMuted: "#64748b",
      accentA: "#6366f1",
      accentB: "#a855f7",
      accentC: "#22d3ee",
      statBg: "rgba(99,102,241,0.08)",
      statText: "#4f46e5",
      statIcon: "#6366f1",
      logoFg: "#ffffff",
      footerSub: "rgba(99,102,241,0.6)",
      divider: "rgba(99,102,241,0.12)",
      mediaBg: "#e2e8f0",
    }
  }
  return {
    bg: ["#0f0a2e", "#1a1145", "#0d0b2e"],
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(255,255,255,0.1)",
    glowPrimary: "rgba(99,102,241,0.35)",
    glowSecondary: "rgba(168,85,247,0.25)",
    glowAccent: "rgba(34,211,238,0.2)",
    textPrimary: "#f1f5f9",
    textSecondary: "#e2e8f0",
    textMuted: "#94a3b8",
    accentA: "#818cf8",
    accentB: "#c084fc",
    accentC: "#67e8f9",
    statBg: "rgba(129,140,248,0.12)",
    statText: "#c7d2fe",
    statIcon: "#818cf8",
    logoFg: "#ffffff",
    footerSub: "rgba(148,163,184,0.6)",
    divider: "rgba(255,255,255,0.08)",
    mediaBg: "#1e293b",
  }
}

/* ── Avatar loading ── */

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

function setupCanvas(canvas: HTMLCanvasElement, scale: number, height = CARD_HEIGHT) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  canvas.width = Math.round(CARD_WIDTH * scale)
  canvas.height = Math.round(height * scale)
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  return ctx
}

/* ── Vector stat icons ── */

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

function drawBranchIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size
  const r = s * 0.14
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(2, s * 0.09)
  ctx.lineCap = "round"
  ctx.beginPath(); ctx.arc(x, y - s * 0.34, r, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(x - s * 0.34, y + s * 0.36, r, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(x + s * 0.34, y + s * 0.36, r, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.2); ctx.lineTo(x, y - s * 0.06); ctx.lineTo(x - s * 0.24, y + s * 0.22); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.06); ctx.lineTo(x + s * 0.24, y + s * 0.22); ctx.stroke()
  ctx.restore()
}

function drawShareIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(2, s * 0.09)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.beginPath(); ctx.moveTo(x + s * 0.04, y - s * 0.28); ctx.lineTo(x + s * 0.04, y + s * 0.18); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x - s * 0.16, y - s * 0.1); ctx.lineTo(x + s * 0.04, y - s * 0.3); ctx.lineTo(x + s * 0.24, y - s * 0.1); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x - s * 0.36, y + s * 0.34); ctx.lineTo(x + s * 0.36, y + s * 0.34); ctx.stroke()
  ctx.restore()
}

/* ── Badge glyphs ── */

function drawCrownGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath()
  ctx.moveTo(cx - s * 0.7, cy + s * 0.5); ctx.lineTo(cx - s * 0.7, cy - s * 0.2)
  ctx.lineTo(cx - s * 0.35, cy + s * 0.1); ctx.lineTo(cx, cy - s * 0.5)
  ctx.lineTo(cx + s * 0.35, cy + s * 0.1); ctx.lineTo(cx + s * 0.7, cy - s * 0.2)
  ctx.lineTo(cx + s * 0.7, cy + s * 0.5); ctx.closePath(); ctx.fill(); ctx.restore()
}

function drawStarGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? s * 0.5 : s * 0.22
    const a = (Math.PI / 5) * i - Math.PI / 2
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.closePath(); ctx.fill(); ctx.restore()
}

function drawShieldGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath()
  ctx.moveTo(cx - s * 0.55, cy - s * 0.6); ctx.lineTo(cx + s * 0.55, cy - s * 0.6)
  ctx.lineTo(cx + s * 0.55, cy + s * 0.05)
  ctx.quadraticCurveTo(cx + s * 0.55, cy + s * 0.5, cx, cy + s * 0.68)
  ctx.quadraticCurveTo(cx - s * 0.55, cy + s * 0.5, cx - s * 0.55, cy + s * 0.05)
  ctx.closePath(); ctx.fill(); ctx.restore()
}

function drawPlayGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath()
  ctx.moveTo(cx - s * 0.32, cy - s * 0.45); ctx.lineTo(cx + s * 0.42, cy); ctx.lineTo(cx - s * 0.32, cy + s * 0.45)
  ctx.closePath(); ctx.fill(); ctx.restore()
}

/* ── Canvas card drawing ── */

interface DrawStats { likes: number; comments: number; branches: number; shares: number }

function drawCardBase(
  canvas: HTMLCanvasElement,
  post: ShareAsImageModalProps["post"],
  scale: number,
  avatarSrc: AvatarSource | null,
  theme: ShareCardTheme,
  mediaSrc: AvatarSource | null = null,
) {
  const hasMedia = Boolean(post.media_url)
  const cardH = hasMedia ? MEDIA_CARD_HEIGHT : CARD_HEIGHT
  const ctx = setupCanvas(canvas, scale, cardH)
  if (!ctx) return
  const pal = paletteFor(theme)
  const margin = 80
  const innerW = CARD_WIDTH - margin * 2

  // ── Full-bleed gradient background ──
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH * 0.6, cardH)
  bg.addColorStop(0, pal.bg[0]); bg.addColorStop(0.5, pal.bg[1]); bg.addColorStop(1, pal.bg[2])
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CARD_WIDTH, cardH)

  // ── Gradient mesh blobs ──
  const addBlob = (cx: number, cy: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = g; ctx.fillRect(0, 0, CARD_WIDTH, cardH)
  }
  // Geometric corner accents instead of gradient blobs
  ctx.save()
  ctx.strokeStyle = pal.glowPrimary; ctx.lineWidth = 2; ctx.globalAlpha = 0.3
  const cornerS = 120
  // Top-right corner geometric
  ctx.beginPath(); ctx.moveTo(cardH * 0.05, cardH * 0.05); ctx.lineTo(cardH * 0.05 + cornerS, cardH * 0.05); ctx.lineTo(cardH * 0.05, cardH * 0.05 + cornerS); ctx.closePath(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cardH * 0.1, cardH * 0.1); ctx.lineTo(cardH * 0.1 + cornerS * 0.6, cardH * 0.1); ctx.lineTo(cardH * 0.1, cardH * 0.1 + cornerS * 0.6); ctx.closePath(); ctx.stroke()
  // Bottom-left corner
  ctx.strokeStyle = pal.glowSecondary
  ctx.beginPath(); ctx.moveTo(CARD_WIDTH - cardH * 0.05, cardH - cardH * 0.05); ctx.lineTo(CARD_WIDTH - cardH * 0.05 - cornerS, cardH - cardH * 0.05); ctx.lineTo(CARD_WIDTH - cardH * 0.05, cardH - cardH * 0.05 - cornerS); ctx.closePath(); ctx.stroke()
  ctx.restore()

  // ── Frosted-glass card panel ──
  const panelX = margin, panelY = margin, panelW = innerW, panelH = cardH - margin * 2, panelR = 40
  ctx.save()
  roundRect(ctx, panelX, panelY, panelW, panelH, panelR)
  ctx.fillStyle = pal.cardBg; ctx.fill()
  ctx.strokeStyle = pal.cardBorder; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.restore()

  // ── Top accent gradient stripe ──
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(panelX + panelR, panelY)
  ctx.arcTo(panelX + panelW, panelY, panelX + panelW, panelY + 6, panelR)
  ctx.lineTo(panelX + panelW, panelY + 6); ctx.lineTo(panelX, panelY + 6)
  ctx.arcTo(panelX, panelY, panelX + panelR, panelY, panelR)
  ctx.closePath()
  const stripe = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY)
  stripe.addColorStop(0, pal.accentA); stripe.addColorStop(0.5, pal.accentB); stripe.addColorStop(1, pal.accentC)
  ctx.fillStyle = stripe; ctx.fill()
  ctx.restore()

  const contentX = panelX + 60
  const contentMaxW = panelW - 120
  let yCursor = panelY + 80

  // ── Logo at top center ──
  const logoSize = 60
  const logoCX = CARD_WIDTH / 2 - logoSize / 2
  ctx.save()
  roundRect(ctx, logoCX, yCursor - 10, logoSize, logoSize, 16)
  ctx.clip()
  const logoImg = cachedLogoImg
  if (logoImg) {
    ctx.drawImage(logoImg, logoCX, yCursor - 10, logoSize, logoSize)
  } else {
    const lb = ctx.createLinearGradient(logoCX, yCursor - 10, logoCX + logoSize, yCursor + logoSize - 10)
    lb.addColorStop(0, pal.accentA); lb.addColorStop(1, pal.accentB)
    ctx.fillStyle = lb; ctx.fillRect(logoCX, yCursor - 10, logoSize, logoSize)
    ctx.fillStyle = pal.logoFg; ctx.font = "bold 36px system-ui, sans-serif"
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("L", logoCX + logoSize / 2, yCursor + logoSize / 2 - 10)
  }
  ctx.restore()
  yCursor += logoSize + 40

  // ── Divider ──
  ctx.strokeStyle = pal.divider; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(contentX, yCursor); ctx.lineTo(contentX + contentMaxW, yCursor); ctx.stroke()
  yCursor += 40

  // ── Author row ──
  const avatarSize = 100
  const avatarCY = yCursor + avatarSize / 2
  const avatarCX = contentX + avatarSize / 2

  // Gradient ring
  ctx.save()
  const ringGrad = ctx.createLinearGradient(contentX, yCursor, contentX + avatarSize, yCursor + avatarSize)
  ringGrad.addColorStop(0, pal.accentA); ringGrad.addColorStop(0.5, pal.accentB); ringGrad.addColorStop(1, pal.accentC)
  ctx.beginPath(); ctx.arc(avatarCX, avatarCY, avatarSize / 2 + 6, 0, Math.PI * 2)
  ctx.fillStyle = ringGrad; ctx.fill()
  ctx.restore()

  // Avatar clip
  ctx.save()
  ctx.beginPath(); ctx.arc(avatarCX, avatarCY, avatarSize / 2, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = "rgba(100,116,139,0.3)"; ctx.fillRect(contentX, yCursor, avatarSize, avatarSize)
  if (avatarSrc) {
    const { w, h } = avatarDimensions(avatarSrc)
    const size = Math.min(w, h)
    ctx.drawImage(avatarSrc, (w - size) / 2, (h - size) / 2, size, size, contentX, yCursor, avatarSize, avatarSize)
  } else {
    ctx.font = "bold 48px system-ui, sans-serif"; ctx.fillStyle = pal.textPrimary
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText((post.author.display_name || "U").charAt(0).toUpperCase(), avatarCX, avatarCY + 2)
  }
  ctx.restore()

  // Name + badges
  const nameX = contentX + avatarSize + 30
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"
  ctx.font = "bold 40px system-ui, sans-serif"; ctx.fillStyle = pal.textPrimary
  const name = truncate(post.author.display_name || post.author.username || "User", 24)
  ctx.fillText(name, nameX, yCursor + 42)

  const chipY = yCursor + 42 - 28
  const chipR = 18
  let chipX = nameX + ctx.measureText(name).width + 18
  const chips: Array<{ bg: string; fg: string; glyph: (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, c: string) => void }> = []
  if (post.author.is_verified) chips.push({ bg: pal.accentC, fg: "#0f172a", glyph: (c, cx, cy, s, col) => {
    c.save(); c.fillStyle = col; c.font = `bold ${Math.round(s * 1.1)}px system-ui`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("✓", cx, cy + s * 0.05); c.restore()
  }})
  if (post.author.is_premium) chips.push({ bg: "#f59e0b", fg: "#fff", glyph: drawCrownGlyph })
  if (post.author.is_sponsor) chips.push({ bg: "#fbbf24", fg: "#78350f", glyph: drawStarGlyph })
  if (post.author.is_team) chips.push({ bg: pal.accentA, fg: "#fff", glyph: drawShieldGlyph })
  for (const chip of chips) {
    if (chipX + chipR * 2 > contentX + contentMaxW) break
    ctx.save()
    ctx.beginPath(); ctx.arc(chipX + chipR, chipY, chipR, 0, Math.PI * 2)
    ctx.fillStyle = chip.bg; ctx.fill()
    chip.glyph(ctx, chipX + chipR, chipY, chipR * 0.7, chip.fg)
    chipX += chipR * 2 + 8
  }

  ctx.font = "normal 28px system-ui, sans-serif"; ctx.fillStyle = pal.textMuted
  ctx.fillText(`@${truncate(post.author.username || "user", 28)}`, nameX, yCursor + 76)
  yCursor += avatarSize + 30

  // ── Post text ──
  const maxLines = hasMedia ? 4 : 8
  const bodyText = truncate(post.content || "Shared a loop", 420)
  ctx.font = "normal 40px system-ui, sans-serif"; ctx.fillStyle = pal.textSecondary
  const words = bodyText.split(" ")
  const lines: string[] = []
  let ln = ""
  for (const word of words) {
    const test = ln ? `${ln} ${word}` : word
    if (ctx.measureText(test).width > contentMaxW && ln) { lines.push(ln); ln = word } else { ln = test }
    if (lines.length >= maxLines) break
  }
  if (ln && lines.length < maxLines) lines.push(ln)
  for (const l of lines.slice(0, maxLines)) {
    ctx.fillText(l, contentX, yCursor); yCursor += 56
  }
  yCursor += 20

  // ── Media band ──
  if (hasMedia) {
    const mediaW = contentMaxW, mediaH = 260
    ctx.save()
    roundRect(ctx, contentX, yCursor, mediaW, mediaH, 24); ctx.clip()
    ctx.fillStyle = pal.mediaBg; ctx.fillRect(contentX, yCursor, mediaW, mediaH)
    if (mediaSrc) {
      const { w, h } = avatarDimensions(mediaSrc)
      const cover = Math.max(mediaW / w, mediaH / h)
      ctx.drawImage(mediaSrc, (w - w * cover) / 2, (h - h * cover) / 2, w * cover, h * cover, contentX, yCursor, mediaW, mediaH)
    } else if (post.media_type === "video") {
      drawPlayGlyph(ctx, contentX + mediaW / 2, yCursor + mediaH / 2, 56, "rgba(255,255,255,0.9)")
    }
    ctx.restore()
    ctx.strokeStyle = pal.divider; ctx.lineWidth = 1
    roundRect(ctx, contentX, yCursor, mediaW, mediaH, 24); ctx.stroke()
    yCursor += mediaH + 30
  }

  // ── Bottom area: stats + branding ──
  yCursor = panelY + panelH - 220

  // Stats pill chips
  const stats: DrawStats = {
    likes: Number(post.stats?.likes_count || 0),
    comments: Number(post.stats?.comments_count || 0),
    branches: Number(post.stats?.branches_count || 0),
    shares: Number(post.stats?.shares_count || 0),
  }
  const statItems = [
    { icon: drawHeartIcon, count: stats.likes },
    { icon: drawCommentIcon, count: stats.comments },
    { icon: drawBranchIcon, count: stats.branches },
    { icon: drawShareIcon, count: stats.shares },
  ]
  if (stats.likes + stats.comments + stats.branches + stats.shares > 0) {
    let sx = contentX
    const iconSz = 30
    for (const item of statItems) {
      if (item.count === 0) continue
      const label = formatCount(item.count)
      const pillW = iconSz + 18 + ctx.measureText(label).width + 28
      roundRect(ctx, sx, yCursor, pillW, 50, 25)
      ctx.fillStyle = pal.statBg; ctx.fill()
      item.icon(ctx, sx + iconSz / 2 + 12, yCursor + 25, iconSz, pal.statIcon)
      ctx.font = "600 28px system-ui, sans-serif"; ctx.fillStyle = pal.statText
      ctx.textAlign = "left"; ctx.textBaseline = "middle"
      ctx.fillText(label, sx + iconSz + 22, yCursor + 26)
      sx += pillW + 14
    }
    yCursor += 72
  }

  // Branding bar
  ctx.strokeStyle = pal.divider; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(contentX, yCursor); ctx.lineTo(contentX + contentMaxW, yCursor); ctx.stroke()
  yCursor += 28

  ctx.save()
  roundRect(ctx, contentX, yCursor, 44, 44, 12); ctx.clip()
  if (logoImg) {
    ctx.drawImage(logoImg, contentX, yCursor, 44, 44)
  } else {
    const lb2 = ctx.createLinearGradient(contentX, yCursor, contentX + 44, yCursor + 44)
    lb2.addColorStop(0, pal.accentA); lb2.addColorStop(1, pal.accentB)
    ctx.fillStyle = lb2; ctx.fillRect(contentX, yCursor, 44, 44)
    ctx.fillStyle = pal.logoFg; ctx.font = "bold 28px system-ui"
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("L", contentX + 22, yCursor + 24)
  }
  ctx.restore()

  ctx.font = "bold 30px system-ui, sans-serif"; ctx.fillStyle = pal.textPrimary
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"
  ctx.fillText("Loop", contentX + 58, yCursor + 30)
  ctx.font = "normal 22px system-ui, sans-serif"; ctx.fillStyle = pal.footerSub
  ctx.fillText("Build together. Not just post into the void.", contentX + 58, yCursor + 56)
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas empty"))), "image/jpeg", quality)
  })
}

/* ── JSX preview ── */

function ShareCardPreview({ post, theme }: { post: ShareAsImageModalProps["post"]; theme: ShareCardTheme }) {
  const name = truncate(post.author.display_name || post.author.username || "User", 24)
  const bodyText = truncate(post.content || "Shared a loop", 420)
  const dark = theme === "dark"
  const hasMedia = Boolean(post.media_url)

  const stats = [
    { icon: Heart, count: Number(post.stats?.likes_count || 0) },
    { icon: MessageCircle, count: Number(post.stats?.comments_count || 0) },
    { icon: GitBranch, count: Number(post.stats?.branches_count || 0) },
    { icon: ShareIcon, count: Number(post.stats?.shares_count || 0) },
  ]
  const hasStats = stats.some((s) => s.count > 0)

  return (
    <div
      className={`relative w-full select-none overflow-hidden rounded-xl text-left ${hasMedia ? "aspect-[4/5]" : "aspect-square"}`}
      style={{
        background: "linear-gradient(140deg, #0f0a2e 0%, #1a1145 50%, #0d0b2e 100%)",
        containerType: "inline-size",
      }}
    >
      {/* Geometric accent pattern */}
      <div className="absolute top-0 right-0 h-1/3 w-1/3 overflow-hidden opacity-20">
        <div className="absolute -top-8 -right-8 h-32 w-32 rotate-45 border-2 border-indigo-400/40" />
        <div className="absolute top-8 right-4 h-24 w-24 rotate-12 border border-violet-400/30" />
        <div className="absolute top-16 right-12 h-16 w-16 rotate-45 border border-cyan-400/20" />
      </div>
      <div className="absolute bottom-0 left-0 h-1/4 w-1/4 overflow-hidden opacity-15">
        <div className="absolute -bottom-6 -left-6 h-28 w-28 -rotate-12 border-2 border-indigo-400/30" />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] opacity-[0.04]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      {/* Glass card */}
      <div
        className="absolute inset-x-[7%] top-[7%] bottom-[7%] overflow-hidden rounded-3xl border"
        style={{
          background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.92)",
          borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.3)",
        }}
      >
        {/* Top accent stripe */}
        <div
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, #6366f1, #a855f7, #22d3ee)" }}
        />
      </div>

      {/* Content inside glass card */}
      <div className="absolute inset-x-[12%] top-[calc(7%+8px)] bottom-[7%] flex flex-col py-[6%]">
        {/* Logo */}
        <div className="flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
            <img src="/icons/icon.svg" alt="Loop" className="h-full w-full object-contain" />
          </span>
        </div>

        <div className="my-3 h-px w-full" style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.12)" }} />

        {/* Author */}
        <div className="flex items-center gap-3">
          <span className="flex h-[10cqw] w-[10cqw] shrink-0 items-center justify-center rounded-full p-[3%]" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7, #22d3ee)" }}>
            <span className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-full text-[6cqw] font-bold ${dark ? "bg-slate-700 text-slate-200" : "bg-white text-slate-700"}`}>
              {post.author.avatar_url ? (
                <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              ) : name.charAt(0).toUpperCase()}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className={`flex items-center gap-1.5 truncate text-[clamp(11px,3cqw,22px)] font-bold leading-tight ${dark ? "text-slate-50" : "text-slate-900"}`}>
              <span className="truncate">{name}</span>
              {post.author.is_verified && (
                <span className={`flex h-[1.2em] w-[1.2em] shrink-0 items-center justify-center rounded-full text-[0.8em] font-bold ${dark ? "bg-cyan-400 text-slate-900" : "bg-cyan-400 text-white"}`}>✓</span>
              )}
              {post.author.is_premium && (
                <span title="Pro" className="flex h-[1.2em] w-[1.2em] shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-amber-950">
                  <Crown className="h-[0.7em] w-[0.7em]" fill="currentColor" />
                </span>
              )}
              {post.author.is_sponsor && (
                <span title="Sponsor" className="flex h-[1.2em] w-[1.2em] shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-orange-400 text-amber-950">
                  <Zap className="h-[0.7em] w-[0.7em]" fill="currentColor" />
                </span>
              )}
              {post.author.is_team && (
                <span title="Team" className="flex h-[1.2em] w-[1.2em] shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white">
                  <ShieldCheck className="h-[0.7em] w-[0.7em]" fill="currentColor" />
                </span>
              )}
            </p>
            <p className={`truncate text-[clamp(9px,2.2cqw,15px)] ${dark ? "text-slate-400" : "text-slate-500"}`}>@{truncate(post.author.username || "user", 28)}</p>
          </div>
        </div>

        {/* Body text */}
        <p className={`${hasMedia ? "mt-3" : "mt-4"} whitespace-pre-line text-[clamp(11px,3.2cqw,22px)] leading-relaxed [display:-webkit-box] [-webkit-box-orient:vertical] ${hasMedia ? "[-webkit-line-clamp:4]" : "[-webkit-line-clamp:8]"} overflow-hidden ${dark ? "text-slate-200" : "text-slate-700"}`}>
          {bodyText}
        </p>

        {/* Media thumbnail */}
        {hasMedia && post.media_url && (
          <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10">
            <img src={optimizeImageUrl(post.media_url, 800) || post.media_url} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" decoding="async" />
            {post.media_type === "video" && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                  <Play className="h-7 w-7 text-white" fill="currentColor" />
                </span>
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Stats as pills */}
        {hasStats && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {stats.filter((s) => s.count > 0).map(({ icon: Icon, count }, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[clamp(9px,2.2cqw,15px)] font-semibold"
                style={{ background: dark ? "rgba(129,140,248,0.12)" : "rgba(99,102,241,0.08)" }}
              >
                <Icon className={`h-[clamp(11px,2.8cqw,18px)] w-[clamp(11px,2.8cqw,18px)] ${dark ? "text-indigo-400" : "text-indigo-600"}`} strokeWidth={2.4} />
                <span style={{ color: dark ? "#c7d2fe" : "#4f46e5" }}>{formatCount(count)}</span>
              </span>
            ))}
          </div>
        )}

        {/* Branding */}
        <div className="h-px w-full" style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.12)" }} />
        <div className="mt-3 flex items-center gap-3">
          <img src="/icons/icon.svg" alt="Loop" className="h-11 w-11 rounded-xl object-contain" />
          <div className="min-w-0 flex-1">
            <p className={`text-[clamp(10px,2.5cqw,18px)] font-bold leading-tight ${dark ? "text-slate-50" : "text-slate-900"}`}>Loop</p>
            <p className={`truncate text-[clamp(8px,1.8cqw,13px)] ${dark ? "text-slate-400" : "text-slate-500"}`}>Build together. Not just post into the void.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main modal ── */

export function ShareAsImageModal({ open, onOpenChange, post }: ShareAsImageModalProps) {
  const { toast } = useToast()
  const { resolvedTheme } = useTheme()
  const theme: ShareCardTheme = resolvedTheme === "light" ? "light" : "dark"
  const exportCanvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)
  const [exporting, setExporting] = useState(false)
  const avatarRef = useRef<AvatarSource | null>(null)
  const mediaRef = useRef<AvatarSource | null>(null)
  const cachedBlobRef = useRef<Blob | null>(null)
  const generationRef = useRef(0)

  const renderKey = useMemo(
    () =>
      [post.id, post.content, post.media_url, post.author.username, post.author.display_name, post.author.avatar_url, post.author.is_verified ? "1" : "0", theme, post.stats?.likes_count ?? "", post.stats?.comments_count ?? "", post.stats?.branches_count ?? "", post.stats?.shares_count ?? ""].join("|"),
    [post.id, post.content, post.media_url, post.author.username, post.author.display_name, post.author.avatar_url, post.author.is_verified, theme, post.stats?.likes_count, post.stats?.comments_count, post.stats?.branches_count, post.stats?.shares_count],
  )

  useEffect(() => {
    if (!open) { setRendered(false); setExporting(false); cachedBlobRef.current = null; avatarRef.current = null; mediaRef.current = null; return }
    const gen = ++generationRef.current
    let cancelled = false
    setRendered(false)
    const generate = async () => {
      const canvas = exportCanvasRef.current
      if (!canvas) return
      try {
        await loadLogo()
        drawCardBase(canvas, post, EXPORT_SCALE, avatarRef.current, theme, mediaRef.current)
        if (cancelled || gen !== generationRef.current) return
        cachedBlobRef.current = await canvasToJpegBlob(canvas, 0.92)
        setRendered(true)
        const avatar = post.author.avatar_url ? await loadAvatar(post.author.avatar_url) : null
        if (cancelled || gen !== generationRef.current) return
        avatarRef.current = avatar
        const media = post.media_url ? await loadAvatar(post.media_url) : null
        if (cancelled || gen !== generationRef.current) return
        mediaRef.current = media
        drawCardBase(canvas, post, EXPORT_SCALE, avatar, theme, media)
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
    drawCardBase(canvas, post, EXPORT_SCALE, avatarRef.current, theme, mediaRef.current)
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
            <Share2 className="h-4 w-4 text-sky-500" /> Share as image
          </DialogTitle>
          <DialogDescription>
            A branded share card with your profile, the post, and Loop branding — perfect for X, Instagram, or anywhere else.
          </DialogDescription>
        </DialogHeader>

        <canvas ref={exportCanvasRef} className="hidden" />

        <div className="relative w-full overflow-hidden rounded-xl border border-border">
          <ShareCardPreview post={post} theme={theme} />
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
