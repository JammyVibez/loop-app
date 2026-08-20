"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, Share2, Heart, MessageCircle, GitBranch, Zap } from "lucide-react"
import { useTheme } from "next-themes"

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
      boosts_count?: number
    }
  }
}

const CARD_W = 1080
const CARD_H = 1350
const SCALE = 1.5
const DOMAIN = "loopapp.me"
const SITE_URL = `https://www.${DOMAIN}`
const TAGLINE = "Build together. Not just post into the void."

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

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((r) => {
    let done = false
    const ok = (v: HTMLImageElement | null) => { if (done) return; done = true; clearTimeout(t); r(v) }
    const t = window.setTimeout(() => ok(null), 2000)
    const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src
  })
}

/* ── Canvas helpers ── */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
function setup(c: HTMLCanvasElement, s: number) {
  const ctx = c.getContext("2d"); if (!ctx) return null
  c.width = Math.round(CARD_W * s); c.height = Math.round(CARD_H * s)
  ctx.setTransform(s, 0, 0, s, 0, 0); return ctx
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, startY: number, maxW: number, fontSize: number, color: string, maxLines = 12) {
  ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`
  const words = text.split(" "), lines: string[] = []
  let ln = ""
  for (const w of words) {
    const t = ln ? `${ln} ${w}` : w
    if (ctx.measureText(t).width > maxW && ln) { lines.push(ln); ln = w } else ln = t
    if (lines.length >= maxLines) break
  }
  if (ln && lines.length < maxLines) lines.push(ln)
  ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "top"
  let y = startY
  for (const l of lines) { ctx.fillText(l, x, y); y += fontSize * 1.4 }
  return y
}

/* Draw a heart icon on canvas */
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  const s = size
  ctx.moveTo(x + s / 2, y + s * 0.35)
  ctx.bezierCurveTo(x + s / 2, y + s * 0.2, x + s * 0.2, y, x + s * 0.15, y)
  ctx.bezierCurveTo(x - s * 0.1, y, x - s * 0.1, y + s * 0.4, x + s * 0.15, y + s * 0.55)
  ctx.bezierCurveTo(x + s * 0.35, y + s * 0.7, x + s / 2, y + s * 0.85, x + s / 2, y + s)
  ctx.bezierCurveTo(x + s / 2, y + s * 0.85, x + s * 0.65, y + s * 0.7, x + s * 0.85, y + s * 0.55)
  ctx.bezierCurveTo(x + s + s * 0.1, y + s * 0.4, x + s + s * 0.1, y, x + s * 0.85, y)
  ctx.bezierCurveTo(x + s * 0.8, y, x + s * 0.5, y + s * 0.2, x + s / 2, y + s * 0.35)
  ctx.fill()
  ctx.restore()
}

/* Draw comment icon (speech bubble) */
function drawComment(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = "round"
  const w = size, h = size * 0.8, r = 4
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x + w * 0.65, y + h, r)
  ctx.lineTo(x + w * 0.45, y + h)
  ctx.lineTo(x + w * 0.3, y + h + size * 0.3)
  ctx.lineTo(x + w * 0.35, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.fill()
  ctx.restore()
}

/* Draw branch/retweet icon */
function drawBranch(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"
  const s = size * 0.8
  const cx = x + size / 2, cy = y + size / 2
  // Two curved arrows forming a retweet-like shape
  ctx.beginPath()
  ctx.arc(cx, cy - 2, s * 0.32, Math.PI * 0.9, Math.PI * 0.1, true)
  ctx.stroke()
  // Arrow tip
  ctx.beginPath()
  ctx.moveTo(cx + s * 0.25, cy - s * 0.05)
  ctx.lineTo(cx + s * 0.35, cy - s * 0.18)
  ctx.lineTo(cx + s * 0.15, cy - s * 0.18)
  ctx.stroke()
  ctx.restore()
}

/* Draw rocket/boost icon */
function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  const cx = x + size / 2, cy = y + size / 2
  const s = size * 0.35
  // Rocket body (triangle-ish)
  ctx.beginPath()
  ctx.moveTo(cx, cy - s * 1.1)
  ctx.quadraticCurveTo(cx + s * 0.6, cy - s * 0.3, cx + s * 0.5, cy + s * 0.8)
  ctx.lineTo(cx - s * 0.5, cy + s * 0.8)
  ctx.quadraticCurveTo(cx - s * 0.6, cy - s * 0.3, cx, cy - s * 1.1)
  ctx.fill()
  // Window
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  ctx.beginPath()
  ctx.arc(cx, cy - s * 0.3, s * 0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/* Theme colors */
interface ThemeColors {
  cardBg: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  divider: string
  avatarFallback: string
  avatarText: string
}

const lightTheme: ThemeColors = {
  cardBg: "#f5f3f0",
  textPrimary: "#1c1917",
  textSecondary: "#57534e",
  textMuted: "#a8a29e",
  divider: "rgba(0,0,0,0.06)",
  avatarFallback: "#d6d3d1",
  avatarText: "#57534e",
}

const darkTheme: ThemeColors = {
  cardBg: "#18181b",
  textPrimary: "#fafafa",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  divider: "rgba(255,255,255,0.08)",
  avatarFallback: "#3f3f46",
  avatarText: "#d4d4d8",
}

function drawCard(canvas: HTMLCanvasElement, post: ShareAsImageModalProps["post"], scale: number, av: AV | null, isDark: boolean) {
  const ctx = setup(canvas, scale); if (!ctx) return
  const tc = isDark ? darkTheme : lightTheme
  const m = 56, iw = CARD_W - m * 2, cx = CARD_W / 2

  // ── Card background ──
  rr(ctx, 0, 0, CARD_W, CARD_H, 28)
  ctx.fillStyle = tc.cardBg; ctx.fill()

  // ── Gradient top edge: violet-to-cyan ──
  const gradTop = ctx.createLinearGradient(0, 0, CARD_W, 0)
  gradTop.addColorStop(0, "#8b5cf6"); gradTop.addColorStop(0.5, "#a78bfa"); gradTop.addColorStop(1, "#06b6d4")
  ctx.fillStyle = gradTop
  ctx.beginPath()
  ctx.moveTo(28, 0); ctx.lineTo(CARD_W - 28, 0)
  ctx.arcTo(CARD_W, 0, CARD_W, 28, 28)
  ctx.lineTo(CARD_W, 8); ctx.lineTo(0, 8)
  ctx.lineTo(0, 28)
  ctx.arcTo(0, 0, 28, 0, 28)
  ctx.closePath(); ctx.fill()

  let y = m + 24

  // ── App icon centered at top (draw actual logo image if loaded) ──
  const logoImg = (canvas as any)._loopLogo as HTMLImageElement | null
  const iconS = 48
  if (logoImg) {
    ctx.save()
    rr(ctx, cx - iconS / 2, y, iconS, iconS, 14)
    ctx.clip()
    ctx.drawImage(logoImg, cx - iconS / 2, y, iconS, iconS)
    ctx.restore()
  } else {
    ctx.save()
    const ig = ctx.createLinearGradient(cx - iconS / 2, y, cx + iconS / 2, y + iconS)
    ig.addColorStop(0, "#1e1b4b"); ig.addColorStop(1, "#312e81")
    rr(ctx, cx - iconS / 2, y, iconS, iconS, 14); ctx.fillStyle = ig; ctx.fill()
    ctx.fillStyle = "#fff"; ctx.font = "bold 24px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("L", cx, y + iconS / 2 + 1)
    ctx.restore()
  }
  y += iconS + 20

  // ── Thin divider ──
  ctx.strokeStyle = tc.divider; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(m + 20, y); ctx.lineTo(m + iw - 20, y); ctx.stroke()
  y += 20

  // ── AUTHOR BYLINE (compact, name on top, handle below) ──
  const avS = 40
  // Gradient ring
  ctx.save()
  const rg = ctx.createLinearGradient(m, y, m + avS, y + avS)
  rg.addColorStop(0, "#c084fc"); rg.addColorStop(0.5, "#818cf8"); rg.addColorStop(1, "#67e8f9")
  ctx.beginPath(); ctx.arc(m + avS / 2, y + avS / 2, avS / 2 + 3, 0, Math.PI * 2); ctx.fillStyle = rg; ctx.fill()
  ctx.restore()
  // Avatar clip
  ctx.save(); ctx.beginPath(); ctx.arc(m + avS / 2, y + avS / 2, avS / 2, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = tc.avatarFallback; ctx.fillRect(m, y, avS, avS)
  if (av) {
    const { w, h } = avDim(av); const sz = Math.min(w, h)
    ctx.drawImage(av, (w - sz) / 2, (h - sz) / 2, sz, sz, m, y, avS, avS)
  } else {
    ctx.font = "bold 18px system-ui, sans-serif"; ctx.fillStyle = tc.avatarText; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText((post.author.display_name || "U").charAt(0).toUpperCase(), m + avS / 2, y + avS / 2 + 1)
  }
  ctx.restore()

  // Name (top line) + handle (bottom line)
  const nx = m + avS + 12
  ctx.textAlign = "left"; ctx.textBaseline = "top"
  ctx.font = "bold 19px system-ui, sans-serif"; ctx.fillStyle = tc.textPrimary
  const nm = truncate(post.author.display_name || post.author.username || "User", 24)
  ctx.fillText(nm, nx, y + 4)
  ctx.font = "14px system-ui, sans-serif"; ctx.fillStyle = tc.textMuted
  ctx.fillText(`@${truncate(post.author.username || "user", 28)}`, nx, y + 26)

  y += avS + 16

  // ── POST CONTENT — THE FOCAL POINT, closer to byline ──
  const postContent = truncate(post.content || "Shared a loop", 500)
  const bodyFontSize = 28
  const availableH = CARD_H - y - 200

  // Measure text height
  ctx.font = `${bodyFontSize}px system-ui, -apple-system, sans-serif`
  const words = postContent.split(" "), testLines: string[] = []
  let tl = ""
  for (const w of words) {
    const t = tl ? `${tl} ${w}` : w
    if (ctx.measureText(t).width > iw - 20 && tl) { testLines.push(tl); tl = w } else tl = t
    if (testLines.length >= 10) break
  }
  if (tl) testLines.push(tl)
  const textH = testLines.length * bodyFontSize * 1.4
  const textStartY = y + Math.max(0, (availableH - textH) / 2)
  const textEnd = wrapText(ctx, postContent, m + 8, textStartY, iw - 16, bodyFontSize, tc.textPrimary, 10)
  y = Math.max(textEnd + 12, y + availableH)

  // ── STATS ROW with real icons ──
  const allStats: { count: number; color: string; bg: string; drawIcon: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string) => void }[] = []
  const likes = Number(post.stats?.likes_count || 0)
  const comments = Number(post.stats?.comments_count || 0)
  const branches = Number(post.stats?.branches_count || 0)
  const boosts = Number(post.stats?.boosts_count || 0)

  if (likes > 0) allStats.push({ count: likes, color: "#e11d48", bg: "rgba(244,63,94,0.12)", drawIcon: drawHeart })
  if (comments > 0) allStats.push({ count: comments, color: "#0891b2", bg: "rgba(6,182,212,0.12)", drawIcon: drawComment })
  if (branches > 0) allStats.push({ count: branches, color: "#059669", bg: "rgba(16,185,129,0.12)", drawIcon: drawBranch })
  if (boosts > 0) allStats.push({ count: boosts, color: "#d97706", bg: "rgba(245,158,11,0.12)", drawIcon: drawRocket })

  if (allStats.length > 0) {
    y = CARD_H - 195

    let sx = m + 8
    for (const s of allStats) {
      const iconSize = 14
      const label = fmt(s.count)
      ctx.font = "600 15px system-ui, sans-serif"
      const textW = ctx.measureText(label).width
      const pillW = iconSize + 8 + textW + 20
      const pillH = 32

      // Pill background
      rr(ctx, sx, y, pillW, pillH, pillH / 2)
      ctx.fillStyle = s.bg; ctx.fill()

      // Draw real icon
      s.drawIcon(ctx, sx + 9, y + 8, iconSize, s.color)

      // Count text
      ctx.font = "600 14px system-ui, sans-serif"; ctx.fillStyle = s.color; ctx.textAlign = "left"; ctx.textBaseline = "middle"
      ctx.fillText(label, sx + iconSize + 16, y + pillH / 2 + 1)

      sx += pillW + 8
    }
    y += 40
  } else {
    y = CARD_H - 168
  }

  // ── Divider above footer ──
  ctx.strokeStyle = tc.divider; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(m + 20, y); ctx.lineTo(m + iw - 20, y); ctx.stroke()
  y += 16

  // ── APP SIGNATURE at bottom ──
  // Real logo
  const footerIconS = 30
  if (logoImg) {
    ctx.save()
    rr(ctx, m + 8, y, footerIconS, footerIconS, 8)
    ctx.clip()
    ctx.drawImage(logoImg, m + 8, y, footerIconS, footerIconS)
    ctx.restore()
  } else {
    ctx.save()
    const fig = ctx.createLinearGradient(m + 8, y, m + 8 + footerIconS, y + footerIconS)
    fig.addColorStop(0, "#1e1b4b"); fig.addColorStop(1, "#312e81")
    rr(ctx, m + 8, y, footerIconS, footerIconS, 8); ctx.fillStyle = fig; ctx.fill()
    ctx.fillStyle = "#fff"; ctx.font = "bold 16px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("L", m + 8 + footerIconS / 2, y + footerIconS / 2 + 1)
    ctx.restore()
  }
  // "Loop" wordmark
  ctx.font = "bold 18px system-ui, sans-serif"; ctx.fillStyle = tc.textPrimary; ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.fillText("Loop", m + 8 + footerIconS + 10, y + footerIconS / 2)
  // Tagline
  ctx.font = "13px system-ui, sans-serif"; ctx.fillStyle = tc.textMuted
  ctx.fillText(TAGLINE, m + 8, y + footerIconS + 16)
  // www.loopapp.me
  ctx.font = "12px system-ui, sans-serif"; ctx.fillStyle = tc.textMuted; ctx.textAlign = "center"
  ctx.fillText(`www.${DOMAIN}`, cx, y + footerIconS + 36)
}

function toBlob(c: HTMLCanvasElement, q = 0.92): Promise<Blob> {
  return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error("empty")), "image/jpeg", q))
}

/* ── JSX Preview (matches canvas layout exactly) ── */
function CardPreview({ post, isDark }: { post: ShareAsImageModalProps["post"]; isDark: boolean }) {
  const nm = truncate(post.author.display_name || post.author.username || "User", 24)
  const likes = Number(post.stats?.likes_count || 0)
  const comments = Number(post.stats?.comments_count || 0)
  const branches = Number(post.stats?.branches_count || 0)
  const boosts = Number(post.stats?.boosts_count || 0)

  const allStats: { count: number; color: string; bg: string; icon: React.ReactNode }[] = []
  if (likes > 0) allStats.push({ count: likes, color: "text-rose-500", bg: "bg-rose-500/12", icon: <Heart className="h-3.5 w-3.5 fill-current" /> })
  if (comments > 0) allStats.push({ count: comments, color: "text-cyan-600", bg: "bg-cyan-500/12", icon: <MessageCircle className="h-3.5 w-3.5 fill-current" /> })
  if (branches > 0) allStats.push({ count: branches, color: "text-emerald-600", bg: "bg-emerald-500/12", icon: <GitBranch className="h-3.5 w-3.5" /> })
  if (boosts > 0) allStats.push({ count: boosts, color: "text-amber-600", bg: "bg-amber-500/12", icon: <Zap className="h-3.5 w-3.5 fill-current" /> })

  return (
    <div className={`relative w-full aspect-[4/5] select-none overflow-hidden rounded-[28px] text-left ${isDark ? "bg-zinc-900" : "bg-[#f5f3f0]"}`}>
      {/* Gradient top border */}
      <div className="absolute inset-x-0 top-0 h-2 rounded-t-[28px]" style={{ background: "linear-gradient(90deg, #8b5cf6, #a78bfa, #06b6d4)" }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full px-[5%]">
        {/* App icon centered at top */}
        <div className="flex justify-center pt-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-indigo-950 to-indigo-800 overflow-hidden">
            <img src="/icons/icon.svg" alt="Loop" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
          </div>
        </div>

        {/* Divider */}
        <div className={`mx-auto mt-5 h-px w-[88%] ${isDark ? "bg-white/[0.08]" : "bg-black/[0.06]"}`} />

        {/* Compact author byline */}
        <div className="flex items-center gap-3 mt-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-[3px]" style={{ background: "linear-gradient(135deg, #c084fc, #818cf8, #67e8f9)" }}>
            <span className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-full text-sm font-bold ${isDark ? "bg-zinc-700 text-zinc-300" : "bg-stone-200 text-stone-600"}`}>
              {post.author.avatar_url ? (
                <img src={`/api/image-proxy?url=${encodeURIComponent(post.author.avatar_url)}`} alt="" className="h-full w-full object-cover" />
              ) : nm.charAt(0).toUpperCase()}
            </span>
          </span>
          <div className="flex flex-col min-w-0">
            <p className={`truncate text-[15px] font-bold ${isDark ? "text-zinc-100" : "text-stone-900"}`}>{nm}</p>
            <p className={`truncate text-[13px] ${isDark ? "text-zinc-500" : "text-stone-400"}`}>@{truncate(post.author.username || "user", 28)}</p>
          </div>
        </div>

        {/* Post content — THE FOCAL POINT, vertically centered */}
        <div className="flex-1 flex items-center justify-start">
          <p className={`whitespace-pre-line text-[22px] sm:text-[24px] leading-[1.45] font-medium [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:8] overflow-hidden ${isDark ? "text-zinc-100" : "text-stone-800"}`}>
            {truncate(post.content || "Shared a loop", 500)}
          </p>
        </div>

        {/* Stats as pill badges with real icons */}
        {allStats.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            {allStats.map(({ count, color, bg, icon }, i) => (
              <span key={i} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${bg} ${color}`}>
                {icon} {fmt(count)}
              </span>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className={`mx-auto h-px w-[88%] ${isDark ? "bg-white/[0.06]" : "bg-black/[0.06]"}`} />

        {/* App signature footer */}
        <div className="pb-5 pt-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-950 to-indigo-800 overflow-hidden">
              <img src="/icons/icon.svg" alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
            </div>
            <span className={`text-[15px] font-bold ${isDark ? "text-zinc-100" : "text-stone-900"}`}>Loop</span>
          </div>
          <p className={`mt-2 text-[12px] ${isDark ? "text-zinc-500" : "text-stone-500"}`}>{TAGLINE}</p>
          <p className={`mt-1 text-[11px] ${isDark ? "text-zinc-600" : "text-stone-400"}`}>www.{DOMAIN}</p>
        </div>
      </div>
    </div>
  )
}

/* ── Main modal ── */
export function ShareAsImageModal({ open, onOpenChange, post }: ShareAsImageModalProps) {
  const { toast } = useToast()
  const { resolvedTheme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)
  const [exporting, setExporting] = useState(false)
  const avRef = useRef<AV | null>(null)
  const logoRef = useRef<HTMLImageElement | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const genRef = useRef(0)

  const isDark = resolvedTheme === "dark"

  const key = useMemo(() => [post.id, post.content, post.author.username, post.author.avatar_url, post.stats?.likes_count, post.stats?.comments_count, post.stats?.branches_count, post.stats?.boosts_count, isDark].join("|"),
    [post.id, post.content, post.author.username, post.author.avatar_url, post.stats?.likes_count, post.stats?.comments_count, post.stats?.branches_count, post.stats?.boosts_count, isDark])

  useEffect(() => {
    if (!open) { setRendered(false); setExporting(false); blobRef.current = null; avRef.current = null; return }
    const g = ++genRef.current; let c = false; setRendered(false)
    const run = async () => {
      const cv = canvasRef.current; if (!cv) return
      try {
        // Load logo if not already cached
        if (!logoRef.current) {
          logoRef.current = await loadImg("/icons/icon.svg")
          ;(cv as any)._loopLogo = logoRef.current
        }
        // Load avatar
        const avUrl = post.author.avatar_url ? `/api/image-proxy?url=${encodeURIComponent(post.author.avatar_url)}` : null
        const av = avUrl ? await loadAv(avUrl) : null
        if (c || genRef.current !== g) return
        avRef.current = av; ;(cv as any)._loopLogo = logoRef.current

        drawCard(cv, post, SCALE, av, isDark)
        if (c || genRef.current !== g) return
        blobRef.current = await toBlob(cv); setRendered(true)
      } catch { if (!c) setRendered(false) }
    }
    const t = window.setTimeout(() => void run(), 80)
    return () => { c = true; clearTimeout(t) }
  }, [open, key, isDark])

  const getBlob = async (): Promise<Blob> => {
    if (blobRef.current) return blobRef.current
    const cv = canvasRef.current; if (!cv) throw new Error("Canvas not ready")
    drawCard(cv, post, SCALE, avRef.current, isDark)
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
      <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Share2 className="h-4 w-4 text-indigo-500" /> Share as image
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">A branded card for sharing on X, Instagram, or anywhere.</DialogDescription>
        </DialogHeader>
        <canvas ref={canvasRef} className="hidden" />
        <div className="relative w-full overflow-hidden rounded-xl border border-border shadow-lg">
          <CardPreview post={post} isDark={isDark} />
          {!rendered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/70 backdrop-blur-[1px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Preparing image...</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => void download()} disabled={exporting} className="border-border bg-background text-foreground hover:bg-muted">
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} Download
          </Button>
          <Button onClick={() => void share()} className="bg-indigo-600 text-white hover:bg-indigo-700">
            <Share2 className="mr-1.5 h-4 w-4" /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
