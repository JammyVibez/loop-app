"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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

/* ── Canvas geometry ──────────────────────────────────────────────────────
 * Portrait 4:5 at the base (1080 wide), which is the friendliest ratio for
 * X / Instagram / LinkedIn feeds, and grows a little for long posts (capped
 * at 1350) so text never gets cramped or clipped.
 */
const CARD_W = 1080
const CARD_H_MIN = 1080
const CARD_H_MAX = 1350
const SCALE = 2
const PAD = 72
const RADIUS = 36
const AVATAR = 76
const HEADER_TOP = 96
const BODY_FONT = 40
const META_FONT = 22
const NAME_FONT = 34
const LINE_HEIGHT = 1.5
const MAX_LINES = 13
const FOOTER_BLOCK = 208
const DOMAIN = "loopapp.me"

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
  violetLight: "#C4B5FD",
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
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
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
  if (typeof HTMLImageElement !== "undefined" && s instanceof HTMLImageElement) return { w: s.naturalWidth || s.width, h: s.naturalHeight || s.height }
  return { w: (s as any).width, h: (s as any).height }
}
function loadAv(src: string): Promise<AV | null> {
  return new Promise((r) => {
    let done = false
    const ok = (v: AV | null) => { if (done) return; done = true; clearTimeout(t); r(v) }
    const t = window.setTimeout(() => ok(null), 1500)
    if (typeof createImageBitmap === "function") {
      fetch(src, { mode: "cors", credentials: "include" }).then(x => { if (!x.ok) throw 0; return x.blob() }).then(b => createImageBitmap(b)).then(b => ok(b)).catch(() => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src })
      return
    }
    const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src
  })
}

/* ── Canvas primitives ── */
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
function font(weight: number, size: number) {
  return `${weight} ${size}px ${SANS}`
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
function setup(c: HTMLCanvasElement, w: number, h: number, s: number) {
  const ctx = c.getContext("2d"); if (!ctx) return null
  c.width = Math.round(w * s); c.height = Math.round(h * s)
  ctx.setTransform(s, 0, 0, s, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  return ctx
}
function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
}
/** White check mark inside a small badge. */
function drawCheck(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color = "#FFFFFF") {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(2, size * 0.14)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.beginPath()
  ctx.moveTo(cx - size * 0.30, cy + size * 0.02)
  ctx.lineTo(cx - size * 0.08, cy + size * 0.24)
  ctx.lineTo(cx + size * 0.32, cy - size * 0.22)
  ctx.stroke()
  ctx.restore()
}
/** Branded verified seal — cyan → violet gradient disc with a check. */
function drawVerified(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  const g = ctx.createLinearGradient(x, y, x + size, y + size)
  g.addColorStop(0, "#22D3EE"); g.addColorStop(1, "#818CF8")
  circle(ctx, x + size / 2, y + size / 2, size / 2); ctx.fillStyle = g; ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.2
  circle(ctx, x + size / 2, y + size / 2, size / 2 - 0.6); ctx.stroke()
  drawCheck(ctx, x + size / 2, y + size / 2, size)
  ctx.restore()
}
/** Custom admin badge — same seal, painted with the badge's own colors. */
function drawCustomBadge(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colors: string[]) {
  ctx.save()
  const a = colors[0] || "#22D3EE"
  const b = colors[1] || colors[0] || "#818CF8"
  const g = ctx.createLinearGradient(x, y, x + size, y + size)
  g.addColorStop(0, a); g.addColorStop(1, b)
  circle(ctx, x + size / 2, y + size / 2, size / 2); ctx.fillStyle = g; ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.2
  circle(ctx, x + size / 2, y + size / 2, size / 2 - 0.6); ctx.stroke()
  drawCheck(ctx, x + size / 2, y + size / 2, size)
  ctx.restore()
}
/** PRO pill — amber gradient, dark label. Width is returned so callers stack. */
function drawPro(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  const w = 68
  ctx.save()
  const g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, C.amberLight); g.addColorStop(1, C.amber)
  rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = g; ctx.fill()
  ctx.fillStyle = C.proText
  ctx.font = font(800, 15)
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText("PRO", x + w / 2, y + h / 2 + 1)
  ctx.restore()
  return w
}
/** Small Loop mark: rounded gradient square with the wordmark's L. */
function drawLoopMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  const g = ctx.createLinearGradient(x, y, x + size, y + size)
  g.addColorStop(0, "#7C3AED"); g.addColorStop(1, "#22D3EE")
  rr(ctx, x, y, size, size, size * 0.3); ctx.fillStyle = g; ctx.fill()
  ctx.fillStyle = "#FFFFFF"
  ctx.font = font(800, size * 0.6)
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText("L", x + size / 2, y + size / 2 + size * 0.04)
  ctx.restore()
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const lines: string[] = []
  for (const para of text.split("\n")) {
    const words = para.split(" ").filter(Boolean)
    let ln = ""
    for (const w of words) {
      const t = ln ? `${ln} ${w}` : w
      if (ctx.measureText(t).width > maxW && ln) { lines.push(ln); ln = w } else ln = t
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
  body: string
  showVerified: boolean
  showPro: boolean
  customColorList: string[] | null
}

function model(post: ShareAsImageModalProps["post"], resolvedBadge?: ShareCardBadge | null): CardModel {
  const badge = post.author.badge || resolvedBadge || null
  const custom = badge ? normalizeColors(badge) : null
  return {
    name: truncate(post.author.display_name || post.author.username || "User", 40),
    handle: `@${truncate(post.author.username || "user", 30)}`,
    date: cardDate(post.created_at),
    likes: Number(post.stats?.likes_count || 0),
    body: truncate(post.content || "Shared a loop on Loop.", 600),
    showVerified: Boolean(post.author.is_verified),
    showPro: Boolean(post.author.is_premium),
    customColorList: custom,
  }
}

function measureCardHeight(ctx: CanvasRenderingContext2D, m: CardModel): number {
  ctx.font = font(500, BODY_FONT)
  const lines = wrapLines(ctx, m.body, CARD_W - PAD * 2, MAX_LINES)
  const textH = lines.length * BODY_FONT * LINE_HEIGHT
  const contentTop = HEADER_TOP + AVATAR + 64
  const total = contentTop + textH + FOOTER_BLOCK
  return Math.max(CARD_H_MIN, Math.min(CARD_H_MAX, Math.round(total)))
}

function drawCard(canvas: HTMLCanvasElement, post: ShareAsImageModalProps["post"], scale: number, av: AV | null, resolvedBadge?: ShareCardBadge | null) {
  const m = model(post, resolvedBadge)
  const tmp = canvas.getContext("2d")
  if (!tmp) return
  tmp.font = font(500, BODY_FONT)
  const cardH = measureCardHeight(tmp, m)

  const ctx = setup(canvas, CARD_W, cardH, scale)
  if (!ctx) return

  // ── Background: deep navy-black with soft violet + cyan ambience ──
  // Flat base first so the rounded-corner cut-outs are the card color, not
  // transparent black (JPEG has no alpha).
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_W, cardH)
  rr(ctx, 0, 0, CARD_W, cardH, RADIUS)
  ctx.save(); ctx.clip()
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_W, cardH)

  const violetGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, CARD_W * 0.95)
  violetGlow.addColorStop(0, "rgba(124,58,237,0.34)")
  violetGlow.addColorStop(0.45, "rgba(124,58,237,0.10)")
  violetGlow.addColorStop(1, "rgba(124,58,237,0)")
  ctx.fillStyle = violetGlow
  ctx.fillRect(0, 0, CARD_W, cardH)

  const cyanGlow = ctx.createRadialGradient(CARD_W, cardH, 0, CARD_W, cardH, CARD_W * 0.9)
  cyanGlow.addColorStop(0, "rgba(34,211,238,0.20)")
  cyanGlow.addColorStop(0.5, "rgba(34,211,238,0.06)")
  cyanGlow.addColorStop(1, "rgba(34,211,238,0)")
  ctx.fillStyle = cyanGlow
  ctx.fillRect(0, 0, CARD_W, cardH)
  ctx.restore()

  // Hairline inner edge (no heavy border, just a lit rim)
  rr(ctx, 0.5, 0.5, CARD_W - 1, cardH - 1, RADIUS)
  ctx.strokeStyle = "rgba(255,255,255,0.07)"
  ctx.lineWidth = 1
  ctx.stroke()

  // ── Author row ──
  const avR = AVATAR / 2
  const avCx = PAD + avR
  const avCy = HEADER_TOP + avR

  // gradient ring
  ctx.save()
  const ring = ctx.createLinearGradient(avCx - avR, avCy - avR, avCx + avR, avCy + avR)
  ring.addColorStop(0, C.violet); ring.addColorStop(1, C.cyan)
  circle(ctx, avCx, avCy, avR + 4); ctx.fillStyle = ring; ctx.fill()
  ctx.restore()

  ctx.save()
  circle(ctx, avCx, avCy, avR); ctx.clip()
  ctx.fillStyle = C.bgLift; ctx.fillRect(avCx - avR, avCy - avR, AVATAR, AVATAR)
  if (av) {
    const { w, h } = avDim(av)
    const sz = Math.min(w, h)
    ctx.drawImage(av, (w - sz) / 2, (h - sz) / 2, sz, sz, avCx - avR, avCy - avR, AVATAR, AVATAR)
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.font = font(800, 32)
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText((m.name || "U").charAt(0).toUpperCase(), avCx, avCy + 1)
  }
  ctx.restore()

  // badges stacked to the right of the name
  const badgeSize = 28
  const proH = 28
  let badgeW = 0
  if (m.showVerified) badgeW += badgeSize + 8
  if (m.showPro) badgeW += 68 + 8
  if (m.customColorList) badgeW += badgeSize + 8

  const nameX = avCx + avR + 24
  const nameMaxW = CARD_W - PAD - nameX - badgeW
  ctx.save()
  ctx.font = font(700, NAME_FONT)
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"
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

  // meta line: @handle · date · likes
  const metaBits = [m.handle]
  if (m.date) metaBits.push(m.date)
  if (m.likes > 0) metaBits.push(`${fmt(m.likes)} ${m.likes === 1 ? "like" : "likes"}`)
  ctx.save()
  ctx.font = font(400, META_FONT)
  ctx.fillStyle = C.textMuted
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"
  ctx.fillText(metaBits.join("  ·  "), nameX, avCy + 24)
  ctx.restore()

  // badges, right after the name
  let bx = nameX + nameW + 12
  const by = nameBaseline - NAME_FONT * 0.78
  if (m.showVerified) {
    drawVerified(ctx, bx, by, badgeSize)
    bx += badgeSize + 8
  }
  if (m.showPro) {
    drawPro(ctx, bx, by, proH)
    bx += 68 + 8
  }
  if (m.customColorList) {
    drawCustomBadge(ctx, bx, by, badgeSize, m.customColorList)
    bx += badgeSize + 8
  }

  // ── Post body ──
  const bodyTop = HEADER_TOP + AVATAR + 64
  ctx.save()
  ctx.font = font(500, BODY_FONT)
  ctx.fillStyle = C.text
  ctx.textAlign = "left"; ctx.textBaseline = "top"
  const lines = wrapLines(ctx, m.body, CARD_W - PAD * 2, MAX_LINES)
  let ty = bodyTop
  for (const l of lines) {
    ctx.fillText(l, PAD, ty)
    ty += BODY_FONT * LINE_HEIGHT
  }
  ctx.restore()

  // ── Footer: hairline + subtle brand watermark ──
  const footerY = cardH - 92
  ctx.save()
  ctx.strokeStyle = C.hairline
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, footerY); ctx.lineTo(CARD_W - PAD, footerY); ctx.stroke()
  ctx.restore()

  const markY = footerY + 30
  drawLoopMark(ctx, PAD, markY, 34)
  ctx.save()
  ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.fillStyle = "rgba(255,255,255,0.82)"
  ctx.font = font(700, 22)
  ctx.fillText("Loop", PAD + 34 + 12, markY + 17)
  ctx.font = font(400, 20)
  ctx.fillStyle = C.textFaint
  ctx.fillText(DOMAIN, PAD + 34 + 12 + 52, markY + 17)
  ctx.restore()

  // Right side: quiet accent dot + handle watermark
  ctx.save()
  const dotR = 5
  const dotX = CARD_W - PAD - 96
  circle(ctx, dotX, markY + 17, dotR)
  const dotGrad = ctx.createLinearGradient(dotX - dotR, markY + 17 - dotR, dotX + dotR, markY + 17 + dotR)
  dotGrad.addColorStop(0, C.violet); dotGrad.addColorStop(1, C.cyan)
  ctx.fillStyle = dotGrad; ctx.fill()
  ctx.font = font(600, 20)
  ctx.fillStyle = C.textFaint
  ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.fillText("Build together", CARD_W - PAD - 82, markY + 17)
  ctx.restore()
}

function toBlob(c: HTMLCanvasElement, q = 0.94): Promise<Blob> {
  return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error("empty")), "image/jpeg", q))
}

/* ── JSX preview mirroring the canvas layout ── */
function CardPreview({ post, resolvedBadge }: { post: ShareAsImageModalProps["post"]; resolvedBadge?: ShareCardBadge | null }) {
  const m = model(post, resolvedBadge)
  const avatarSrc = post.author.avatar_url
    ? `/api/image-proxy?url=${encodeURIComponent(post.author.avatar_url)}`
    : getDiceBearUrl(post.author.username)

  const meta = [m.handle, m.date, m.likes > 0 ? `${fmt(m.likes)} ${m.likes === 1 ? "like" : "likes"}` : ""].filter(Boolean)

  return (
    <div className="relative w-full select-none overflow-hidden rounded-[28px] text-left">
      {/* background */}
      <div className="absolute inset-0 bg-[#0A0C18]" />
      <div className="absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.34), rgba(124,58,237,0) 65%)" }} />
      <div className="absolute -bottom-28 -right-24 h-[420px] w-[420px] rounded-full" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.22), rgba(34,211,238,0) 65%)" }} />
      <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/[0.07]" />

      <div className="relative z-10 px-[6.5%] pb-8 pt-9">
        {/* author */}
        <div className="flex items-center gap-3.5">
          <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full p-[2.5px]" style={{ background: "linear-gradient(135deg, #8B5CF6, #22D3EE)" }}>
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#111530]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            </span>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[17px] font-bold leading-tight text-white">{m.name}</p>
              {m.showVerified && (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: "linear-gradient(135deg, #22D3EE, #818CF8)" }}>
                  <BadgeCheck className="h-3 w-3 text-white" />
                </span>
              )}
              {m.showPro && (
                <span className="shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-extrabold tracking-wide" style={{ background: "linear-gradient(135deg, #FBBF24, #F59E0B)", color: "#241505" }}>
                  PRO
                </span>
              )}
              {m.customColorList && (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${m.customColorList[0]}, ${m.customColorList[1] || m.customColorList[0]})` }}>
                  <BadgeCheck className="h-3 w-3 text-white" />
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[12px] text-white/55">{meta.join("  ·  ")}</p>
          </div>
        </div>

        {/* body */}
        <p className="mt-6 whitespace-pre-line text-[19px] font-medium leading-[1.5] text-white/95">
          {m.body}
        </p>

        {/* footer */}
        <div className="mt-8 border-t border-white/10 pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-extrabold text-white" style={{ background: "linear-gradient(135deg, #7C3AED, #22D3EE)" }}>L</span>
              <span className="text-[13px] font-bold text-white/80">Loop</span>
              <span className="text-[12px] text-white/35">{DOMAIN}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "linear-gradient(135deg, #8B5CF6, #22D3EE)" }} />
              <span className="text-[12px] font-semibold text-white/35">Build together</span>
            </div>
          </div>
        </div>
      </div>
    </div>
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
    () => [
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
    ],
  )

  useEffect(() => {
    if (!open) { setRendered(false); setExporting(false); blobRef.current = null; avRef.current = null; return }
    const g = ++genRef.current; let c = false; setRendered(false)
    const run = async () => {
      const cv = canvasRef.current; if (!cv) return
      try {
        const avUrl = post.author.avatar_url ? `/api/image-proxy?url=${encodeURIComponent(post.author.avatar_url)}` : null
        const av = avUrl ? await loadAv(avUrl) : null
        if (c || genRef.current !== g) return
        avRef.current = av
        drawCard(cv, post, SCALE, av, resolvedBadge)
        if (c || genRef.current !== g) return
        blobRef.current = await toBlob(cv); setRendered(true)
      } catch { if (!c) setRendered(false) }
    }
    const t = window.setTimeout(() => void run(), 80)
    return () => { c = true; clearTimeout(t) }
  }, [open, key, resolvedBadge])

  const getBlob = async (): Promise<Blob> => {
    if (blobRef.current) return blobRef.current
    const cv = canvasRef.current; if (!cv) throw new Error("Canvas not ready")
    drawCard(cv, post, SCALE, avRef.current, resolvedBadge)
    const b = await toBlob(cv); blobRef.current = b; return b
  }

  const download = async () => {
    if (exporting) return; setExporting(true)
    try {
      const b = await getBlob(); const url = URL.createObjectURL(b)
      const a = document.createElement("a"); a.href = url; a.download = `loop-${post.id}.jpg`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast({ title: "Downloaded", description: "Share it anywhere." })
    } catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }) }
    finally { setExporting(false) }
  }

  const share = async () => {
    try {
      const b = await getBlob(); const f = new File([b], `loop-${post.id}.jpg`, { type: "image/jpeg" })
      if (navigator.share && navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: "Loop", text: post.content.slice(0, 120) }); toast({ title: "Shared!" }) }
      else await download()
    } catch (e: any) { if (e?.name !== "AbortError") toast({ title: "Couldn't share", description: e.message, variant: "destructive" }) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto border-border bg-card text-card-foreground shadow-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Share2 className="h-4 w-4 text-violet-500" /> Share as image
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">A branded card for sharing on X, Instagram, or anywhere.</DialogDescription>
        </DialogHeader>
        <canvas ref={canvasRef} className="hidden" />
        <div className="relative w-full overflow-hidden rounded-[28px] shadow-2xl shadow-black/40 max-h-[50dvh] sm:max-h-[55vh] overflow-y-auto">
          <CardPreview post={post} resolvedBadge={resolvedBadge} />
          {!rendered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/70 backdrop-blur-[1px]">
              <Spinner className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Preparing image...</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => void download()} disabled={exporting} className="border-border bg-background text-foreground hover:bg-muted">
            {exporting ? <Spinner className="mr-1.5 h-4 w-4" /> : <Download className="mr-1.5 h-4 w-4" />} Download
          </Button>
          <Button onClick={() => void share()} className="bg-gradient-to-br from-violet-500 to-purple-600 text-white hover:from-violet-400 hover:to-purple-500">
            <Share2 className="mr-1.5 h-4 w-4" /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
