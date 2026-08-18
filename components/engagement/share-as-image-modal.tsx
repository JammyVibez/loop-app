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
  Sparkles,
  ShieldCheck,
  Play,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { optimizeImageUrl } from "@/lib/optimize-image"

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
/** Taller 4:5 card used when the post carries media — hero image above the caption. */
const MEDIA_CARD_HEIGHT = 1350
const EXPORT_SCALE = 1.6 // 1728px on the long edge — crisp for social, ~2× faster to encode than 2052
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

/** Short, social-style count formatting: 1234 → 1.2k */
function formatCount(n: number | undefined | null): string {
  const value = Math.max(0, Number(n || 0))
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (value >= 1_000) return (value / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
  return String(value)
}

interface CardPalette {
  bg: [string, string, string]
  glowPrimary: string
  glowSecondary: string
  ringStroke: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  divider: string
  avatarFallbackBg: string
  avatarFallbackText: string
  verifyBg: string
  verifyFg: string
  statIcon: string
  brandDivider: string
  logoFg: string
  footerSub: string
  mediaBgTop: string
  mediaBgBottom: string
}

function paletteFor(theme: ShareCardTheme): CardPalette {
  if (theme === "light") {
    return {
      bg: ["#ffffff", "#f8fafc", "#eef2ff"],
      glowPrimary: "rgba(99,102,241,0.16)",
      glowSecondary: "rgba(34,211,238,0.12)",
      ringStroke: "rgba(15,23,42,0.05)",
      textPrimary: "#0f172a",
      textSecondary: "#334155",
      textMuted: "#64748b",
      divider: "rgba(100,116,139,0.28)",
      avatarFallbackBg: "#e2e8f0",
      avatarFallbackText: "#0f172a",
      verifyBg: "#38bdf8",
      verifyFg: "#ffffff",
      statIcon: "#6366f1",
      brandDivider: "rgba(99,102,241,0.45)",
      logoFg: "#ffffff",
      footerSub: "#64748b",
      mediaBgTop: "#e2e8f0",
      mediaBgBottom: "#f8fafc",
    }
  }
  return {
    bg: ["#0f172a", "#111827", "#1e1b4b"],
    glowPrimary: "rgba(99,102,241,0.28)",
    glowSecondary: "rgba(34,211,238,0.16)",
    ringStroke: "rgba(255,255,255,0.04)",
    textPrimary: "#f8fafc",
    textSecondary: "#f1f5f9",
    textMuted: "#94a3b8",
    divider: "rgba(148,163,184,0.25)",
    avatarFallbackBg: "#334155",
    avatarFallbackText: "#e2e8f0",
    verifyBg: "#38bdf8",
    verifyFg: "#0f172a",
    statIcon: "#818cf8",
    brandDivider: "rgba(99,102,241,0.5)",
    logoFg: "#ffffff",
    footerSub: "#94a3b8",
    mediaBgTop: "#1e293b",
    mediaBgBottom: "#0f172a",
  }
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

function setupCanvas(canvas: HTMLCanvasElement, scale: number, height = CARD_HEIGHT) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  canvas.width = Math.round(CARD_WIDTH * scale)
  canvas.height = Math.round(height * scale)
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  return ctx
}

/* ------------------------- small vector stat icons ------------------------ */

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
  // top node
  ctx.beginPath()
  ctx.arc(x, y - s * 0.34, r, 0, Math.PI * 2)
  ctx.fill()
  // bottom-left node
  ctx.beginPath()
  ctx.arc(x - s * 0.34, y + s * 0.36, r, 0, Math.PI * 2)
  ctx.fill()
  // bottom-right node
  ctx.beginPath()
  ctx.arc(x + s * 0.34, y + s * 0.36, r, 0, Math.PI * 2)
  ctx.fill()
  // connectors
  ctx.beginPath()
  ctx.moveTo(x, y - s * 0.2)
  ctx.lineTo(x, y - s * 0.06)
  ctx.lineTo(x - s * 0.24, y + s * 0.22)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y - s * 0.06)
  ctx.lineTo(x + s * 0.24, y + s * 0.22)
  ctx.stroke()
  ctx.restore()
}

function drawShareIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(2, s * 0.09)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  // arrow shaft
  ctx.beginPath()
  ctx.moveTo(x + s * 0.04, y - s * 0.28)
  ctx.lineTo(x + s * 0.04, y + s * 0.18)
  ctx.stroke()
  // arrow head
  ctx.beginPath()
  ctx.moveTo(x - s * 0.16, y - s * 0.1)
  ctx.lineTo(x + s * 0.04, y - s * 0.3)
  ctx.lineTo(x + s * 0.24, y - s * 0.1)
  ctx.stroke()
  // tray
  ctx.beginPath()
  ctx.moveTo(x - s * 0.36, y + s * 0.34)
  ctx.lineTo(x + s * 0.36, y + s * 0.34)
  ctx.stroke()
  ctx.restore()
}

/* --------------------- small badge glyphs (premium/sponsor/team) ---------- */

function drawCrownGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.7, cy + s * 0.5)
  ctx.lineTo(cx - s * 0.7, cy - s * 0.2)
  ctx.lineTo(cx - s * 0.35, cy + s * 0.1)
  ctx.lineTo(cx, cy - s * 0.5)
  ctx.lineTo(cx + s * 0.35, cy + s * 0.1)
  ctx.lineTo(cx + s * 0.7, cy - s * 0.2)
  ctx.lineTo(cx + s * 0.7, cy + s * 0.5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawStarGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? s * 0.5 : s * 0.22
    const a = (Math.PI / 5) * i - Math.PI / 2
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawShieldGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.55, cy - s * 0.6)
  ctx.lineTo(cx + s * 0.55, cy - s * 0.6)
  ctx.lineTo(cx + s * 0.55, cy + s * 0.05)
  ctx.quadraticCurveTo(cx + s * 0.55, cy + s * 0.5, cx, cy + s * 0.68)
  ctx.quadraticCurveTo(cx - s * 0.55, cy + s * 0.5, cx - s * 0.55, cy + s * 0.05)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawPlayGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.32, cy - s * 0.45)
  ctx.lineTo(cx + s * 0.42, cy)
  ctx.lineTo(cx - s * 0.32, cy + s * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/* ------------------------------ canvas card ------------------------------- */

interface DrawStats {
  likes: number
  comments: number
  branches: number
  shares: number
}

/** Draws the full branded card at the given scale. Avatar is drawn from the
 *  provided source (an image/bitmap or null for the letter fallback). */
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

  // Background — follows the app theme (deep navy in dark, soft white in light).
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, cardH)
  bg.addColorStop(0, pal.bg[0])
  bg.addColorStop(0.55, pal.bg[1])
  bg.addColorStop(1, pal.bg[2])
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_WIDTH, cardH)

  const glow = ctx.createRadialGradient(CARD_WIDTH * 0.15, cardH * 0.1, 50, CARD_WIDTH * 0.15, cardH * 0.1, 700)
  glow.addColorStop(0, pal.glowPrimary)
  glow.addColorStop(1, "rgba(99,102,241,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CARD_WIDTH, cardH)

  const glow2 = ctx.createRadialGradient(CARD_WIDTH * 0.9, cardH * 0.95, 50, CARD_WIDTH * 0.9, cardH * 0.95, 640)
  glow2.addColorStop(0, pal.glowSecondary)
  glow2.addColorStop(1, "rgba(34,211,238,0)")
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, CARD_WIDTH, cardH)

  // Decorative rings
  ctx.strokeStyle = pal.ringStroke
  ctx.lineWidth = 2
  for (const r of [180, 320, 460]) {
    ctx.beginPath()
    ctx.arc(CARD_WIDTH - 140, cardH - 220, r, 0, Math.PI * 2)
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
  ctx.fillStyle = pal.avatarFallbackBg
  ctx.fillRect(margin, margin, avatarSize, avatarSize)
  if (avatarSrc) {
    const { w, h } = avatarDimensions(avatarSrc)
    const size = Math.min(w, h)
    const sx = (w - size) / 2
    const sy = (h - size) / 2
    ctx.drawImage(avatarSrc, sx, sy, size, size, margin, margin, avatarSize, avatarSize)
  } else {
    ctx.font = "bold 80px system-ui, sans-serif"
    ctx.fillStyle = pal.avatarFallbackText
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText((post.author.display_name || "U").charAt(0).toUpperCase(), margin + avatarSize / 2, margin + avatarSize / 2 + 6)
  }
  ctx.restore()

  // --- Display name + verified badge ---
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.font = "bold 52px system-ui, sans-serif"
  ctx.fillStyle = pal.textPrimary
  const name = truncate(post.author.display_name || post.author.username || "User", 22)
  const nameWidth = ctx.measureText(name).width
  ctx.fillText(name, margin + avatarSize + 60, margin + 68)

  // Badge chips — verified check, premium crown, sponsor star, team shield.
  const chipR = 22
  const chips: Array<{
    bg: string
    fg: string
    glyph: (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, c: string) => void
    label: string
  }> = []
  if (post.author.is_verified) {
    chips.push({ bg: pal.verifyBg, fg: pal.verifyFg, glyph: (ctx, cx, cy, s, c) => {
      ctx.save()
      ctx.fillStyle = c
      ctx.font = `bold ${Math.round(s * 1.15)}px system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("✓", cx, cy + s * 0.06)
      ctx.restore()
    }, label: "Verified" })
  }
  if (post.author.is_premium) {
    chips.push({ bg: "#f59e0b", fg: "#ffffff", glyph: drawCrownGlyph, label: "Pro" })
  }
  if (post.author.is_sponsor) {
    chips.push({ bg: "#fbbf24", fg: "#78350f", glyph: drawStarGlyph, label: "Sponsor" })
  }
  if (post.author.is_team) {
    chips.push({ bg: "#6366f1", fg: "#ffffff", glyph: drawShieldGlyph, label: "Team" })
  }
  let chipX = margin + avatarSize + 60 + nameWidth + 24
  const chipCY = margin + 68 - 24
  for (const chip of chips) {
    // Keep the chips inside the card — long names win over extra badges.
    if (chipX + chipR * 2 + 14 > CARD_WIDTH - margin) break
    ctx.save()
    ctx.beginPath()
    ctx.arc(chipX + chipR, chipCY, chipR, 0, Math.PI * 2)
    ctx.fillStyle = chip.bg
    ctx.fill()
    ctx.restore()
    if (chip.label === "Verified") {
      chip.glyph(ctx, chipX + chipR, chipCY, chipR * 0.75, chip.fg)
    } else {
      chip.glyph(ctx, chipX + chipR, chipCY, chipR * 0.9, chip.fg)
    }
    chipX += chipR * 2 + 10
  }
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.font = "bold 52px system-ui, sans-serif"

  // --- Username ---
  ctx.font = "normal 34px system-ui, sans-serif"
  ctx.fillStyle = pal.textMuted
  ctx.fillText(`@${truncate(post.author.username || "user", 26)}`, margin + avatarSize + 60, margin + 120)

  // --- Divider ---
  ctx.strokeStyle = pal.divider
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(margin, margin + avatarSize + 80)
  ctx.lineTo(CARD_WIDTH - margin, margin + avatarSize + 80)
  ctx.stroke()

  // --- Post text (fewer lines when the card also shows the media) ---
  const maxLines = hasMedia ? 3 : 6
  const textStartY = margin + avatarSize + 150
  const bodyText = truncate(post.content || "Shared a loop", 360)
  ctx.font = "normal 46px system-ui, sans-serif"
  ctx.fillStyle = pal.textSecondary

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
    if (lines.length >= maxLines) break
  }
  if (line && lines.length < maxLines) lines.push(line)
  const shownLines = lines.slice(0, maxLines)
  let y = textStartY
  for (const l of shownLines) {
    ctx.fillText(l, margin, y)
    y += 62
  }
  const textBottom = shownLines.length ? y - 62 + 62 : textStartY

  // --- Media band (hero image for the post, cover-cropped) ---
  if (hasMedia) {
    const mediaX = margin
    const mediaY = textBottom + 54
    const mediaW = CARD_WIDTH - margin * 2
    const mediaH = 300
    ctx.save()
    roundRect(ctx, mediaX, mediaY, mediaW, mediaH, 24)
    ctx.clip()
    const mediaBg = ctx.createLinearGradient(mediaX, mediaY, mediaX, mediaY + mediaH)
    mediaBg.addColorStop(0, pal.mediaBgTop)
    mediaBg.addColorStop(1, pal.mediaBgBottom)
    ctx.fillStyle = mediaBg
    ctx.fillRect(mediaX, mediaY, mediaW, mediaH)
    if (mediaSrc) {
      const { w, h } = avatarDimensions(mediaSrc)
      const cover = Math.max(mediaW / w, mediaH / h)
      const dw = w * cover
      const dh = h * cover
      ctx.drawImage(mediaSrc, mediaX + (mediaW - dw) / 2, mediaY + (mediaH - dh) / 2, dw, dh)
    } else if (post.media_type === "video") {
      // Video poster unavailable — show a dark band with a play button.
      drawPlayGlyph(ctx, mediaX + mediaW / 2, mediaY + mediaH / 2, 64, "rgba(255,255,255,0.9)")
    }
    ctx.restore()
    ctx.strokeStyle = pal.ringStroke
    ctx.lineWidth = 2
    roundRect(ctx, mediaX, mediaY, mediaW, mediaH, 24)
    ctx.stroke()
  }

  // --- Engagement stats row (likes · comments · branches · shares) ---
  const stats: DrawStats = {
    likes: Number(post.stats?.likes_count || 0),
    comments: Number(post.stats?.comments_count || 0),
    branches: Number(post.stats?.branches_count || 0),
    shares: Number(post.stats?.shares_count || 0),
  }
  const hasStats = stats.likes + stats.comments + stats.branches + stats.shares > 0
  if (hasStats) {
    const statsY = cardH - 340 // icon center line
    const itemGap = 96
    const items: { icon: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string) => void; count: number }[] = [
      { icon: drawHeartIcon, count: stats.likes },
      { icon: drawCommentIcon, count: stats.comments },
      { icon: drawBranchIcon, count: stats.branches },
      { icon: drawShareIcon, count: stats.shares },
    ]
    const iconSize = 44
    let cx = margin
    ctx.font = "600 38px system-ui, sans-serif"
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    for (const item of items) {
      item.icon(ctx, cx + iconSize / 2, statsY - iconSize / 2, iconSize, pal.statIcon)
      ctx.fillStyle = pal.textPrimary
      ctx.fillText(formatCount(item.count), cx + iconSize + 22, statsY + 2)
      cx += iconSize + 22 + ctx.measureText(formatCount(item.count)).width + itemGap
    }
  }

  // --- Bottom branding bar ---
  const barY = cardH - 190
  ctx.strokeStyle = pal.brandDivider
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(margin, barY)
  ctx.lineTo(CARD_WIDTH - margin, barY)
  ctx.stroke()

  ctx.save()
  roundRect(ctx, margin, barY + 34, 76, 76, 20)
  ctx.clip()
  const logoImg = cachedLogoImg
  if (logoImg) {
    ctx.drawImage(logoImg, margin, barY + 34, 76, 76)
  } else {
    // Fallback: gradient circle with L letter
    const logoBg = ctx.createLinearGradient(margin, barY + 34, margin + 76, barY + 110)
    logoBg.addColorStop(0, BRAND)
    logoBg.addColorStop(1, "#22d3ee")
    ctx.fillStyle = logoBg
    ctx.fillRect(margin, barY + 34, 76, 76)
    ctx.fillStyle = pal.logoFg
    ctx.font = "bold 52px system-ui, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("L", margin + 38, barY + 74)
  }
  ctx.restore()

  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.font = "bold 40px system-ui, sans-serif"
  ctx.fillStyle = pal.textPrimary
  ctx.fillText("Loop", margin + 100, barY + 76)
  ctx.font = "normal 28px system-ui, sans-serif"
  ctx.fillStyle = pal.footerSub
  ctx.fillText("Build together. Not just post into the void.", margin + 100, barY + 118)

  ctx.font = "600 28px ui-monospace, monospace"
  ctx.fillStyle = pal.footerSub
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

function ShareCardPreview({ post, theme }: { post: ShareAsImageModalProps["post"]; theme: ShareCardTheme }) {
  const name = truncate(post.author.display_name || post.author.username || "User", 22)
  const bodyText = truncate(post.content || "Shared a loop", 360)
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
      className={`relative w-full select-none overflow-hidden rounded-xl text-left ${hasMedia ? "aspect-[4/5]" : "aspect-square"} ${dark ? "bg-[#0f172a]" : "bg-white"}`}
      style={{ containerType: "inline-size" }}
    >
      {/* Background gradient + glows (mirrors the canvas card) */}
      <div
        className="absolute inset-0"
        style={{
          background: dark
            ? "linear-gradient(140deg, #0f172a 0%, #111827 55%, #1e1b4b 100%)"
            : "linear-gradient(140deg, #ffffff 0%, #f8fafc 55%, #eef2ff 100%)",
        }}
      />
      <div
        className="absolute -left-10 -top-12 h-56 w-56 rounded-full"
        style={{ background: `radial-gradient(circle, ${dark ? "rgba(99,102,241,0.28)" : "rgba(99,102,241,0.16)"} 0%, rgba(99,102,241,0) 70%)` }}
      />
      <div
        className="absolute -bottom-12 -right-8 h-48 w-48 rounded-full"
        style={{ background: `radial-gradient(circle, ${dark ? "rgba(34,211,238,0.16)" : "rgba(34,211,238,0.12)"} 0%, rgba(34,211,238,0) 70%)` }}
      />
      {/* Decorative rings */}
      <div className={`absolute -bottom-16 -right-16 h-56 w-56 rounded-full border ${dark ? "border-white/5" : "border-slate-900/5"}`} />
      <div className={`absolute -bottom-8 -right-8 h-36 w-36 rounded-full border ${dark ? "border-white/5" : "border-slate-900/5"}`} />

      <div className="relative flex h-full flex-col p-[8%]">
        {/* Header: avatar + identity */}
        <div className="flex items-center gap-[5%]">
          <span className="flex aspect-square w-[16%] shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 p-[4%]">
            <span className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-full ${dark ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700"} text-[9cqw] font-bold`}>
              {post.author.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className={`flex items-center gap-1.5 truncate text-[clamp(11px,3.2cqw,22px)] font-bold leading-tight ${dark ? "text-slate-50" : "text-slate-900"}`}>
              <span className="truncate">{name}</span>
              {post.author.is_verified && (
                <span className={`flex h-[1.2em] w-[1.2em] shrink-0 items-center justify-center rounded-full bg-sky-400 text-[0.8em] font-bold ${dark ? "text-slate-900" : "text-white"}`}>
                  ✓
                </span>
              )}
              {post.author.is_premium && (
                <span
                  title="Pro"
                  className="flex h-[1.2em] w-[1.2em] shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-amber-950"
                >
                  <Crown className="h-[0.7em] w-[0.7em]" fill="currentColor" />
                </span>
              )}
              {post.author.is_sponsor && (
                <span
                  title="Sponsor"
                  className="flex h-[1.2em] w-[1.2em] shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-orange-400 text-amber-950"
                >
                  <Sparkles className="h-[0.7em] w-[0.7em]" fill="currentColor" />
                </span>
              )}
              {post.author.is_team && (
                <span
                  title="Loop Team"
                  className="flex h-[1.2em] w-[1.2em] shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white"
                >
                  <ShieldCheck className="h-[0.7em] w-[0.7em]" fill="currentColor" />
                </span>
              )}
            </p>
            <p className={`truncate text-[clamp(9px,2.4cqw,16px)] ${dark ? "text-slate-400" : "text-slate-500"}`}>@{truncate(post.author.username || "user", 26)}</p>
          </div>
        </div>

        <div className={`mt-[6%] h-px w-full ${dark ? "bg-slate-400/25" : "bg-slate-500/25"}`} />

        {/* Body text */}
        <p className={`${hasMedia ? "mt-[4%]" : "mt-[6%]"} whitespace-pre-line text-[clamp(12px,3.6cqw,26px)] leading-relaxed [display:-webkit-box] [-webkit-box-orient:vertical] ${hasMedia ? "[-webkit-line-clamp:3]" : "[-webkit-line-clamp:6]"} overflow-hidden ${dark ? "text-slate-100" : "text-slate-800"}`}>
          {bodyText}
        </p>

        {/* Media thumbnail (hero band) */}
        {hasMedia && (
          <div className="relative mt-[5%] overflow-hidden rounded-xl border border-black/5 dark:border-white/10">
            {post.media_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={optimizeImageUrl(post.media_url, 800) || post.media_url}
                alt=""
                className="aspect-[16/9] w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : null}
            {post.media_type === "video" && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-[20%] aspect-square min-h-9 items-center justify-center rounded-full bg-black/50 backdrop-blur">
                  <Play className="h-[45%] w-[45%] text-white" fill="currentColor" />
                </span>
              </span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Engagement stats */}
        {hasStats && (
          <div className={`mb-[3%] flex items-center gap-[5%] ${dark ? "text-slate-200" : "text-slate-800"}`}>
            {stats.map(({ icon: Icon, count }, i) => (
              <span key={i} className="flex items-center gap-[1cqw] text-[clamp(9px,2.4cqw,18px)] font-semibold">
                <Icon className={`h-[clamp(12px,3.2cqw,22px)] w-[clamp(12px,3.2cqw,22px)] ${dark ? "text-indigo-400" : "text-indigo-600"}`} strokeWidth={2.4} />
                {formatCount(count)}
              </span>
            ))}
          </div>
        )}

        {/* Branding bar */}
        <div className={`mt-[2%] h-px w-full ${dark ? "bg-indigo-500/50" : "bg-indigo-500/45"}`} />
        <div className="mt-[4%] flex items-center gap-[3%]">
          <span className="flex h-[clamp(20px,6cqw,44px)] w-[clamp(20px,6cqw,44px)] shrink-0 items-center justify-center overflow-hidden rounded-[24%]">
            <img src="/icons/icon.svg" alt="Loop" className="h-full w-full object-contain" decoding="async" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-[clamp(10px,2.8cqw,20px)] font-bold leading-tight ${dark ? "text-slate-50" : "text-slate-900"}`}>Loop</p>
            <p className={`truncate text-[clamp(8px,1.9cqw,14px)] ${dark ? "text-slate-400" : "text-slate-500"}`}>Build together. Not just post into the void.</p>
          </div>
          <p className={`shrink-0 font-mono text-[clamp(8px,2cqw,15px)] font-semibold ${dark ? "text-slate-400" : "text-slate-500"}`}>
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
      [
        post.id,
        post.content,
        post.media_url,
        post.author.username,
        post.author.display_name,
        post.author.avatar_url,
        post.author.is_verified ? "1" : "0",
        theme,
        post.stats?.likes_count ?? "",
        post.stats?.comments_count ?? "",
        post.stats?.branches_count ?? "",
        post.stats?.shares_count ?? "",
      ].join("|"),
    [post.id, post.content, post.media_url, post.author.username, post.author.display_name, post.author.avatar_url, post.author.is_verified, theme, post.stats?.likes_count, post.stats?.comments_count, post.stats?.branches_count, post.stats?.shares_count],
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
      mediaRef.current = null
      return
    }
    const gen = ++generationRef.current
    let cancelled = false
    setRendered(false)

    const generate = async () => {
      const canvas = exportCanvasRef.current
      if (!canvas) return
      try {
        // Load the logo early so the first draw has it
        await loadLogo()
        // Instant UI: the HTML preview is what the user sees, so reveal it as
        // soon as the first draw succeeds — the JPEG encode continues in the
        // background and Download/Share fall back to on-demand if needed.
        drawCardBase(canvas, post, EXPORT_SCALE, avatarRef.current, theme, mediaRef.current)
        if (cancelled || gen !== generationRef.current) return
        cachedBlobRef.current = await canvasToJpegBlob(canvas, 0.92)
        setRendered(true)

        // Avatar + media arrive asynchronously — redraw + re-encode so the
        // download includes them. Never blocks the initial render.
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
