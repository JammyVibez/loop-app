"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Download, Share2, BadgeCheck, Moon, Sun, RotateCcw } from "lucide-react"
import { getDiceBearUrl } from "@/lib/dicebear"
import { Spinner } from "@/components/ui/skeletons"
import { useVerificationBadges } from "@/hooks/use-verification-badges"
import { cn } from "@/lib/utils"

export interface ShareCardBadge {
  name?: string | null
  icon?: string | null
  colors?: string[] | null
}

/** The embedded original of a quote rebranch. */
export interface ShareCardQuote {
  text: string
  created_at?: string
  media_url?: string
  media_type?: string
  author: {
    username: string
    display_name: string
    avatar_url?: string
    is_verified?: boolean
  }
}

interface ShareAsImageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Original post embedded inside this one (quote rebranch). */
  quoted?: ShareCardQuote | null
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
      /** Rebranches (quotes) — tracked on loops.quote_count. */
      quotes_count?: number
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
/** Hairline ring around the avatar. */
const RING = 2
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

/* ── Quote block (quote rebranch) ──
 * The embedded original sits below the commentary in a lifted panel: small
 * avatar + attribution row, then the original's text, then its media when it
 * can be drawn.
 */
const QUOTE_BLOCK_GAP = 44
const QUOTE_PAD = 36
const QUOTE_AV = 64
const QUOTE_NAME_FONT = 30
const QUOTE_TEXT_FONT = 32
const QUOTE_TEXT_LINE = 1.45
const QUOTE_MAX_LINES = 6
const QUOTE_HEADER_GAP = 18
const QUOTE_MEDIA_GAP = 26
const QUOTE_MEDIA_MIN_H = 160
const QUOTE_MEDIA_MAX_H = 300
const QUOTE_TEXT_LINE_H = QUOTE_TEXT_FONT * QUOTE_TEXT_LINE
const QUOTE_TEXT_W = CARD_W - PAD * 2 - QUOTE_PAD * 2

/** Height of the quote panel (including the gap above it). */
function quotePanelHeight(lineCount: number, mediaH: number | null) {
  return (
    QUOTE_BLOCK_GAP +
    QUOTE_PAD * 2 +
    QUOTE_AV +
    QUOTE_HEADER_GAP +
    Math.max(1, lineCount) * QUOTE_TEXT_LINE_H +
    (mediaH ? QUOTE_MEDIA_GAP + mediaH : 0)
  )
}

/** Total card height for a given number of wrapped body lines (+ media, + quote). */
function cardHeight(
  lineCount: number,
  mediaH: number | null,
  quoteLines = 0,
  quoteMediaH: number | null = null,
  showStats = true,
) {
  return (
    BODY_TOP +
    Math.max(1, lineCount) * BODY_LINE_H +
    (quoteLines ? quotePanelHeight(quoteLines, quoteMediaH) : 0) +
    (mediaH ? MEDIA_GAP + mediaH : 0) +
    (showStats ? ENGAGE_GAP + ICON : 0) +
    PAD
  )
}
/** Rough line count used for the very first (server) render. */
function estimateLines(body: string) {
  const perLine = Math.max(1, Math.floor((CARD_W - PAD * 2) / (BODY_FONT * 0.5)))
  return Math.min(MAX_LINES, Math.max(1, Math.ceil(body.trim().length / perLine)))
}

/* ── Palette ─────────────────────────────────────────────────────────────
 * Two themes, both flat — no gradients. The only colour on a card comes from
 * the app icon, the author's badges and the accent the user picks in the
 * designer. "dark" is the deep navy-black original; "light" is the same card
 * in white for feeds and docs that render on white.
 */
export type CardTheme = "dark" | "light"

export interface ShareDesign {
  theme: CardTheme
  /** Accent used for the wordmark and the fallback verified seal. */
  accent: string
  /** Engagement row (hearts / replies / reposts). */
  showStats: boolean
  /** App icon + "Loop" wordmark on the card. */
  showBrand: boolean
}

interface Palette {
  bg: string
  bgLift: string
  rim: string
  avatarRing: string
  text: string
  textStrong: string
  textMuted: string
  wordmark: string
  quoteStroke: string
  mediaStroke: string
  letter: string
  shadow: string
  /** Brand constants that survive both themes. */
  cyan: string
  amberLight: string
  proText: string
}

const DARK: Palette = {
  bg: "#0A0C18",
  bgLift: "#161B2E",
  rim: "rgba(255,255,255,0.10)",
  avatarRing: "rgba(255,255,255,0.14)",
  text: "rgba(255,255,255,0.96)",
  textStrong: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.55)",
  wordmark: "rgba(255,255,255,0.92)",
  quoteStroke: "rgba(255,255,255,0.08)",
  mediaStroke: "rgba(255,255,255,0.10)",
  letter: "rgba(255,255,255,0.85)",
  shadow: "rgba(0,0,0,0.55)",
  cyan: "#22D3EE",
  amberLight: "#FBBF24",
  proText: "#241505",
}

const LIGHT: Palette = {
  bg: "#FFFFFF",
  bgLift: "#F2F3F7",
  rim: "rgba(13,16,32,0.12)",
  avatarRing: "rgba(13,16,32,0.12)",
  text: "rgba(17,20,33,0.94)",
  textStrong: "#0B0E1A",
  textMuted: "rgba(17,20,33,0.52)",
  wordmark: "#0B0E1A",
  quoteStroke: "rgba(13,16,32,0.10)",
  mediaStroke: "rgba(13,16,32,0.12)",
  letter: "rgba(11,14,26,0.72)",
  shadow: "rgba(13,16,32,0.35)",
  cyan: "#0891B2",
  amberLight: "#F59E0B",
  proText: "#241505",
}

function palette(theme: CardTheme): Palette {
  return theme === "light" ? LIGHT : DARK
}

/** `#22D3EE` + 0.6 → `rgba(34,211,238,0.6)` — accents get used at opacity. */
function hexAlpha(hex: string, alpha: number) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return `rgba(34,211,238,${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Accent swatches offered in the designer — brand cyan first. */
export const ACCENT_SWATCHES = ["#22D3EE", "#7C3AED", "#6366F1", "#14B8A6", "#22C55E", "#F59E0B", "#EF4444", "#EC4899"] as const

export const DEFAULT_DESIGN: ShareDesign = { theme: "dark", accent: "#22D3EE", showStats: true, showBrand: true }

const DESIGN_STORAGE_KEY = "loop-share-design"

/** The user's saved card design, tolerating anything stored under the key. */
export function loadShareDesign(): ShareDesign {
  if (typeof window === "undefined") return DEFAULT_DESIGN
  try {
    const raw = window.localStorage.getItem(DESIGN_STORAGE_KEY)
    if (!raw) return DEFAULT_DESIGN
    const parsed = JSON.parse(raw)
    return {
      theme: parsed?.theme === "light" ? "light" : "dark",
      accent:
        typeof parsed?.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(parsed.accent)
          ? parsed.accent
          : DEFAULT_DESIGN.accent,
      showStats: parsed?.showStats !== false,
      showBrand: parsed?.showBrand !== false,
    }
  } catch {
    return DEFAULT_DESIGN
  }
}

export function saveShareDesign(design: ShareDesign) {
  try {
    window.localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(design))
  } catch {
    /* private mode — the design still applies for this session */
  }
}

/**
 * The palette the card is currently drawn in.
 *
 * Canvas renderer and HTML mirror both read it, and only one share dialog can
 * exist at a time, so it is switched as a unit whenever the designer's theme
 * changes (see `setCardPalette`) instead of threading a palette argument
 * through forty call sites — where a single missed one would ship a white card
 * with white text.
 */
let C: Palette = palette(DEFAULT_DESIGN.theme)
function setCardPalette(theme: CardTheme) {
  C = palette(theme)
}
/** The wordmark: theme ink, tuned with the accent when one is picked. */
const WORDMARK_COLOR = C.wordmark

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
/** Flat disc with a check — the verified seal / custom admin mark. */
function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colors: string[]) {
  ctx.save()
  circle(ctx, x + size / 2, y + size / 2, size / 2)
  ctx.fillStyle = colors[0] || C.cyan
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.35)"
  ctx.lineWidth = 1.2
  circle(ctx, x + size / 2, y + size / 2, size / 2 - 0.6)
  ctx.stroke()
  drawCheck(ctx, x + size / 2, y + size / 2, size)
  ctx.restore()
}
/** PRO pill — flat amber, dark label. Width is returned so callers stack. */
function drawPro(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  const w = 72
  ctx.save()
  rr(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = C.amberLight
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
  rr(ctx, x, y, size, size, size * 0.3)
  ctx.fillStyle = "#7C3AED"
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

/**
 * Load the app logo as a base64 data URI so the canvas never has a CORS
 * or timeout issue. The OG route uses the same pattern.
 */
let logoDataUriCache: string | null = null
let logoDataUriPromise: Promise<string | null> | null = null
async function loadLogoAsDataUri(): Promise<string | null> {
  if (logoDataUriCache !== null) return logoDataUriCache
  if (logoDataUriPromise) return logoDataUriPromise
  logoDataUriPromise = (async () => {
    try {
      const res = await fetch("/icons/icon-512x512.png", { cache: "force-cache" })
      if (!res.ok) { logoDataUriCache = null; return null }
      const buf = await res.arrayBuffer()
      if (buf.byteLength === 0 || buf.byteLength > 2_000_000) { logoDataUriCache = null; return null }
      const bytes = new Uint8Array(buf)
      let binary = ""
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      logoDataUriCache = `data:image/png;base64,${btoa(binary)}`
      return logoDataUriCache
    } catch {
      logoDataUriCache = null
      return null
    } finally {
      logoDataUriPromise = null
    }
  })()
  return logoDataUriPromise
}

/**
 * Load the logo bitmap for the canvas, guaranteed to succeed: tries the admin
 * logo first (which may be external), then falls back to the local icon, and
 * if everything fails, draws the purple "L" mark.
 */
async function ensureLogoBitmap(): Promise<AV | null> {
  // If we already have it in a ref, reuse it.
  // Try the admin-configured logo (may be external, may fail).
  const adminUrl = await getLogoSrc().catch(() => DEFAULT_LOGO_IMG)
  if (adminUrl && adminUrl !== DEFAULT_LOGO_IMG) {
    const img = await loadAv(adminUrl)
    if (img) {
      const dim = avDim(img)
      if (dim.w && dim.h) return img
    }
  }
  // Always succeeds: same-origin PNG.
  const fallback = await loadAv(DEFAULT_LOGO_IMG)
  return fallback
}
/** The wordmark that sits beside the app icon. */
function drawWordmark(ctx: CanvasRenderingContext2D, x: number, baseline: number, color = WORDMARK_COLOR) {
  ctx.save()
  ctx.font = font(800, WORDMARK_FONT)
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = color
  ctx.fillText("Loop", x, baseline)
  ctx.restore()
}

/* ── Engagement glyphs, stroked to match the muted footer ── */
function strokeGlyph(ctx: CanvasRenderingContext2D, size: number, muted = C.textMuted) {
  ctx.strokeStyle = muted
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
function measureLines(body: string, fontPx = BODY_FONT, maxW = CARD_W - PAD * 2, maxLines = MAX_LINES): string[] | null {
  if (typeof document === "undefined") return null
  const c = document.createElement("canvas")
  const ctx = c.getContext("2d")
  if (!ctx) return null
  ctx.font = font(500, fontPx)
  return wrapLines(ctx, body, maxW, maxLines)
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
  /** Embedded original of a quote rebranch, when there is one. */
  quote: {
    name: string
    handle: string
    body: string
    showVerified: boolean
    hasMedia: boolean
  } | null
}

function model(
  post: ShareAsImageModalProps["post"],
  resolvedBadge?: ShareCardBadge | null,
  quoted?: ShareCardQuote | null,
): CardModel {
  const badge = post.author.badge || resolvedBadge || null
  return {
    name: truncate(post.author.display_name || post.author.username || "User", 40),
    handle: `@${truncate(post.author.username || "user", 30)}`,
    date: cardDate(post.created_at),
    likes: Number(post.stats?.likes_count || 0),
    replies: Number(post.stats?.comments_count || 0),
    // Rebranches (quotes) count as reposts on the card — the original post's
    // stat tracks both plain branches and quote rebranches.
    reposts: Number(post.stats?.branches_count || 0) + Number(post.stats?.quotes_count || 0),
    body: truncate(post.content || "Shared a loop on Loop.", 600),
    showVerified: Boolean(post.author.is_verified),
    showPro: Boolean(post.author.is_premium),
    verifiedColors: [C.cyan, "#818CF8"],
    customColorList: badge ? normalizeColors(badge) : null,
    quote: quoted
      ? {
          name: truncate(quoted.author.display_name || quoted.author.username || "User", 40),
          handle: `@${truncate(quoted.author.username || "user", 30)}`,
          body: truncate(quoted.text || "(media post)", 400),
          showVerified: Boolean(quoted.author.is_verified),
          hasMedia: Boolean(imageMediaUrl(quoted.media_url, quoted.media_type)),
        }
      : null,
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
  p: { bgLift: string; mediaStroke: string } = C,
) {
  const { w: iw, h: ih } = avDim(img)
  if (!iw || !ih) return
  const k = Math.max(w / iw, h / ih)
  const dw = iw * k
  const dh = ih * k
  ctx.save()
  rr(ctx, x, y, w, h, radius)
  ctx.clip()
  ctx.fillStyle = p.bgLift
  ctx.fillRect(x, y, w, h)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
  rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius)
  ctx.strokeStyle = p.mediaStroke
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
  design: ShareDesign,
  quoteLines: string[] = [],
  quoteAv: AV | null = null,
  quoteMedia: AV | null = null,
  quoteMediaH: number | null = null,
) {
  const qh = m.quote ? quotePanelHeight(quoteLines.length, quoteMediaH) : 0
  const h = cardHeight(lines.length, mediaH, m.quote ? quoteLines.length : 0, qh ? quoteMediaH : null, design.showStats)
  const ctx = setup(canvas, CARD_W, h, scale)
  if (!ctx) return

  // ── Background: one flat fill, no ambience ──
  // Painted first so the rounded-corner cut-outs are the card colour, not
  // transparent (JPEG has no alpha), then clipped to round the card itself.
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_W, h)
  rr(ctx, 0, 0, CARD_W, h, RADIUS)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_W, h)
  ctx.restore()

  // Flat hairline rim — no gradient, no heavy border.
  rr(ctx, 0.5, 0.5, CARD_W - 1, h - 1, RADIUS)
  ctx.strokeStyle = C.rim
  ctx.lineWidth = 1
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

  // Ring in the designer's accent, so the card's colour is the user's choice.
  ctx.save()
  ctx.strokeStyle = hexAlpha(design.accent, design.theme === "light" ? 0.55 : 0.75)
  ctx.lineWidth = RING
  circle(ctx, avCx, avCy, avR + RING / 2)
  ctx.stroke()
  ctx.restore()

  // Brand: the real app icon + wordmark, far top-right (the Substack slot).
  // Hidden entirely when the designer turns branding off.
  let brandLeft = CARD_W - PAD
  if (design.showBrand) {
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
    drawWordmark(ctx, wordmarkX, logoBaseline + LOGO / 2 + WORDMARK_FONT * 0.35, C.wordmark)
    brandLeft = wordmarkX - WORDMARK_GAP - LOGO
  }

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
    drawSeal(ctx, bx, by, BADGE, [design.accent, "#818CF8"])
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

  /* ── Quote block: the embedded original, in a lifted panel ── */
  if (m.quote) {
    const qx = PAD
    const qy = afterBody + QUOTE_BLOCK_GAP
    const qw = MEDIA_W
    const qInnerW = qw - QUOTE_PAD * 2
    const qLineCount = Math.max(1, quoteLines.length)
    const qHeight = quotePanelHeight(qLineCount, quoteMediaH) - QUOTE_BLOCK_GAP

    rr(ctx, qx, qy, qw, qHeight, 24)
    ctx.fillStyle = C.bgLift
    ctx.fill()
    ctx.strokeStyle = "rgba(255,255,255,0.08)"
    ctx.lineWidth = 1
    ctx.stroke()

    const qavR = QUOTE_AV / 2
    const qavCx = qx + QUOTE_PAD + qavR
    const qavCy = qy + QUOTE_PAD + qavR
    ctx.save()
    circle(ctx, qavCx, qavCy, qavR)
    ctx.clip()
    ctx.fillStyle = "rgba(255,255,255,0.08)"
    ctx.fillRect(qavCx - qavR, qavCy - qavR, QUOTE_AV, QUOTE_AV)
    if (quoteAv) {
      const { w: qw2, h: qh2 } = avDim(quoteAv)
      const sz = Math.min(qw2, qh2)
      ctx.imageSmoothingQuality = "high"
      ctx.drawImage(quoteAv, (qw2 - sz) / 2, (qh2 - sz) / 2, sz, sz, qavCx - qavR, qavCy - qavR, QUOTE_AV, QUOTE_AV)
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.7)"
      ctx.font = font(800, 28)
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText((m.quote.name || "U").charAt(0).toUpperCase(), qavCx, qavCy + 1)
    }
    ctx.restore()

    const qNameX = qx + QUOTE_PAD + QUOTE_AV + 18
    const qNameBase = qavCy - QUOTE_AV * 0.08
    const qTextX = qNameX
    ctx.save()
    ctx.font = font(700, QUOTE_NAME_FONT)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = C.textStrong
    let qName = m.quote.name
    const qNameMax = qx + qw - QUOTE_PAD - qNameX - (m.quote.showVerified ? BADGE + 10 : 0)
    while (qName.length > 1 && ctx.measureText(qName).width > qNameMax) qName = qName.slice(0, -1)
    ctx.fillText(qName, qNameX, qNameBase)
    const qNameW = ctx.measureText(qName).width
    ctx.restore()

    if (m.quote.showVerified) {
      drawSeal(ctx, qNameX + qNameW + 10, qNameBase - QUOTE_NAME_FONT * 0.78, BADGE, [design.accent, "#818CF8"])
    }

    ctx.save()
    ctx.font = font(400, META_FONT)
    ctx.fillStyle = C.textMuted
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.fillText(m.quote.handle, qNameX, qNameBase + 36)
    ctx.restore()

    ctx.save()
    ctx.font = font(500, QUOTE_TEXT_FONT)
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.fillStyle = C.text
    let qty = qy + QUOTE_PAD + QUOTE_AV + QUOTE_HEADER_GAP
    for (const l of quoteLines) {
      ctx.fillText(l, qTextX, qty)
      qty += QUOTE_TEXT_LINE_H
    }
    ctx.restore()

    if (quoteMedia && quoteMediaH) {
      drawCover(ctx, quoteMedia, qx + QUOTE_PAD, qty + QUOTE_MEDIA_GAP, qInnerW, quoteMediaH, 16)
    }

    afterBody = qy + qHeight
  }

  if (media && mediaH) {
    drawCover(ctx, media, PAD, afterBody + MEDIA_GAP, MEDIA_W, mediaH, 22)
    afterBody += MEDIA_GAP + mediaH
  }

  /* ── Engagement row, directly beneath the text (or the image) ──
   * Optional: the designer can drop it for a cleaner card.
   */
  if (!design.showStats) return
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

/** PNG — the spec asks for a shareable PNG, and lossless keeps text crisp. */
function toBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/png"))
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
  design,
  quoteLines = [],
  quoteAvatarSrc,
  quoteMediaSrc,
  quoteMediaH,
}: {
  m: CardModel
  lines: string[]
  avatarSrc: string
  logoSrc: string
  mediaSrc: string | null
  mediaH: number | null
  height: number
  design: ShareDesign
  quoteLines?: string[]
  quoteAvatarSrc?: string
  quoteMediaSrc?: string | null
  quoteMediaH?: number | null
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

  const quoteH = m.quote ? quotePanelHeight(quoteLines.length, quoteMediaH ?? null) : 0
  const engTop =
    BODY_TOP +
    lines.length * BODY_LINE_H +
    quoteH +
    (mediaH ? MEDIA_GAP + mediaH : 0) +
    ENGAGE_GAP
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
          {/* flat hairline rim */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ borderRadius: RADIUS, boxShadow: `inset 0 0 0 1px ${C.rim}` }}
          />

          <div className="relative h-full w-full" style={{ paddingLeft: PAD, paddingRight: PAD }}>
            {/* ── Header ── */}
            <div className="flex items-center" style={{ paddingTop: PAD, gap: 24 }}>
              {/* Avatar in the same flat hairline ring the canvas paints. */}
              <span
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: AV_BOX,
                  height: AV_BOX,
                  background: hexAlpha(design.accent, design.theme === "light" ? 0.55 : 0.75),
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
                        background: design.accent,
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
                        background: C.amberLight,
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
                        background: m.customColorList[0],
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
              {design.showBrand && (
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
                      color: C.wordmark,
                    }}
                  >
                    Loop
                  </span>
                </span>
              )}
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

            {/* ── Quote block: the embedded original ── */}
            {m.quote && quoteH > 0 ? (
              <div
                style={{
                  marginTop: QUOTE_BLOCK_GAP,
                  width: MEDIA_W,
                  padding: QUOTE_PAD,
                  borderRadius: 24,
                  background: C.bgLift,
                  boxShadow: `inset 0 0 0 1px ${C.quoteStroke}`,
                  boxSizing: "border-box",
                }}
              >
                <div className="flex items-center" style={{ gap: 18 }}>
                  <span
                    className="flex shrink-0 items-center justify-center rounded-full"
                    style={{ width: QUOTE_AV, height: QUOTE_AV, background: C.quoteStroke }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={quoteAvatarSrc}
                      alt=""
                      className="rounded-full object-cover"
                      style={{ width: QUOTE_AV, height: QUOTE_AV, background: C.bgLift }}
                    />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center" style={{ gap: 10 }}>
                      <span
                        style={{
                          fontSize: QUOTE_NAME_FONT,
                          fontWeight: 700,
                          lineHeight: 1.05,
                          color: C.textStrong,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 420,
                        }}
                      >
                        {m.quote.name}
                      </span>
                      {m.quote.showVerified && (
                        <span
                          className="flex shrink-0 items-center justify-center rounded-full"
                          style={{ width: BADGE, height: BADGE, background: design.accent }}
                        >
                          <BadgeCheck style={{ width: 20, height: 20, color: "#FFFFFF" }} />
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 10, fontSize: META_FONT, lineHeight: 1, color: C.textMuted }}>
                      {m.quote.handle}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: QUOTE_HEADER_GAP, paddingLeft: QUOTE_AV + 18 }}>
                  {quoteLines.map((l, i) => (
                    <p
                      key={i}
                      style={{
                        margin: 0,
                        height: QUOTE_TEXT_LINE_H,
                        fontSize: QUOTE_TEXT_FONT,
                        fontWeight: 500,
                        lineHeight: `${QUOTE_TEXT_LINE_H}px`,
                        color: C.text,
                        whiteSpace: "pre",
                      }}
                    >
                      {l}
                    </p>
                  ))}
                  {quoteMediaSrc && quoteMediaH ? (
                    <div style={{ marginTop: QUOTE_MEDIA_GAP }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={quoteMediaSrc}
                        alt=""
                        style={{
                          width: MEDIA_W - QUOTE_PAD * 2 - (QUOTE_AV + 18),
                          height: quoteMediaH,
                          borderRadius: 16,
                          objectFit: "cover",
                          boxShadow: `inset 0 0 0 1px ${C.mediaStroke}`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

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
                    boxShadow: `inset 0 0 0 1px ${C.mediaStroke}`,
                  }}
                />
              </div>
            ) : null}

            {/* ── Engagement row ── */}
            {design.showStats && (
              <div className="absolute flex items-center" style={{ top: engTop, left: PAD, gap: GAP_BETWEEN }}>
                <EngagementItem icon={<HeartGlyph />} label={fmt(m.likes)} />
                <EngagementItem icon={<ReplyGlyph />} label={fmt(m.replies)} />
                <EngagementItem icon={<RepostGlyph />} label={fmt(m.reposts)} />
                <span className="flex items-center" style={{ color: C.textMuted }}>
                  <ShareGlyph />
                </span>
              </div>
            )}
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
export function ShareAsImageModal({ open, onOpenChange, post, quoted }: ShareAsImageModalProps) {
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

  // The designer: theme (black / white), accent, and what the card shows.
  // Saved so the next share starts the way this one looks.
  const [design, setDesignState] = useState<ShareDesign>(() => loadShareDesign())
  const updateDesign = (patch: Partial<ShareDesign>) => {
    const next = { ...design, ...patch }
    setDesignState(next)
    saveShareDesign(next)
    setCardPalette(next.theme)
  }

  // Reopening the dialog after another card changed the theme must not inherit
  // a stale palette.
  useEffect(() => {
    if (open) setCardPalette(design.theme)
  }, [open, design.theme])

  // The draw effect reads the design through a ref so a palette switch alone
  // doesn't tear down image loading — the `key` below still forces the redraw.
  const designRef = useRef(design)
  designRef.current = design

  const m = useMemo(() => model(post, resolvedBadge, quoted), [post, resolvedBadge, quoted])
  // The draw effect reads the model through a ref so re-renders of the parent
  // feed (new object identity every render) don't redraw the card. The stable
  // `key` below decides when a redraw is actually needed.
  const mRef = useRef(m)
  mRef.current = m

  const mediaSrc = useMemo(() => imageMediaUrl(post.media_url, post.media_type), [post.media_url, post.media_type])
  const proxiedMediaSrc = mediaSrc ? proxyUrl(mediaSrc) : null

  const quoteMediaSrc = useMemo(
    () => (quoted ? imageMediaUrl(quoted.media_url, quoted.media_type) : null),
    [quoted?.media_url, quoted?.media_type],
  )
  const proxiedQuoteMediaSrc = quoteMediaSrc ? proxyUrl(quoteMediaSrc) : null

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
  /** Same for the quoted original's text and media. */
  const [quoteLines, setQuoteLines] = useState<string[]>([])
  const [quoteMediaH, setQuoteMediaH] = useState<number | null>(null)
  /** Preview needs a logo URL up front; the canvas gets the bitmap. */
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO_IMG)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)
  const [exporting, setExporting] = useState(false)
  const avRef = useRef<AV | null>(null)
  const logoRef = useRef<AV | null>(null)
  const mediaRef = useRef<AV | null>(null)
  const mediaUrlRef = useRef<string | null>(null)
  const quoteAvRef = useRef<AV | null>(null)
  const quoteMediaRef = useRef<AV | null>(null)
  const quoteMediaUrlRef = useRef<string | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const genRef = useRef(0)

  useEffect(() => {
    setLines(measureLines(m.body) || [m.body])
    if (m.quote) {
      setQuoteLines(measureLines(m.quote.body, QUOTE_TEXT_FONT, QUOTE_TEXT_W, QUOTE_MAX_LINES) || [m.quote.body])
    } else {
      setQuoteLines([])
      setQuoteMediaH(null)
    }
  }, [m.body, m.quote?.body])

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

  const height = useMemo(
    () =>
      cardHeight(
        lines.length,
        mediaH,
        m.quote ? quoteLines.length : 0,
        m.quote ? quoteMediaH : null,
        design.showStats,
      ),
    [lines.length, mediaH, m.quote, quoteLines.length, quoteMediaH, design.showStats],
  )

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
        post.stats?.quotes_count,
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
      post.stats?.quotes_count,
      mediaSrc,
      quoted?.author.username,
      quoted?.author.display_name,
      quoted?.author.avatar_url,
      quoted?.author.is_verified,
      quoted?.text,
      quoteMediaSrc,
      design.theme,
      design.accent,
      design.showStats,
      design.showBrand,
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
      quoteAvRef.current = null
      quoteMediaRef.current = null
      quoteMediaUrlRef.current = null
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

        // Quoted original's media + avatar (same-origin proxy, no tainting).
        if (proxiedQuoteMediaSrc && quoteMediaUrlRef.current !== proxiedQuoteMediaSrc) {
          quoteMediaRef.current = await loadAv(proxiedQuoteMediaSrc)
          quoteMediaUrlRef.current = proxiedQuoteMediaSrc
          if (c || genRef.current !== g) return
        }
        if (!proxiedQuoteMediaSrc) {
          quoteMediaRef.current = null
          quoteMediaUrlRef.current = null
        }
        const qmh = quoteMediaRef.current ? mediaBoxHeight(quoteMediaRef.current) : null
        setQuoteMediaH(qmh)

        // Always same-origin for the canvas: a cross-origin avatar would taint
        // it and make toBlob() throw, leaving the preview stuck.
        const avUrl = proxyUrl(
          post.author.avatar_url || getDiceBearUrl(post.author.username),
        )
        const quoteAvUrl = quoted
          ? proxyUrl(quoted.author.avatar_url || getDiceBearUrl(quoted.author.username))
          : null
        const [av, logo, quoteAv] = await Promise.all([
          avRef.current ? Promise.resolve(avRef.current) : loadAv(avUrl),
          logoRef.current ? Promise.resolve(logoRef.current) : ensureLogoBitmap(),
          quoteAvUrl ? (quoteAvRef.current ? Promise.resolve(quoteAvRef.current) : loadAv(quoteAvUrl)) : Promise.resolve(null),
        ])
        if (c || genRef.current !== g) return
        avRef.current = av
        logoRef.current = logo
        quoteAvRef.current = quoteAv
        drawCard(cv, mRef.current, lines, mh, SCALE, av, logo, mediaRef.current, designRef.current, quoteLines, quoteAv, quoteMediaRef.current, qmh)
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
  }, [open, key, lines, quoteLines, proxiedMediaSrc, proxiedQuoteMediaSrc, post.author.avatar_url, post.author.username])

  const getBlob = async (): Promise<Blob> => {
    if (blobRef.current) return blobRef.current
    const cv = canvasRef.current
    if (!cv) throw new Error("Canvas not ready")

    // Ensure assets are loaded — the user might click Download before the
    // initial render effect completes, leaving a ref null.
    if (!avRef.current || !logoRef.current) {
      const avUrl = proxyUrl(
        post.author.avatar_url || getDiceBearUrl(post.author.username),
      )
      const [av, logo] = await Promise.all([
        avRef.current || loadAv(avUrl),
        logoRef.current || ensureLogoBitmap(),
      ])
      avRef.current = av
      logoRef.current = logo
    }

    drawCard(cv, mRef.current, lines, mediaH, SCALE, avRef.current, logoRef.current, mediaRef.current, designRef.current, quoteLines, quoteAvRef.current, quoteMediaRef.current, quoteMediaH)
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
      a.download = `loop-${post.id}.png`
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
      const f = new File([b], `loop-${post.id}.png`, { type: "image/png" })
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
  const quoteAvatarSrc = quoted
    ? quoted.author.avatar_url
      ? proxyUrl(quoted.author.avatar_url)
      : getDiceBearUrl(quoted.author.username)
    : undefined

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
            design={design}
            quoteLines={quoteLines}
            quoteAvatarSrc={quoteAvatarSrc}
            quoteMediaSrc={proxiedQuoteMediaSrc}
            quoteMediaH={quoteMediaH}
          />
          {!rendered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-[22px] bg-background/70 backdrop-blur-[1px]">
              <Spinner className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Preparing image...</p>
            </div>
          )}
        </div>
        {/* ── Designer: how the card looks is the user's call ── */}
        <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Design your card
            </p>
            <button
              type="button"
              onClick={() => updateDesign({ ...DEFAULT_DESIGN })}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {([
              { id: "dark" as const, label: "Black", Icon: Moon },
              { id: "light" as const, label: "White", Icon: Sun },
            ]).map(({ id, label, Icon }) => {
              const active = design.theme === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateDesign({ theme: id })}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground">Accent</span>
            {ACCENT_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Accent ${c}`}
                onClick={() => updateDesign({ accent: c })}
                className={cn(
                  "h-6 w-6 rounded-full transition-transform hover:scale-110",
                  design.accent === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
                style={{ background: c }}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: "showStats" as const, label: "Engagement counts" },
              { id: "showBrand" as const, label: "Loop logo" },
            ].map((t) => {
              const on = design[t.id]
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => updateDesign({ [t.id]: !on } as Partial<ShareDesign>)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    on
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      on ? "bg-primary" : "bg-muted-foreground/50",
                    )}
                  />
                  {t.label}
                </button>
              )
            })}
          </div>
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
