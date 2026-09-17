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
 * A fixed 1080×1350 portrait card — exactly 4:5, the shape X, Instagram and
 * LinkedIn all crop kindly — so the HTML preview and the exported JPEG are
 * pixel-for-pixel the same layout at any size.
 */
const CARD_W = 1080
const CARD_H = 1350
const SCALE = 2
const PAD = 72
const RADIUS = 36
const AVATAR = 76
const HEADER_TOP = 96
const BODY_FONT = 40
const BODY_LINE = 1.5
const NAME_FONT = 34
const META_FONT = 22
const MAX_LINES = 13
const L_MARK = 44
/** Distance from the card's bottom edge to each footer landmark. */
const HAIRLINE_FROM_BOTTOM = 176
const ENGAGEMENT_FROM_BOTTOM = 132
const BRAND_FROM_BOTTOM = 72
/** Gap that keeps the last line of text clear of the footer hairline. */
const BODY_BOTTOM_GAP = 48
const DOMAIN = "loopapp.me"

/* Footer landmarks, expressed relative to the footer block's own top edge so
 * the canvas and the HTML preview agree to the pixel. */
const FOOTER_H = HAIRLINE_FROM_BOTTOM + BODY_BOTTOM_GAP
const FOOTER_HAIRLINE_TOP = BODY_BOTTOM_GAP
const FOOTER_ENGAGEMENT_TOP = FOOTER_H - ENGAGEMENT_FROM_BOTTOM - 13
const FOOTER_BRAND_TOP = FOOTER_H - BRAND_FROM_BOTTOM - 17

/* ── Palette: always the Loop dark theme ── */
const C = {
  bg: "#0A0C18",
  bgLift: "#111530",
  text: "rgba(255,255,255,0.95)",
  textStrong: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.38)",
  hairline: "rgba(255,255,255,0.10)",
  violet: "#8B5CF6",
  cyan: "#22D3EE",
  amber: "#F59E0B",
  amberLight: "#FBBF24",
  proText: "#241505",
}

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
  return ["#22D3EE", "#818CF8"]
}

/* ── Avatar loading ── */
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
    const t = window.setTimeout(() => ok(null), 1500)
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
  const a = colors[0] || "#22D3EE"
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
  const w = 68
  ctx.save()
  const g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, C.amberLight)
  g.addColorStop(1, C.amber)
  rr(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.fillStyle = C.proText
  ctx.font = font(800, 15)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("PRO", x + w / 2, y + h / 2 + 1)
  ctx.restore()
  return w
}
/** Small Loop mark: rounded gradient square with the wordmark's L. */
function drawLoopMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  const g = ctx.createLinearGradient(x, y, x + size, y + size)
  g.addColorStop(0, "#7C3AED")
  g.addColorStop(1, "#22D3EE")
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

/* ── Engagement glyphs, stroked to match the muted footer ── */
function strokeGlyph(ctx: CanvasRenderingContext2D, size: number) {
  ctx.strokeStyle = C.textMuted
  ctx.lineWidth = Math.max(1.7, size * 0.082)
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
  // small speech tail
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
  // upper leg: left → right, arrowhead at the right
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.42, cy - s * 0.22)
  ctx.lineTo(cx + s * 0.3, cy - s * 0.22)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx + s * 0.1, cy - s * 0.44)
  ctx.lineTo(cx + s * 0.32, cy - s * 0.22)
  ctx.lineTo(cx + s * 0.1, cy)
  ctx.stroke()
  // lower leg: right → left, arrowhead at the left
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
  // tray
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.42, cy + s * 0.04)
  ctx.lineTo(cx - s * 0.42, cy + s * 0.44)
  ctx.lineTo(cx + s * 0.42, cy + s * 0.44)
  ctx.lineTo(cx + s * 0.42, cy + s * 0.04)
  ctx.stroke()
  // arrow up
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
  return lines
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
    verifiedColors: ["#22D3EE", "#818CF8"],
    customColorList: badge ? normalizeColors(badge) : null,
  }
}

function drawCard(
  canvas: HTMLCanvasElement,
  post: ShareAsImageModalProps["post"],
  scale: number,
  av: AV | null,
  resolvedBadge?: ShareCardBadge | null,
) {
  const m = model(post, resolvedBadge)
  const ctx = setup(canvas, CARD_W, CARD_H, scale)
  if (!ctx) return

  // ── Background: deep navy-black with soft violet + cyan ambience ──
  // Flat base first so the rounded-corner cut-outs are the card color, not
  // transparent black (JPEG has no alpha).
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  rr(ctx, 0, 0, CARD_W, CARD_H, RADIUS)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Soft violet glow, top-left — realistic light falloff over the navy.
  const violetGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, CARD_W * 0.95)
  violetGlow.addColorStop(0, "rgba(124,58,237,0.34)")
  violetGlow.addColorStop(0.45, "rgba(124,58,237,0.10)")
  violetGlow.addColorStop(1, "rgba(124,58,237,0)")
  ctx.fillStyle = violetGlow
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Soft cyan glow, bottom-right.
  const cyanGlow = ctx.createRadialGradient(CARD_W, CARD_H, 0, CARD_W, CARD_H, CARD_W * 0.9)
  cyanGlow.addColorStop(0, "rgba(34,211,238,0.20)")
  cyanGlow.addColorStop(0.5, "rgba(34,211,238,0.06)")
  cyanGlow.addColorStop(1, "rgba(34,211,238,0)")
  ctx.fillStyle = cyanGlow
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  ctx.restore()

  // Hairline rim only — no heavy border.
  rr(ctx, 0.5, 0.5, CARD_W - 1, CARD_H - 1, RADIUS)
  ctx.strokeStyle = "rgba(255,255,255,0.07)"
  ctx.lineWidth = 1
  ctx.stroke()

  /* ── Top section: avatar, name, badges, app mark ── */
  const avR = AVATAR / 2
  // +4 so the gradient ring — which sits 4px outside the avatar — still starts
  // exactly on the text margin instead of bleeding past it.
  const avCx = PAD + 4 + avR
  const avCy = HEADER_TOP + avR

  // violet → cyan gradient ring
  ctx.save()
  const ring = ctx.createLinearGradient(avCx - avR, avCy - avR, avCx + avR, avCy + avR)
  ring.addColorStop(0, C.violet)
  ring.addColorStop(1, C.cyan)
  circle(ctx, avCx, avCy, avR + 4)
  ctx.fillStyle = ring
  ctx.fill()
  ctx.restore()

  ctx.save()
  circle(ctx, avCx, avCy, avR)
  ctx.clip()
  ctx.fillStyle = C.bgLift
  ctx.fillRect(avCx - avR, avCy - avR, AVATAR, AVATAR)
  if (av) {
    const { w, h } = avDim(av)
    const sz = Math.min(w, h)
    ctx.drawImage(av, (w - sz) / 2, (h - sz) / 2, sz, sz, avCx - avR, avCy - avR, AVATAR, AVATAR)
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.font = font(800, 32)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText((m.name || "U").charAt(0).toUpperCase(), avCx, avCy + 1)
  }
  ctx.restore()

  // Loop app mark, far top-right
  drawLoopMark(ctx, CARD_W - PAD - L_MARK, HEADER_TOP + (AVATAR - L_MARK) / 2, L_MARK)

  // Badges stack to the right of the name
  const badgeSize = 28
  const proH = 28
  let badgeW = 0
  if (m.showVerified) badgeW += badgeSize + 8
  if (m.showPro) badgeW += 68 + 8
  if (m.customColorList) badgeW += badgeSize + 8

  const nameX = avCx + avR + 24
  const nameMaxW = CARD_W - PAD - L_MARK - 24 - nameX - badgeW
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
  const nameBaseline = avCy - 8
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
  ctx.fillText(metaBits.join("  ·  "), nameX, avCy + 24)
  ctx.restore()

  let bx = nameX + nameW + 12
  const by = nameBaseline - NAME_FONT * 0.78
  if (m.showVerified) {
    drawSeal(ctx, bx, by, badgeSize, m.verifiedColors)
    bx += badgeSize + 8
  }
  if (m.showPro) {
    drawPro(ctx, bx, by, proH)
    bx += 68 + 8
  }
  if (m.customColorList) {
    drawSeal(ctx, bx, by, badgeSize, m.customColorList)
    bx += badgeSize + 8
  }

  /* ── Main body: 40px / 1.5, centred in the space above the footer ── */
  const hairlineY = CARD_H - HAIRLINE_FROM_BOTTOM
  const bodyTop = HEADER_TOP + AVATAR + 64
  const bodyFloor = hairlineY - BODY_BOTTOM_GAP
  ctx.save()
  ctx.font = font(500, BODY_FONT)
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  const lines = wrapLines(ctx, m.body, CARD_W - PAD * 2, MAX_LINES)
  const textH = lines.length * BODY_FONT * BODY_LINE
  // Short posts sit optically centred instead of clinging to the header.
  const extra = Math.max(0, bodyFloor - bodyTop - textH)
  let ty = bodyTop + extra / 2
  for (const l of lines) {
    ctx.fillText(l, PAD, ty)
    ty += BODY_FONT * BODY_LINE
  }
  ctx.restore()

  /* ── Bottom section: hairline, engagement row, brand watermark ── */
  ctx.save()
  ctx.strokeStyle = C.hairline
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, hairlineY)
  ctx.lineTo(CARD_W - PAD, hairlineY)
  ctx.stroke()
  ctx.restore()

  const engCy = CARD_H - ENGAGEMENT_FROM_BOTTOM
  const icon = 26
  const gapAfterIcon = 12
  const gapBetween = 46
  ctx.save()
  ctx.font = font(600, 24)
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillStyle = C.textMuted
  // +2 keeps the heart's widest bezier control point on the text margin.
  let ex = PAD + 2 + icon / 2
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
    item.draw(ctx, ex, engCy, icon)
    ex += icon / 2 + gapAfterIcon
    if (item.label) {
      ctx.fillText(item.label, ex, engCy + 1)
      ex += ctx.measureText(item.label).width + gapBetween
    } else {
      ex += gapBetween
    }
  }
  ctx.restore()

  // Brand row: gradient mark + wordmark on the left, quiet watermark right.
  const brandCy = CARD_H - BRAND_FROM_BOTTOM
  const markSize = 34
  drawLoopMark(ctx, PAD, brandCy - markSize / 2, markSize)
  ctx.save()
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "rgba(255,255,255,0.82)"
  ctx.font = font(700, 22)
  ctx.fillText("Loop", PAD + markSize + 12, brandCy)
  ctx.font = font(400, 20)
  ctx.fillStyle = C.textFaint
  ctx.fillText(`· ${DOMAIN}`, PAD + markSize + 12 + 52, brandCy)

  const dotR = 5
  const dotX = CARD_W - PAD - 100
  circle(ctx, dotX, brandCy, dotR)
  const dotGrad = ctx.createLinearGradient(dotX - dotR, brandCy - dotR, dotX + dotR, brandCy + dotR)
  dotGrad.addColorStop(0, C.violet)
  dotGrad.addColorStop(1, C.cyan)
  ctx.fillStyle = dotGrad
  ctx.fill()
  ctx.font = font(600, 20)
  ctx.fillStyle = C.textFaint
  ctx.fillText("Build together", CARD_W - PAD - 84, brandCy)
  ctx.restore()
}

function toBlob(c: HTMLCanvasElement, q = 0.94): Promise<Blob> {
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/jpeg", q))
}

/* ── HTML mirror ─────────────────────────────────────────────────────────
 * The same 1080×1350 layout, rendered at its real pixel sizes and scaled down
 * to whatever width the dialog gives it — so the preview is a true miniature
 * of the exported JPEG rather than an approximation.
 */
function CardPreview({ post, resolvedBadge }: { post: ShareAsImageModalProps["post"]; resolvedBadge?: ShareCardBadge | null }) {
  const m = model(post, resolvedBadge)
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

  const avatarSrc = post.author.avatar_url
    ? `/api/image-proxy?url=${encodeURIComponent(post.author.avatar_url)}`
    : getDiceBearUrl(post.author.username)

  const meta = [m.handle, m.date].filter(Boolean).join("  ·  ")

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-[28px] shadow-2xl shadow-black/40"
      style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
    >
      <div
        className="absolute left-0 top-0"
        style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        <div className="relative h-full w-full" style={{ background: C.bg }}>
          {/* ambient glows */}
          <div
            className="absolute rounded-full"
            style={{
              left: -CARD_W * 0.5,
              top: -CARD_W * 0.5,
              width: CARD_W * 1.9,
              height: CARD_W * 1.9,
              background: "radial-gradient(circle, rgba(124,58,237,0.34), rgba(124,58,237,0.10) 45%, rgba(124,58,237,0) 70%)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              right: -CARD_W * 0.45,
              bottom: -CARD_W * 0.45,
              width: CARD_W * 1.8,
              height: CARD_W * 1.8,
              background: "radial-gradient(circle, rgba(34,211,238,0.20), rgba(34,211,238,0.06) 50%, rgba(34,211,238,0) 72%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ borderRadius: RADIUS, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)" }}
          />

          <div className="relative flex h-full flex-col" style={{ paddingLeft: PAD, paddingRight: PAD }}>
            <div style={{ height: HEADER_TOP }} />

            {/* ── Top section: avatar + name + badges, app mark at the far right ── */}
            <div className="relative" style={{ height: AVATAR }}>
              <div className="flex items-center" style={{ gap: 20 }}>
                <span
                  className="flex shrink-0 items-center justify-center rounded-full"
                  style={{
                    width: AVATAR + 8,
                    height: AVATAR + 8,
                    padding: 4,
                    background: "linear-gradient(135deg, #8B5CF6, #22D3EE)",
                  }}
                >
                  <span
                    className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
                    style={{ background: C.bgLift }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                  </span>
                </span>

                <div className="min-w-0">
                  <div className="flex items-center" style={{ gap: 10 }}>
                    <span
                      style={{
                        fontSize: NAME_FONT,
                        fontWeight: 700,
                        lineHeight: 1.1,
                        color: C.textStrong,
                        // Mirrors the canvas: the name truncates rather than
                        // pushing the badges under the app mark.
                        maxWidth: 580,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.name}
                    </span>
                    {m.showVerified && (
                      <span
                        className="flex shrink-0 items-center justify-center rounded-full"
                        style={{
                          width: 28,
                          height: 28,
                          background: `linear-gradient(135deg, ${m.verifiedColors[0]}, ${m.verifiedColors[1]})`,
                        }}
                      >
                        <BadgeCheck style={{ width: 18, height: 18, color: "#FFFFFF" }} />
                      </span>
                    )}
                    {m.showPro && (
                      <span
                        className="flex shrink-0 items-center justify-center"
                        style={{
                          height: 28,
                          width: 68,
                          borderRadius: 999,
                          background: `linear-gradient(135deg, ${C.amberLight}, ${C.amber})`,
                          color: C.proText,
                          fontSize: 15,
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
                          width: 28,
                          height: 28,
                          background: `linear-gradient(135deg, ${m.customColorList[0]}, ${m.customColorList[1] || m.customColorList[0]})`,
                        }}
                      >
                        <BadgeCheck style={{ width: 18, height: 18, color: "#FFFFFF" }} />
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 6, fontSize: META_FONT, color: C.textMuted }}>{meta}</div>
                </div>
              </div>

              {/* Loop app mark, far top-right */}
              <span
                className="absolute flex items-center justify-center"
                style={{
                  top: (AVATAR - L_MARK) / 2,
                  right: 0,
                  width: L_MARK,
                  height: L_MARK,
                  borderRadius: L_MARK * 0.3,
                  background: "linear-gradient(135deg, #7C3AED, #22D3EE)",
                  color: "#FFFFFF",
                  fontSize: L_MARK * 0.6,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                L
              </span>
            </div>

            <div style={{ height: 64 }} />

            {/* ── Main body: flex-1 centres it exactly like the canvas ── */}
            <div className="flex min-h-0 flex-1 items-center">
              <p
                style={{
                  margin: 0,
                  width: "100%",
                  fontSize: BODY_FONT,
                  fontWeight: 500,
                  lineHeight: BODY_LINE,
                  color: C.text,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.body}
              </p>
            </div>

            {/* ── Bottom section ── */}
            <div className="relative shrink-0" style={{ height: FOOTER_H }}>
              <div
                style={{ position: "absolute", top: FOOTER_HAIRLINE_TOP, left: 0, right: 0, height: 1, background: C.hairline }}
              />

              <div className="absolute flex items-center" style={{ top: FOOTER_ENGAGEMENT_TOP, left: 0, gap: 46 }}>
                <EngagementItem icon={<HeartGlyph />} label={fmt(m.likes)} />
                <EngagementItem icon={<ReplyGlyph />} label={fmt(m.replies)} />
                <EngagementItem icon={<RepostGlyph />} label={fmt(m.reposts)} />
                <span className="flex items-center" style={{ color: C.textMuted }}>
                  <ShareGlyph />
                </span>
              </div>

              <div
                className="absolute flex items-center"
                style={{
                  top: FOOTER_BRAND_TOP,
                  left: 0,
                  right: 0,
                  justifyContent: "space-between",
                }}
              >
                <span className="flex items-center" style={{ gap: 12 }}>
                  <span
                    className="flex items-center justify-center"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #7C3AED, #22D3EE)",
                      color: "#FFFFFF",
                      fontSize: 20,
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    L
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>Loop</span>
                  <span style={{ fontSize: 20, color: C.textFaint }}>· {DOMAIN}</span>
                </span>
                <span className="flex items-center" style={{ gap: 12 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "linear-gradient(135deg, #8B5CF6, #22D3EE)",
                    }}
                  />
                  <span style={{ fontSize: 20, fontWeight: 600, color: C.textFaint }}>Build together</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Muted engagement item: stroked glyph + number, matching the canvas footer. */
function EngagementItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="flex items-center" style={{ gap: 12, color: C.textMuted }}>
      {icon}
      <span style={{ fontSize: 24, fontWeight: 600 }}>{label}</span>
    </span>
  )
}

const glyphProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 26 26",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.1,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}
function HeartGlyph() {
  return (
    <svg {...glyphProps}>
      <path d="M13 21.5c-4.8-4.2-8.5-7.6-8.5-11.2A4.9 4.9 0 0 1 13 7.2a4.9 4.9 0 0 1 8.5 3.1c0 3.6-3.7 7-8.5 11.2Z" />
    </svg>
  )
}
function ReplyGlyph() {
  return (
    <svg {...glyphProps}>
      <rect x="3" y="3.6" width="20" height="15.4" rx="5" />
      <path d="M9.2 19v4l4.4-4" />
    </svg>
  )
}
function RepostGlyph() {
  return (
    <svg {...glyphProps}>
      <path d="M5.4 9.6h14.2" />
      <path d="M16.4 6.4l3.4 3.2-3.4 3.2" />
      <path d="M20.6 16.4H6.4" />
      <path d="M9.6 13.2 6.2 16.4l3.4 3.2" />
    </svg>
  )
}
function ShareGlyph() {
  return (
    <svg {...glyphProps}>
      <path d="M6.6 11.4v11h12.8v-11" />
      <path d="M13 16.6V3.2" />
      <path d="M9.6 6.6 13 3.2l3.4 3.4" />
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)
  const [exporting, setExporting] = useState(false)
  const avRef = useRef<AV | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const genRef = useRef(0)

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
    ],
  )

  useEffect(() => {
    if (!open) {
      setRendered(false)
      setExporting(false)
      blobRef.current = null
      avRef.current = null
      return
    }
    const g = ++genRef.current
    let c = false
    setRendered(false)
    const run = async () => {
      const cv = canvasRef.current
      if (!cv) return
      try {
        const avUrl = post.author.avatar_url
          ? `/api/image-proxy?url=${encodeURIComponent(post.author.avatar_url)}`
          : null
        const av = avUrl ? await loadAv(avUrl) : null
        if (c || genRef.current !== g) return
        avRef.current = av
        drawCard(cv, post, SCALE, av, resolvedBadge)
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
  }, [open, key, resolvedBadge])

  const getBlob = async (): Promise<Blob> => {
    if (blobRef.current) return blobRef.current
    const cv = canvasRef.current
    if (!cv) throw new Error("Canvas not ready")
    drawCard(cv, post, SCALE, avRef.current, resolvedBadge)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto border-border bg-card text-card-foreground shadow-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Share2 className="h-4 w-4 text-violet-500" /> Share as image
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            A 1080×1350 card for X, Instagram, or anywhere.
          </DialogDescription>
        </DialogHeader>
        <canvas ref={canvasRef} className="hidden" />
        <div className="relative">
          <CardPreview post={post} resolvedBadge={resolvedBadge} />
          {!rendered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-[28px] bg-background/70 backdrop-blur-[1px]">
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
