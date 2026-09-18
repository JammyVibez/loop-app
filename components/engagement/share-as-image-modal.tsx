"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Download, Share2, BadgeCheck } from "lucide-react"
import { getDiceBearUrl } from "@/lib/dicebear"
import { Spinner } from "@/components/ui/skeletons"
import { useVerificationBadges } from "@/hooks/use-verification-badges"

export interface ShareCardBadge {
  name?: string | null
  icon?: string | null
  colors?: string[] | null
}

interface ShareAsImageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: {
    id: string
    content: string
    content_type?: string
    created_at?: string
    author: {
      username: string
      display_name: string
      avatar_url?: string
      is_verified?: boolean
      is_premium?: boolean
      is_sponsor?: boolean
      is_team?: boolean
      /** Custom admin-created checkmark (resolved from `badge_id` when omitted). */
      badge?: ShareCardBadge | null
      badge_id?: string | null
    }
    media_url?: string
    media_type?: string
    stats?: {
      likes_count?: number
      comments_count?: number
      branches_count?: number
      shares_count?: number
      boosts_count?: number
    }
  }
}

/* ── Card geometry ───────────────────────────────────────────────────────
 * The card hugs its content the way a Substack share card does: 1080 wide,
 * height driven by the wrapped body lines (plus the post image when there is
 * one), so a one-line post is a compact strip instead of an empty portrait.
 * The HTML preview and the exported JPEG derive their height from the same
 * `lines` array and the same media height, so the two are the same layout at
 * any size.
 */
const CARD_W = 1080
const SCALE = 2
const PAD = 64
const RADIUS = 28
/** Avatar gradient ring thickness. */
const RING = 5
const AVATAR = 96
const AV_BOX = AVATAR + RING * 2
const NAME_FONT = 38
const META_FONT = 27
const BODY_FONT = 40
const BODY_LINE = 1.5
const MAX_LINES = 14
const LOGO = 46
const WORDMARK_FONT = 33
const WORDMARK_GAP = 12
const BADGE = 30
/** Header → body, body → media, media → engagement row. */
const HEADER_GAP = 48
const MEDIA_GAP = 44
const ENGAGE_GAP = 52
const ICON = 36
const COUNT_FONT = 28
const GAP_AFTER_ICON = 14
const GAP_BETWEEN = 52

const BODY_LINE_H = BODY_FONT * BODY_LINE
const HEADER_BOTTOM = PAD + AV_BOX
const BODY_TOP = HEADER_BOTTOM + HEADER_GAP
const MEDIA_W = CARD_W - PAD * 2
const MEDIA_MIN_H = 280
const MEDIA_MAX_H = 620

/** Total card height for a given number of wrapped body lines (+ media). */
function cardHeight(lineCount: number, mediaH: number | null) {
  return (
    BODY_TOP +
    Math.max(1, lineCount) * BODY_LINE_H +
    (mediaH ? MEDIA_GAP + mediaH : 0) +
    ENGAGE_GAP +
    ICON +
    PAD
  )
}
/** Rough line count used for the very first (server) render. */
function estimateLines(body: string) {
  const perLine = Math.max(1, Math.floor((CARD_W - PAD * 2) / (BODY_FONT * 0.5)))
  return Math.min(MAX_LINES, Math.max(1, Math.ceil(body.trim().length / perLine)))
}

/* ── Palette: near-black, the way the reference card reads ── */
const C = {
  bg: "#000000",
  bgLift: "#141726",
  text: "rgba(255,255,255,0.96)",
  textStrong: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.55)",
  violet: "#8B5CF6",
  cyan: "#22D3EE",
  amber: "#F59E0B",
  amberLight: "#FBBF24",
  proText: "#241505",
}
/** Gradient rim + wordmark, matching the app icon's violet → cyan sweep. */
const RIM_GRADIENT =
  "linear-gradient(135deg, rgba(139,92,246,0.45), rgba(255,255,255,0.10) 48%, rgba(34,211,238,0.38))"
/** The wordmark stays white — the icon already carries the brand gradient. */
const WORDMARK_COLOR = "rgba(255,255,255,0.92)"

function truncate(t: string, m: number) {
  const c = t.replace(/\s+/g, " ").trim()
  return c.length <= m ? c : c.slice(0, m).trimEnd() + "\u2026"
}
function fmt(n: number | undefined | null) {
  const v = Math.max(0, Number(n || 0))
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return String(v)
}
/** "Mar 3, 2026" — stable across locales for a share card. */
function cardDate(iso?: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function normalizeColors(badge?: ShareCardBadge | null): string[] {
  const raw: any = badge?.colors
  let v = raw
  if (typeof v === "string") {
    try {
      v = JSON.parse(v)
    } catch {
      v = raw
    }
  }
  if (Array.isArray(v)) return v.map((c: any) => String(c).trim()).filter(Boolean)
  if (typeof v === "string" && v.trim()) return [v.trim()]
  // Fall back to the branded seal gradient so a custom mark never disappears.
  return [C.cyan, "#818CF8"]
}

/* ── App logo ────────────────────────────────────────────────────────────
 * Mirrors `AppLogo`: the admin-configured `app_logo.logo_url` (cached in
 * sessionStorage, refreshed from /api/admin/settings) with a local fallback.
 * The PNG fallback is used for the canvas because some browsers report a zero
 * intrinsic size for an SVG loaded into an <img>, which would draw nothing.
 */
const DEFAULT_LOGO_IMG = "/icons/icon-512x512.png"
let logoSrcPromise: Promise<string> | null = null

async function resolveLogoSrc(): Promise<string> {
  try {
    const cached = sessionStorage.getItem("loop-app-logo")
    if (cached) return cached
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch("/api/admin/settings", { cache: "no-store" })
    if (res.ok) {
      const data = await res.json()
      const url = data?.settings?.app_logo?.logo_url || data?.data?.app_logo?.logo_url
      if (typeof url === "string" && url.trim()) {
        try {
          sessionStorage.setItem("loop-app-logo", url)
        } catch {
          /* ignore */
        }
        return url
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LOGO_IMG
}
function getLogoSrc() {
  if (!logoSrcPromise) logoSrcPromise = resolveLogoSrc()
  return logoSrcPromise
}
/** Same-origin passthrough, everything else through the media proxy (no CORS taint). */
function proxyUrl(src: string) {
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return src
  return `/api/image-proxy?url=${encodeURIComponent(src)}`
}
/** The post's own image, when it has one we can draw. */
function imageMediaUrl(mediaUrl?: string, mediaType?: string): string | null {
  if (!mediaUrl) return null
  const t = (mediaType || "").toLowerCase()
  if (t && !t.startsWith("image")) return null
  if (!t && /\.(mp4|webm|mov|m4v|mp3|wav|m4a|ogg|pdf)$/i.test(mediaUrl)) return null
  if (mediaUrl.startsWith("blob:")) return null
  return mediaUrl
}

/* ── Image loading ── */
type AV = HTMLImageElement | HTMLCanvasElement | ImageBitmap
function avDim(s: AV) {
  if (typeof HTMLImageElement !== "undefined" && s instanceof HTMLImageElement)
    return { w: s.naturalWidth || s.width, h: s.naturalHeight || s.height }
  return { w: (s as any).width, h: (s as any).height }
}
function loadAv(src: string): Promise<AV | null> {
  return new Promise((r) => {
    let done = false
    const ok = (v: AV | null) => {
      if (done) return
      done = true
      clearTimeout(t)
      r(v)
    }
    const t = window.setTimeout(() => ok(null), 2000)
    if (typeof createImageBitmap === "function") {
      fetch(src, { mode: "cors", credentials: "include" })
        .then((x) => {
          if (!x.ok) throw 0
          return x.blob()
        })
        .then((b) => createImageBitmap(b))
        .then((b) => ok(b))
        .catch(() => {
          const i = new Image()
          i.crossOrigin = "anonymous"
          i.onload = () => ok(i)
          i.onerror = () => ok(null)
          i.src = src
        })
      return
    }
    const i = new Image()
    i.crossOrigin = "anonymous"
    i.onload = () => ok(i)
    i.onerror = () => ok(null)
    i.src = src
  })
}

/* ── Canvas primitives ── */
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
function font(weight: number, size: number) {
  return `${weight} ${size}px ${SANS}`
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
function setup(c: HTMLCanvasElement, w: number, h: number, s: number) {
  const ctx = c.getContext("2d")
  if (!ctx) return null
  c.width = Math.round(w * s)
  c.height = Math.round(h * s)
  ctx.setTransform(s, 0, 0, s, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  return ctx
}
function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
}
/** White check mark inside a small badge. */
function drawCheck(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "#FFFFFF") {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(2, size * 0.14)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.beginPath()
  ctx.moveTo(cx - size * 0.3, cy + size * 0.02)
  ctx.lineTo(cx - size * 0.08, cy + size * 0.24)
  ctx.lineTo(cx + size * 0.32, cy - size * 0.22)
  ctx.stroke()
  ctx.restore()
}
/** Gradient disc with a check — the verified seal / custom admin mark. */
function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colors: string[]) {
  ctx.save()
  const a = colors[0] || C.cyan
  const b = colors[1] || colors[0] || "#818CF8"
  const g = ctx.createLinearGradient(x, y, x + size, y + size)
  g.addColorStop(0, a)
  g.addColorStop(1, b)
  circle(ctx, x + size / 2, y + size / 2, size / 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.35)"
  ctx.lineWidth = 1.2
  circle(ctx, x + size / 2, y + size / 2, size / 2 - 0.6)
  ctx.stroke()
  drawCheck(ctx, x + size / 2, y + size / 2, size)
  ctx.restore()
}
/** PRO pill — amber gradient, dark label. Width is returned so callers stack. */
function drawPro(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  const w = 72
  ctx.save()
  const g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, C.amberLight)
  g.addColorStop(1, C.amber)
  rr(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.fillStyle = C.proText
  ctx.font = font(800, 16)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("PRO", x + w / 2, y + h / 2 + 1)
  ctx.restore()
  return w
}
/** Fallback brand mark: the app icon's gradient "L" in a rounded tile. */
function drawLoopMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  const g = ctx.createLinearGradient(x, y, x + size, y + size)
  g.addColorStop(0, "#7C3AED")
  g.addColorStop(1, C.cyan)
  rr(ctx, x, y, size, size, size * 0.3)
  ctx.fillStyle = g
  ctx.fill()
  ctx.fillStyle = "#FFFFFF"
  ctx.font = font(800, size * 0.6)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("L", x + size / 2, y + size / 2 + size * 0.04)
  ctx.restore()
}
/**
 * The real app icon, with the drawn mark as a safety net.
 *
 * The icon SVG declares only a viewBox, so an <img> reports a 300×150
 * intrinsic size and the square mark sits centered inside it — the source is
 * cropped to its centered square (the same trick the avatar uses) so the logo
 * fills the box instead of shrinking into it.
 */
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, logo: AV | null) {
  if (!logo) return drawLoopMark(ctx, x, y, size)
  const { w, h } = avDim(logo)
  if (!w || !h) return drawLoopMark(ctx, x, y, size)
  const sz = Math.min(w, h)
  ctx.save()
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(logo, (w - sz) / 2, (h - sz) / 2, sz, sz, x, y, size, size)
  ctx.restore()
}
/** The wordmark that sits beside the app icon. */
function drawWordmark(ctx: CanvasRenderingContext2D, x: number, baseline: number) {
  ctx.save()
  ctx.font = font(800, WORDMARK_FONT)
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = WORDMARK_COLOR
  ctx.fillText("Loop", x, baseline)
  ctx.restore()
}

/* ── Engagement glyphs, stroked to match the muted footer ── */
function strokeGlyph(ctx: CanvasRenderingContext2D, size: number) {
  ctx.strokeStyle = C.textMuted
  ctx.lineWidth = Math.max(1.9, size * 0.085)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
}
function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const t = size / 2
  ctx.save()
  strokeGlyph(ctx, size)
  ctx.beginPath()
  ctx.moveTo(cx, cy + t * 0.78)
  ctx.bezierCurveTo(cx - t * 1.16, cy - t * 0.14, cx - t * 0.66, cy - t * 1.02, cx, cy - t * 0.3)
  ctx.bezierCurveTo(cx + t * 0.66, cy - t * 1.02, cx + t * 1.16, cy - t * 0.14, cx, cy + t * 0.78)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}
function drawReply(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const w = size
  const h = size * 0.86
  const left = cx - w / 2
  const top = cy - h / 2 - size * 0.04
  ctx.save()
  strokeGlyph(ctx, size)
  rr(ctx, left, top, w, h, h * 0.34)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.24, top + h)
  ctx.lineTo(cx - w * 0.34, top + h + size * 0.26)
  ctx.lineTo(cx + w * 0.02, top + h)
  ctx.stroke()
  ctx.restore()
}
function drawRepost(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size
  ctx.save()
  strokeGlyph(ctx, size)
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.42, cy - s * 0.22)
  ctx.lineTo(cx + s * 0.3, cy - s * 0.22)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx + s * 0.1, cy - s * 0.44)
  ctx.lineTo(cx + s * 0.32, cy - s * 0.22)
  ctx.lineTo(cx + s * 0.1, cy)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx + s * 0.42, cy + s * 0.22)
  ctx.lineTo(cx - s * 0.3, cy + s * 0.22)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.1, cy)
  ctx.lineTo(cx - s * 0.32, cy + s * 0.22)
  ctx.lineTo(cx - s * 0.1, cy + s * 0.44)
  ctx.stroke()
  ctx.restore()
}
function drawShareArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size
  ctx.save()
  strokeGlyph(ctx, size)
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.42, cy + s * 0.04)
  ctx.lineTo(cx - s * 0.42, cy + s * 0.44)
  ctx.lineTo(cx + s * 0.42, cy + s * 0.44)
  ctx.lineTo(cx + s * 0.42, cy + s * 0.04)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx, cy + s * 0.26)
  ctx.lineTo(cx, cy - s * 0.44)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.26, cy - s * 0.18)
  ctx.lineTo(cx, cy - s * 0.44)
  ctx.lineTo(cx + s * 0.26, cy - s * 0.18)
  ctx.stroke()
  ctx.restore()
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const lines: string[] = []
  for (const para of text.split("\n")) {
    const words = para.split(" ").filter(Boolean)
    let ln = ""
    for (const w of words) {
      const t = ln ? `${ln} ${w}` : w
      if (ctx.measureText(t).width > maxW && ln) {
        lines.push(ln)
        ln = w
      } else ln = t
      if (lines.length >= maxLines) break
    }
    if (ln && lines.length < maxLines) lines.push(ln)
    if (lines.length >= maxLines) break
  }
  if (lines.length === maxLines) {
    // Mark the cut so a truncated post never looks like it just ends.
    let last = lines[maxLines - 1]
    while (last.length > 1 && ctx.measureText(last + "\u2026").width > maxW) last = last.slice(0, -1)
    lines[maxLines - 1] = last.trimEnd() + "\u2026"
  }
  return lines.length ? lines : [""]
}

/** Wraps the body with a throwaway canvas so both renderers agree on height. */
function measureLines(body: string): string[] | null {
  if (typeof document === "undefined") return null
  const c = document.createElement("canvas")
  const ctx = c.getContext("2d")
  if (!ctx) return null
  ctx.font = font(500, BODY_FONT)
  return wrapLines(ctx, body, CARD_W - PAD * 2, MAX_LINES)
}

interface CardModel {
  name: string
  handle: string
  date: string
  likes: number
  replies: number
  reposts: number
  body: string
  showVerified: boolean
  showPro: boolean
  verifiedColors: string[]
  customColorList: string[] | null
}

function model(post: ShareAsImageModalProps["post"], resolvedBadge?: ShareCardBadge | null): CardModel {
  const badge = post.author.badge || resolvedBadge || null
  return {
    name: truncate(post.author.display_name || post.author.username || "User", 40),
    handle: `@${truncate(post.author.username || "user", 30)}`,
    date: cardDate(post.created_at),
    likes: Number(post.stats?.likes_count || 0),
    replies: Number(post.stats?.comments_count || 0),
    reposts: Number(post.stats?.branches_count || 0),
    body: truncate(post.content || "Shared a loop on Loop.", 600),
    showVerified: Boolean(post.author.is_verified),
    showPro: Boolean(post.author.is_premium),
    verifiedColors: [C.cyan, "#818CF8"],
    customColorList: badge ? normalizeColors(badge) : null,
  }
}

/** Height of the media block, or null when there is nothing to draw. */
function mediaBoxHeight(img: AV) {
  const { w, h } = avDim(img)
  if (!w || !h) return null
  return Math.round(Math.min(MEDIA_MAX_H, Math.max(MEDIA_MIN_H, MEDIA_W * (h / w))))
}
/** Cover-crop the post image into its rounded block. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: AV,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const { w: iw, h: ih } = avDim(img)
  if (!iw || !ih) return
  const k = Math.max(w / iw, h / ih)
  const dw = iw * k
  const dh = ih * k
  ctx.save()
  rr(ctx, x, y, w, h, radius)
  ctx.clip()
  ctx.fillStyle = C.bgLift
  ctx.fillRect(x, y, w, h)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
  rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius)
  ctx.strokeStyle = "rgba(255,255,255,0.10)"
  ctx.lineWidth = 1
  ctx.stroke()
}

function drawCard(
  canvas: HTMLCanvasElement,
  m: CardModel,
  lines: string[],
  mediaH: number | null,
  scale: number,
  av: AV | null,
  logo: AV | null,
  media: AV | null,
) {
  const h = cardHeight(lines.length, mediaH)
  const ctx = setup(canvas, CARD_W, h, scale)
  if (!ctx) return

  // ── Background: black, with just enough ambience to feel lit ──
  // Flat base first so the rounded-corner cut-outs are the card color, not
  // transparent black (JPEG has no alpha).
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_W, h)
  rr(ctx, 0, 0, CARD_W, h, RADIUS)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_W, h)

  const violetGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, CARD_W * 0.85)
  violetGlow.addColorStop(0, "rgba(124,58,237,0.22)")
  violetGlow.addColorStop(1, "rgba(124,58,237,0)")
  ctx.fillStyle = violetGlow
  ctx.fillRect(0, 0, CARD_W, h)

  const cyanGlow = ctx.createRadialGradient(CARD_W, h, 0, CARD_W, h, CARD_W * 0.75)
  cyanGlow.addColorStop(0, "rgba(34,211,238,0.14)")
  cyanGlow.addColorStop(1, "rgba(34,211,238,0)")
  ctx.fillStyle = cyanGlow
  ctx.fillRect(0, 0, CARD_W, h)

  // A whisper of the other two corners keeps the black from reading flat.
  const indigoDeep = ctx.createRadialGradient(CARD_W * 0.15, h, 0, CARD_W * 0.15, h, CARD_W * 0.5)
  indigoDeep.addColorStop(0, "rgba(99,102,241,0.10)")
  indigoDeep.addColorStop(1, "rgba(99,102,241,0)")
  ctx.fillStyle = indigoDeep
  ctx.fillRect(0, 0, CARD_W, h)
  ctx.restore()

  // Hairline rim, tinted violet → cyan like the app icon.
  const rimGrad = ctx.createLinearGradient(0, 0, CARD_W, h)
  rimGrad.addColorStop(0, "rgba(139,92,246,0.45)")
  rimGrad.addColorStop(0.48, "rgba(255,255,255,0.10)")
  rimGrad.addColorStop(1, "rgba(34,211,238,0.38)")
  rr(ctx, 0.75, 0.75, CARD_W - 1.5, h - 1.5, RADIUS)
  ctx.strokeStyle = rimGrad
  ctx.lineWidth = 1.5
  ctx.stroke()

  /* ── Header: avatar + gradient ring, name + badges, meta, app logo ── */
  const avR = AVATAR / 2
  const avCx = PAD + RING + avR
  const avCy = PAD + RING + avR

  ctx.save()
  circle(ctx, avCx, avCy, avR)
  ctx.clip()
  ctx.fillStyle = C.bgLift
  ctx.fillRect(avCx - avR, avCy - avR, AVATAR, AVATAR)
  if (av) {
    const { w, h: ih } = avDim(av)
    const sz = Math.min(w, ih)
    ctx.drawImage(av, (w - sz) / 2, (ih - sz) / 2, sz, sz, avCx - avR, avCy - avR, AVATAR, AVATAR)
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.font = font(800, 40)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText((m.name || "U").charAt(0).toUpperCase(), avCx, avCy + 1)
  }
  ctx.restore()

  // Violet → cyan ring, so the avatar reads as a brand element.
  ctx.save()
  const ringGrad = ctx.createLinearGradient(avCx - avR, avCy - avR, avCx + avR, avCy + avR)
  ringGrad.addColorStop(0, C.violet)
  ringGrad.addColorStop(1, C.cyan)
  ctx.strokeStyle = ringGrad
  ctx.lineWidth = RING
  circle(ctx, avCx, avCy, avR + RING / 2)
  ctx.stroke()
  ctx.restore()

  // Brand: the real app icon + wordmark, far top-right (the Substack slot).
  const logoBaseline = PAD + (AV_BOX - LOGO) / 2
  const wordmarkW = (() => {
    ctx.save()
    ctx.font = font(800, WORDMARK_FONT)
    const w = ctx.measureText("Loop").width
    ctx.restore()
    return w
  })()
  const wordmarkX = CARD_W - PAD - wordmarkW
  drawLogo(ctx, wordmarkX - WORDMARK_GAP - LOGO, logoBaseline, LOGO, logo)
  drawWordmark(ctx, wordmarkX, logoBaseline + LOGO / 2 + WORDMARK_FONT * 0.35)

  const brandLeft = wordmarkX - WORDMARK_GAP - LOGO

  // Badges stack to the right of the name
  let badgeW = 0
  if (m.showVerified) badgeW += BADGE + 8
  if (m.showPro) badgeW += 72 + 8
  if (m.customColorList) badgeW += BADGE + 8

  const nameX = avCx + avR + RING + 24
  const nameMaxW = brandLeft - 24 - nameX - badgeW
  const nameBaseline = avCy - AVATAR * 0.08
  ctx.save()
  ctx.font = font(700, NAME_FONT)
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  let displayName = m.name
  while (displayName.length > 1 && ctx.measureText(displayName).width > nameMaxW) {
    displayName = displayName.slice(0, -1)
  }
  if (displayName !== m.name) displayName = displayName.trimEnd() + "\u2026"
  ctx.fillStyle = C.textStrong
  ctx.fillText(displayName, nameX, nameBaseline)
  const nameW = ctx.measureText(displayName).width
  ctx.restore()

  // meta line: @handle · date
  const metaBits = [m.handle]
  if (m.date) metaBits.push(m.date)
  ctx.save()
  ctx.font = font(400, META_FONT)
  ctx.fillStyle = C.textMuted
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillText(metaBits.join("  ·  "), nameX, nameBaseline + 40)
  ctx.restore()

  let bx = nameX + nameW + 12
  const by = nameBaseline - NAME_FONT * 0.78
  if (m.showVerified) {
    drawSeal(ctx, bx, by, BADGE, m.verifiedColors)
    bx += BADGE + 8
  }
  if (m.showPro) {
    drawPro(ctx, bx, by, BADGE)
    bx += 72 + 8
  }
  if (m.customColorList) {
    drawSeal(ctx, bx, by, BADGE, m.customColorList)
    bx += BADGE + 8
  }

  /* ── Body: starts right under the header, no dead vertical space ── */
  ctx.save()
  ctx.font = font(500, BODY_FONT)
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  ctx.fillStyle = C.text
  let ty = BODY_TOP
  for (const l of lines) {
    ctx.fillText(l, PAD, ty)
    ty += BODY_LINE_H
  }
  ctx.restore()

  /* ── Post image, when the loop has one ── */
  let afterBody = BODY_TOP + lines.length * BODY_LINE_H
  if (media && mediaH) {
    drawCover(ctx, media, PAD, afterBody + MEDIA_GAP, MEDIA_W, mediaH, 22)
    afterBody += MEDIA_GAP + mediaH
  }

  /* ── Engagement row, directly beneath the text (or the image) ── */
  const engCy = afterBody + ENGAGE_GAP + ICON / 2
  ctx.save()
  ctx.font = font(600, COUNT_FONT)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillStyle = C.textMuted
  // +2 keeps the heart's widest bezier control point on the text margin.
  let ex = PAD + 2 + ICON / 2
  const items: Array<{
    draw: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void
    label: string
  }> = [
    { draw: drawHeart, label: fmt(m.likes) },
    { draw: drawReply, label: fmt(m.replies) },
    { draw: drawRepost, label: fmt(m.reposts) },
    { draw: drawShareArrow, label: "" },
  ]
  for (const item of items) {
    item.draw(ctx, ex, engCy, ICON)
    ex += ICON / 2 + GAP_AFTER_ICON
    if (item.label) {
      ctx.fillText(item.label, ex, engCy + 1)
      ex += ctx.measureText(item.label).width + GAP_BETWEEN
    } else {
      ex += GAP_BETWEEN
    }
  }
  ctx.restore()
}

function toBlob(c: HTMLCanvasElement, q = 0.94): Promise<Blob> {
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/jpeg", q))
}

/* ── HTML mirror ─────────────────────────────────────────────────────────
 * The same layout, rendered at real pixel sizes and scaled down to whatever
 * width the dialog gives it — so the preview is a true miniature of the
 * exported JPEG rather than an approximation.
 */
function CardPreview({
  m,
  lines,
  avatarSrc,
  logoSrc,
  mediaSrc,
  mediaH,
  height,
}: {
  m: CardModel
  lines: string[]
  avatarSrc: string
  logoSrc: string
  mediaSrc: string | null
  mediaH: number | null
  height: number
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0)

  const measure = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const w = el.getBoundingClientRect().width
    if (w > 0) setScale(w / CARD_W)
  }, [])

  useEffect(() => {
    measure()
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  const engTop = BODY_TOP + lines.length * BODY_LINE_H + (mediaH ? MEDIA_GAP + mediaH : 0) + ENGAGE_GAP
  const meta = [m.handle, m.date].filter(Boolean).join("  ·  ")

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-[22px] shadow-2xl shadow-black/50"
      style={{ aspectRatio: `${CARD_W} / ${height}` }}
    >
      <div
        className="absolute left-0 top-0"
        style={{ width: CARD_W, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        <div className="relative h-full w-full" style={{ background: C.bg }}>
          {/* ambience */}
          <div
            className="absolute rounded-full"
            style={{
              left: -CARD_W * 0.4,
              top: -CARD_W * 0.4,
              width: CARD_W * 1.7,
              height: CARD_W * 1.7,
              background: "radial-gradient(circle, rgba(124,58,237,0.22), rgba(124,58,237,0) 70%)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              right: -CARD_W * 0.35,
              bottom: -CARD_W * 0.35,
              width: CARD_W * 1.5,
              height: CARD_W * 1.5,
              background: "radial-gradient(circle, rgba(34,211,238,0.14), rgba(34,211,238,0) 72%)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              left: -CARD_W * 0.2,
              bottom: -CARD_W * 0.3,
              width: CARD_W * 1.0,
              height: CARD_W * 1.0,
              background: "radial-gradient(circle, rgba(99,102,241,0.10), rgba(99,102,241,0) 70%)",
            }}
          />
          {/* violet → cyan hairline rim */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: RADIUS,
              padding: 1.5,
              background: RIM_GRADIENT,
              WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />

          <div className="relative h-full w-full" style={{ paddingLeft: PAD, paddingRight: PAD }}>
            {/* ── Header ── */}
            <div className="flex items-center" style={{ paddingTop: PAD, gap: 24 }}>
              {/* Avatar in the same violet → cyan ring the canvas paints. */}
              <span
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: AV_BOX,
                  height: AV_BOX,
                  background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarSrc}
                  alt=""
                  className="rounded-full object-cover"
                  style={{ width: AVATAR, height: AVATAR, background: C.bgLift }}
                />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center" style={{ gap: 10 }}>
                  <span
                    style={{
                      fontSize: NAME_FONT,
                      fontWeight: 700,
                      lineHeight: 1.05,
                      color: C.textStrong,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 500,
                    }}
                  >
                    {m.name}
                  </span>
                  {m.showVerified && (
                    <span
                      className="flex shrink-0 items-center justify-center rounded-full"
                      style={{
                        width: BADGE,
                        height: BADGE,
                        background: `linear-gradient(135deg, ${m.verifiedColors[0]}, ${m.verifiedColors[1]})`,
                      }}
                    >
                      <BadgeCheck style={{ width: 20, height: 20, color: "#FFFFFF" }} />
                    </span>
                  )}
                  {m.showPro && (
                    <span
                      className="flex shrink-0 items-center justify-center"
                      style={{
                        height: BADGE,
                        width: 72,
                        borderRadius: 999,
                        background: `linear-gradient(135deg, ${C.amberLight}, ${C.amber})`,
                        color: C.proText,
                        fontSize: 16,
                        fontWeight: 800,
                        letterSpacing: "0.02em",
                      }}
                    >
                      PRO
                    </span>
                  )}
                  {m.customColorList && (
                    <span
                      className="flex shrink-0 items-center justify-center rounded-full"
                      style={{
                        width: BADGE,
                        height: BADGE,
                        background: `linear-gradient(135deg, ${m.customColorList[0]}, ${m.customColorList[1] || m.customColorList[0]})`,
                      }}
                    >
                      <BadgeCheck style={{ width: 20, height: 20, color: "#FFFFFF" }} />
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 12, fontSize: META_FONT, lineHeight: 1, color: C.textMuted }}>
                  {meta}
                </div>
              </div>

              {/* App logo + wordmark, the brand slot at the top-right */}
              <span className="flex shrink-0 items-center" style={{ gap: WORDMARK_GAP }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoSrc}
                  alt="Loop"
                  style={{ width: LOGO, height: LOGO, borderRadius: LOGO * 0.24, objectFit: "cover" }}
                />
                <span
                  style={{
                    fontSize: WORDMARK_FONT,
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: "-0.01em",
                    color: WORDMARK_COLOR,
                  }}
                >
                  Loop
                </span>
              </span>
            </div>

            {/* ── Body ── */}
            <div style={{ paddingTop: HEADER_GAP }}>
              {lines.map((l, i) => (
                <p
                  key={i}
                  style={{
                    margin: 0,
                    height: BODY_LINE_H,
                    fontSize: BODY_FONT,
                    fontWeight: 500,
                    lineHeight: `${BODY_LINE_H}px`,
                    color: C.text,
                    whiteSpace: "pre",
                  }}
                >
                  {l}
                </p>
              ))}
            </div>

            {/* ── Post image ── */}
            {mediaSrc && mediaH ? (
              <div style={{ paddingTop: MEDIA_GAP }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaSrc}
                  alt=""
                  style={{
                    width: MEDIA_W,
                    height: mediaH,
                    borderRadius: 22,
                    objectFit: "cover",
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)",
                  }}
                />
              </div>
            ) : null}

            {/* ── Engagement row ── */}
            <div className="absolute flex items-center" style={{ top: engTop, left: PAD, gap: GAP_BETWEEN }}>
              <EngagementItem icon={<HeartGlyph />} label={fmt(m.likes)} />
              <EngagementItem icon={<ReplyGlyph />} label={fmt(m.replies)} />
              <EngagementItem icon={<RepostGlyph />} label={fmt(m.reposts)} />
              <span className="flex items-center" style={{ color: C.textMuted }}>
                <ShareGlyph />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Muted engagement item: stroked glyph + number, matching the canvas row. */
function EngagementItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="flex items-center" style={{ gap: GAP_AFTER_ICON, color: C.textMuted }}>
      {icon}
      <span style={{ fontSize: COUNT_FONT, fontWeight: 600 }}>{label}</span>
    </span>
  )
}

const glyphProps = {
  width: ICON,
  height: ICON,
  viewBox: "0 0 36 36",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}
function HeartGlyph() {
  return (
    <svg {...glyphProps}>
      <path d="M18 29.8c-6.6-5.8-11.8-10.5-11.8-15.5A6.8 6.8 0 0 1 18 10a6.8 6.8 0 0 1 11.8 4.3c0 5-5.2 9.7-11.8 15.5Z" />
    </svg>
  )
}
function ReplyGlyph() {
  return (
    <svg {...glyphProps}>
      <rect x="4.2" y="5" width="27.6" height="21.3" rx="7" />
      <path d="M12.7 26.3v5.5l6.1-5.5" />
    </svg>
  )
}
function RepostGlyph() {
  return (
    <svg {...glyphProps}>
      <path d="M7.5 13.3h19.6" />
      <path d="M22.7 8.9l4.7 4.4-4.7 4.4" />
      <path d="M28.5 22.7H8.9" />
      <path d="M13.3 18.3 8.6 22.7l4.7 4.4" />
    </svg>
  )
}
function ShareGlyph() {
  return (
    <svg {...glyphProps}>
      <path d="M9.2 15.8v15.2h17.7V15.8" />
      <path d="M18 23V4.5" />
      <path d="M13.3 9.2 18 4.5l4.7 4.7" />
    </svg>
  )
}

/* ── Main modal ── */
export function ShareAsImageModal({ open, onOpenChange, post }: ShareAsImageModalProps) {
  const { toast } = useToast()
  const badgeCatalog = useVerificationBadges()
  // Resolve the author's custom verification mark (admin-created badge) so the
  // share card can paint it alongside the verified / PRO badges.
  const resolvedBadge: ShareCardBadge | null = useMemo(() => {
    if (post.author.badge) return post.author.badge
    const id = post.author.badge_id
    if (!id) return null
    const found = badgeCatalog[id]
    if (!found) return null
    return { name: found.name, icon: found.icon, colors: found.colors }
  }, [post.author.badge, post.author.badge_id, badgeCatalog])

  const m = useMemo(() => model(post, resolvedBadge), [post, resolvedBadge])
  // The draw effect reads the model through a ref so re-renders of the parent
  // feed (new object identity every render) don't redraw the card. The stable
  // `key` below decides when a redraw is actually needed.
  const mRef = useRef(m)
  mRef.current = m

  const mediaSrc = useMemo(() => imageMediaUrl(post.media_url, post.media_type), [post.media_url, post.media_type])
  const proxiedMediaSrc = mediaSrc ? proxyUrl(mediaSrc) : null

  // Body wrapping drives the card height, so both the canvas and the preview
  // render exactly the same lines. The first pass is an estimate so the server
  // and the first client render agree (no hydration mismatch).
  const [lines, setLines] = useState<string[]>(() => {
    const body = m.body
    const estimated = estimateLines(body)
    return Array.from({ length: estimated }, () => "")
  })
  /** Media height is resolved on the client (from the real image) — null until then. */
  const [mediaH, setMediaH] = useState<number | null>(null)
  /** Preview needs a logo URL up front; the canvas gets the bitmap. */
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO_IMG)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)
  const [exporting, setExporting] = useState(false)
  const avRef = useRef<AV | null>(null)
  const logoRef = useRef<AV | null>(null)
  const mediaRef = useRef<AV | null>(null)
  const mediaUrlRef = useRef<string | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const genRef = useRef(0)

  useEffect(() => {
    setLines(measureLines(m.body) || [m.body])
  }, [m.body])

  // Keep the preview's app mark in sync with the admin-configured logo.
  useEffect(() => {
    let active = true
    void getLogoSrc().then((url) => {
      if (active && url) setLogoSrc(url)
    })
    return () => {
      active = false
    }
  }, [])

  const height = useMemo(() => cardHeight(lines.length, mediaH), [lines.length, mediaH])

  const key = useMemo(
    () =>
      [
        post.id,
        post.content,
        post.created_at,
        post.author.username,
        post.author.display_name,
        post.author.avatar_url,
        post.author.is_verified,
        post.author.is_premium,
        (resolvedBadge?.colors || []).join(","),
        post.stats?.likes_count,
        post.stats?.comments_count,
        post.stats?.branches_count,
        mediaSrc || "",
      ].join("|"),
    [
      post.id,
      post.content,
      post.created_at,
      post.author.username,
      post.author.display_name,
      post.author.avatar_url,
      post.author.is_verified,
      post.author.is_premium,
      resolvedBadge?.colors,
      post.stats?.likes_count,
      post.stats?.comments_count,
      post.stats?.branches_count,
      mediaSrc,
    ],
  )

  useEffect(() => {
    if (!open) {
      setRendered(false)
      setExporting(false)
      blobRef.current = null
      avRef.current = null
      logoRef.current = null
      mediaRef.current = null
      mediaUrlRef.current = null
      setMediaH(null)
      return
    }
    const g = ++genRef.current
    let c = false
    setRendered(false)
    const run = async () => {
      const cv = canvasRef.current
      if (!cv) return
      try {
        // Post image first — its height is part of the card's height.
        if (proxiedMediaSrc && mediaUrlRef.current !== proxiedMediaSrc) {
          mediaRef.current = await loadAv(proxiedMediaSrc)
          mediaUrlRef.current = proxiedMediaSrc
          if (c || genRef.current !== g) return
        }
        if (!proxiedMediaSrc) {
          mediaRef.current = null
          mediaUrlRef.current = null
        }
        const mh = mediaRef.current ? mediaBoxHeight(mediaRef.current) : null
        setMediaH(mh)

        // Always same-origin for the canvas: a cross-origin avatar would taint
        // it and make toBlob() throw, leaving the preview stuck.
        const avUrl = proxyUrl(
          post.author.avatar_url || getDiceBearUrl(post.author.username),
        )
        const loadLogo = async (): Promise<AV | null> => {
          const url = await getLogoSrc()
          let img = await loadAv(url)
          const dim = img ? avDim(img) : null
          // A logo we can't rasterise (some browsers refuse SVGs with no
          // intrinsic size) falls back to the bundled icon, then to the mark.
          if ((!img || !dim?.w || !dim?.h) && url !== DEFAULT_LOGO_IMG) img = await loadAv(DEFAULT_LOGO_IMG)
          return img
        }
        const [av, logo] = await Promise.all([
          avRef.current ? Promise.resolve(avRef.current) : loadAv(avUrl),
          logoRef.current ? Promise.resolve(logoRef.current) : loadLogo(),
        ])
        if (c || genRef.current !== g) return
        avRef.current = av
        logoRef.current = logo
        drawCard(cv, mRef.current, lines, mh, SCALE, av, logo, mediaRef.current)
        if (c || genRef.current !== g) return
        blobRef.current = await toBlob(cv)
        setRendered(true)
      } catch {
        if (!c) setRendered(false)
      }
    }
    const t = window.setTimeout(() => void run(), 80)
    return () => {
      c = true
      clearTimeout(t)
    }
  }, [open, key, lines, proxiedMediaSrc, post.author.avatar_url, post.author.username])

  const getBlob = async (): Promise<Blob> => {
    if (blobRef.current) return blobRef.current
    const cv = canvasRef.current
    if (!cv) throw new Error("Canvas not ready")
    drawCard(cv, mRef.current, lines, mediaH, SCALE, avRef.current, logoRef.current, mediaRef.current)
    const b = await toBlob(cv)
    blobRef.current = b
    return b
  }

  const download = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const b = await getBlob()
      const url = URL.createObjectURL(b)
      const a = document.createElement("a")
      a.href = url
      a.download = `loop-${post.id}.jpg`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast({ title: "Downloaded", description: "Share it anywhere." })
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const share = async () => {
    try {
      const b = await getBlob()
      const f = new File([b], `loop-${post.id}.jpg`, { type: "image/jpeg" })
      if (navigator.share && navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: "Loop", text: post.content.slice(0, 120) })
        toast({ title: "Shared!" })
      } else await download()
    } catch (e: any) {
      if (e?.name !== "AbortError")
        toast({ title: "Couldn't share", description: e.message, variant: "destructive" })
    }
  }

  const avatarSrc = post.author.avatar_url
    ? proxyUrl(post.author.avatar_url)
    : getDiceBearUrl(post.author.username)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto border-border bg-card text-card-foreground shadow-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Share2 className="h-4 w-4 text-violet-500" /> Share as image
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            A crisp {CARD_W}px wide card for X, Instagram, or anywhere.
          </DialogDescription>
        </DialogHeader>
        <canvas ref={canvasRef} className="hidden" />
        <div className="relative">
          <CardPreview
            m={m}
            lines={lines}
            avatarSrc={avatarSrc}
            logoSrc={logoSrc}
            mediaSrc={proxiedMediaSrc}
            mediaH={mediaH}
            height={height}
          />
          {!rendered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-[22px] bg-background/70 backdrop-blur-[1px]">
              <Spinner className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Preparing image...</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => void download()}
            disabled={exporting}
            className="border-border bg-background text-foreground hover:bg-muted"
          >
            {exporting ? <Spinner className="mr-1.5 h-4 w-4" /> : <Download className="mr-1.5 h-4 w-4" />} Download
          </Button>
          <Button
            onClick={() => void share()}
            className="bg-gradient-to-br from-violet-500 to-purple-600 text-white hover:from-violet-400 hover:to-purple-500"
          >
            <Share2 className="mr-1.5 h-4 w-4" /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
