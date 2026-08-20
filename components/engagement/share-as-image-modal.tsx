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
  BadgeCheck,
} from "lucide-react"

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

/* ── Text wrapping ── */
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, startY: number, maxW: number, fontSize: number, color: string): number {
  ctx.font = `${fontSize}px system-ui, sans-serif`
  const words = text.split(" ")
  const lines: string[] = []
  let ln = ""
  for (const word of words) {
    const test = ln ? `${ln} ${word}` : word
    if (ctx.measureText(test).width > maxW && ln) { lines.push(ln); ln = word } else { ln = test }
    if (lines.length >= 8) break
  }
  if (ln && lines.length < 8) lines.push(ln)
  ctx.fillStyle = color; ctx.textAlign = "left"
  let y = startY
  for (const line of lines) {
    ctx.fillText(line, x, y)
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

  // ── Background: rich dark gradient ──
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH * 0.4, CARD_HEIGHT)
  bg.addColorStop(0, "#0a0820"); bg.addColorStop(0.4, "#0d0b28"); bg.addColorStop(1, "#060418")
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // Subtle dot grid
  ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.018)"
  for (let gx = 20; gx < CARD_WIDTH; gx += 32) {
    for (let gy = 20; gy < CARD_HEIGHT; gy += 32) {
      ctx.beginPath(); ctx.arc(gx, gy, 0.8, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()

  // Subtle center radial glow
  const glow = ctx.createRadialGradient(cx, CARD_HEIGHT * 0.3, 0, cx, CARD_HEIGHT * 0.3, 550)
  glow.addColorStop(0, "rgba(99,102,241,0.05)"); glow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = glow; ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  let y = m + 30

  // ── App icon ──
  const iconSize = 56
  ctx.save()
  const iconGrad = ctx.createLinearGradient(cx - iconSize / 2, y, cx + iconSize / 2, y + iconSize)
  iconGrad.addColorStop(0, "#818cf8"); iconGrad.addColorStop(1, "#6366f1")
  roundRect(ctx, cx - iconSize / 2, y, iconSize, iconSize, 16)
  ctx.fillStyle = iconGrad; ctx.fill()
  ctx.fillStyle = "#fff"; ctx.font = "bold 30px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText("L", cx, y + iconSize / 2)
  ctx.restore()
  y += iconSize + 16

  // ── "Loop" wordmark ──
  ctx.font = "bold 42px system-ui, sans-serif"; ctx.fillStyle = "#f1f5f9"; ctx.textAlign = "center"; ctx.textBaseline = "top"
  ctx.fillText("Loop", cx, y)
  y += 52

  // ── Thin divider ──
  const divGrad = ctx.createLinearGradient(m + 80, y, m + innerW - 80, y)
  divGrad.addColorStop(0, "rgba(99,102,241,0)"); divGrad.addColorStop(0.5, "rgba(99,102,241,0.2)"); divGrad.addColorStop(1, "rgba(99,102,241,0)")
  ctx.strokeStyle = divGrad; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(m + 80, y); ctx.lineTo(m + innerW - 80, y); ctx.stroke()
  y += 24

  // ── Author section (ABOVE the post content) ──
  const aX = m + 40
  const avSize = 64
  const avY = y

  // Gradient ring around avatar
  ctx.save()
  const ringG = ctx.createLinearGradient(aX, avY, aX + avSize, avY + avSize)
  ringG.addColorStop(0, "#818cf8"); ringG.addColorStop(0.5, "#c084fc"); ringG.addColorStop(1, "#67e8f9")
  ctx.beginPath(); ctx.arc(aX + avSize / 2, avY + avSize / 2, avSize / 2 + 3, 0, Math.PI * 2); ctx.fillStyle = ringG; ctx.fill()
  ctx.restore()

  // Avatar
  ctx.save()
  ctx.beginPath(); ctx.arc(aX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = "#334155"; ctx.fillRect(aX, avY, avSize, avSize)
  if (avatarSrc) {
    const { w, h } = avatarDimensions(avatarSrc); const sz = Math.min(w, h)
    ctx.drawImage(avatarSrc, (w - sz) / 2, (h - sz) / 2, sz, sz, aX, avY, avSize, avSize)
  } else {
    ctx.font = "bold 28px system-ui"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText((post.author.display_name || "U").charAt(0).toUpperCase(), aX + avSize / 2, avY + avSize / 2 + 2)
  }
  ctx.restore()

  // Author name + username
  const nameX = aX + avSize + 16
  ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.font = "bold 26px system-ui, sans-serif"; ctx.fillStyle = "#f1f5f9"
  const name = truncate(post.author.display_name || post.author.username || "User", 28)
  ctx.fillText(name, nameX, avY + 24)

  // Verified badge
  let badgeX = nameX + ctx.measureText(name).width + 8
  if (post.author.is_verified) {
    ctx.fillStyle = "#818cf8"
    ctx.beginPath(); ctx.arc(badgeX + 10, avY + 24, 10, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("✓", badgeX + 10, avY + 24)
    badgeX += 24
  }

  ctx.font = "18px system-ui, sans-serif"; ctx.fillStyle = "#64748b"; ctx.textAlign = "left"
  ctx.fillText(`@${truncate(post.author.username || "user", 30)}`, nameX, avY + 50)

  // Time ago
  ctx.font = "15px system-ui, sans-serif"; ctx.fillStyle = "#4a5068"
  ctx.fillText("Shared on Loop", nameX, avY + 70)

  y = avY + avSize + 20

  // ── Post content ──
  const bodyText = truncate(post.content || "Shared a loop", 400)
  const textEndY = wrapText(ctx, bodyText, aX, y + 8, innerW - 80, 26, "#cbd5e1")
  y = textEndY + 8

  // ── Media image (if present) ──
  if (post.media_url && (post.media_type === "image" || post.media_type === "gif")) {
    y += 8
    const imgH = 200
    roundRect(ctx, aX, y, innerW - 80, imgH, 12)
    ctx.fillStyle = "#1a1630"; ctx.fill()
    // Placeholder rectangle
    ctx.strokeStyle = "rgba(99,102,241,0.2)"; ctx.lineWidth = 1
    roundRect(ctx, aX, y, innerW - 80, imgH, 12); ctx.stroke()
    ctx.font = "14px system-ui"; ctx.fillStyle = "#4a5068"; ctx.textAlign = "center"
    ctx.fillText("Media attached", aX + (innerW - 80) / 2, y + imgH / 2)
    y += imgH + 12
  }

  // ── Stats row (BELOW content, CLOSE to it) ──
  const stats = [
    { icon: "heart", count: Number(post.stats?.likes_count || 0), color: "#f472b6" },
    { icon: "repost", count: Number(post.stats?.branches_count || 0), color: "#34d399" },
    { icon: "comment", count: Number(post.stats?.comments_count || 0), color: "#22d3ee" },
  ]
  const statSpacing = 28
  let sx = aX
  for (const s of stats) {
    // Icon
    if (s.icon === "heart") {
      ctx.save(); ctx.fillStyle = s.color; ctx.beginPath()
      ctx.moveTo(sx + 8, y + 4); ctx.bezierCurveTo(sx + 8, y - 2, sx + 2, y - 1.5, sx + 2, y + 4)
      ctx.bezierCurveTo(sx + 2, y + 9, sx + 7.2, y + 11, sx + 8, y + 14)
      ctx.bezierCurveTo(sx + 8.8, y + 11, sx + 14, y + 9, sx + 14, y + 4)
      ctx.bezierCurveTo(sx + 14, y - 1.5, sx + 8, y - 2, sx + 8, y + 4)
      ctx.fill(); ctx.restore()
    } else if (s.icon === "comment") {
      ctx.fillStyle = s.color
      roundRect(ctx, sx + 1, y - 3, 13, 10, 3); ctx.fill()
      ctx.beginPath(); ctx.moveTo(sx + 4, y + 7); ctx.lineTo(sx + 4, y + 10); ctx.lineTo(sx + 8, y + 7); ctx.fill()
    } else {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineCap = "round"
      ctx.beginPath(); ctx.moveTo(sx + 8, y - 2); ctx.lineTo(sx + 8, y + 6); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(sx + 3, y + 2); ctx.lineTo(sx + 8, y - 3); ctx.lineTo(sx + 13, y + 2); ctx.stroke()
    }
    // Count
    ctx.font = "600 17px system-ui, sans-serif"; ctx.fillStyle = s.color; ctx.textAlign = "left"; ctx.textBaseline = "middle"
    ctx.fillText(formatCount(s.count), sx + 18, y + 6)
    sx += ctx.measureText(formatCount(s.count)).width + statSpacing + 18
  }
  y += 40

  // ── www.loopapp.me footer (CLOSE to content) ──
  const footGrad = ctx.createLinearGradient(m + 80, y, m + innerW - 80, y)
  footGrad.addColorStop(0, "rgba(99,102,241,0)"); footGrad.addColorStop(0.5, "rgba(99,102,241,0.15)"); footGrad.addColorStop(1, "rgba(99,102,241,0)")
  ctx.strokeStyle = footGrad; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(m + 80, y); ctx.lineTo(m + innerW - 80, y); ctx.stroke()
  y += 20
  ctx.font = "500 18px system-ui, sans-serif"; ctx.fillStyle = "#6366f1"; ctx.textAlign = "center"
  ctx.fillText(`www.${DOMAIN}`, cx, y + 8)
  y += 36

  // ── "Join the Loop" section ──
  const joinY = y + 12
  const joinH = 180

  // Border glow
  ctx.save()
  ctx.shadowColor = "rgba(99,102,241,0.25)"; ctx.shadowBlur = 16
  roundRect(ctx, m + 30, joinY, innerW - 60, joinH, 20)
  ctx.fillStyle = "rgba(15,13,35,0.6)"; ctx.fill()
  ctx.shadowBlur = 0
  // Gradient border
  const jGrad = ctx.createLinearGradient(m + 30, joinY, m + 30 + innerW - 60, joinY)
  jGrad.addColorStop(0, "rgba(139,92,246,0.3)"); jGrad.addColorStop(0.5, "rgba(34,211,238,0.15)"); jGrad.addColorStop(1, "rgba(99,102,241,0.3)")
  roundRect(ctx, m + 30, joinY, innerW - 60, joinH, 20); ctx.strokeStyle = jGrad; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.restore()

  // "Join the Loop." text
  ctx.font = "bold 32px system-ui, sans-serif"; ctx.fillStyle = "#f1f5f9"; ctx.textAlign = "left"
  ctx.fillText("Join the ", m + 60, joinY + 40)
  const jtw = ctx.measureText("Join the ").width
  ctx.fillStyle = "#818cf8"; ctx.fillText("Loop.", m + 60 + jtw, joinY + 40)

  // Feature highlights in a row
  const features = [
    { emoji: "\u{1F465}", label: "Co-Loop" },
    { emoji: "\u2694\uFE0F", label: "Duels" },
    { emoji: "\u{1F4AC}", label: "Circles" },
    { emoji: "\u26A1", label: "Connect" },
  ]
  const featStartX = m + 60
  const featY = joinY + 70
  const featSpacing = (innerW - 160) / 4
  for (let i = 0; i < features.length; i++) {
    const fx = featStartX + i * featSpacing
    ctx.font = "28px system-ui"; ctx.textAlign = "left"
    ctx.fillText(features[i].emoji, fx, featY + 12)
    ctx.font = "bold 15px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0"
    ctx.fillText(features[i].label, fx + 34, featY + 12)
  }

  // QR Code
  const qrSize = 70
  const qrX = m + 30 + innerW - 60 - qrSize - 30
  const qrY = joinY + 42
  ctx.save(); roundRect(ctx, qrX, qrY, qrSize, qrSize, 6); ctx.fillStyle = "#fff"; ctx.fill(); ctx.restore()
  // QR pattern
  ctx.save(); ctx.fillStyle = "#0f172a"
  const cellSize = qrSize / 8
  const drawCorner = (ox: number, oy: number) => { ctx.fillRect(ox, oy, cellSize * 2.5, cellSize * 0.8); ctx.fillRect(ox, oy + cellSize * 1.7, cellSize * 2.5, cellSize * 0.8); ctx.fillRect(ox, oy, cellSize * 0.8, cellSize * 2.5); ctx.fillRect(ox + cellSize * 1.7, oy, cellSize * 0.8, cellSize * 2.5) }
  drawCorner(qrX + 4, qrY + 4); drawCorner(qrX + qrSize - cellSize * 2.5 - 4, qrY + 4); drawCorner(qrX + 4, qrY + qrSize - cellSize * 2.5 - 4)
  const seed = post.id.charCodeAt(0) || 42
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { if ((r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3)) continue; if ((seed * (r * 8 + c + 1) * 7) % 3 === 0) ctx.fillRect(qrX + c * cellSize + 4, qrY + r * cellSize + 4, cellSize, cellSize) }
  ctx.restore()

  // "Scan Me" text
  ctx.font = "italic 13px Georgia, serif"; ctx.fillStyle = "#818cf8"; ctx.textAlign = "center"
  ctx.fillText("Scan Me", qrX + qrSize / 2, qrY + qrSize + 16)

  // Bottom glow
  const bGlow = ctx.createRadialGradient(cx, CARD_HEIGHT, 0, cx, CARD_HEIGHT, 300)
  bGlow.addColorStop(0, "rgba(99,102,241,0.04)"); bGlow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = bGlow; ctx.fillRect(0, CARD_HEIGHT - 300, CARD_WIDTH, 300)
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => { canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas empty"))), "image/jpeg", quality) })
}

/* ── JSX Preview ── */
function ShareCardPreview({ post }: { post: ShareAsImageModalProps["post"] }) {
  const name = truncate(post.author.display_name || post.author.username || "User", 28)
  const stats = [
    { icon: Heart, count: Number(post.stats?.likes_count || 0), color: "text-pink-400" },
    { icon: GitBranch, count: Number(post.stats?.branches_count || 0), color: "text-emerald-400" },
    { icon: MessageCircle, count: Number(post.stats?.comments_count || 0), color: "text-cyan-400" },
  ]

  return (
    <div
      className="relative w-full aspect-[4/5] select-none overflow-hidden rounded-xl text-left"
      style={{ background: "linear-gradient(160deg, #0a0820 0%, #0d0b28 40%, #060418 100%)" }}
    >
      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 0.5px, transparent 0.5px)", backgroundSize: "32px 32px" }} />

      {/* Center glow */}
      <div className="absolute top-[25%] left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[450px] rounded-full bg-indigo-500/[0.05] blur-3xl" />

      {/* Bottom glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-28 w-[60%] rounded-full bg-indigo-500/[0.04] blur-3xl" />

      {/* Content */}
      <div className="relative z-10 flex flex-col px-[8%] pt-[6%] h-full">
        {/* App icon */}
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600">
            <span className="text-white font-bold text-2xl">L</span>
          </div>
        </div>

        {/* Loop wordmark */}
        <p className="text-center text-[32px] font-bold text-slate-100 mt-2 tracking-tight">Loop</p>

        {/* Divider */}
        <div className="mx-auto mt-3 h-px w-[60%] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

        {/* Author section (ABOVE content) */}
        <div className="flex items-center gap-3 mt-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full p-[2.5px]" style={{ background: "linear-gradient(135deg, #818cf8, #c084fc, #67e8f9)" }}>
            <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-slate-700 text-slate-200 text-lg font-bold">
              {post.author.avatar_url ? (
                <img src={`/api/image-proxy?url=${encodeURIComponent(post.author.avatar_url)}`} alt="" className="h-full w-full object-cover" />
              ) : name.charAt(0).toUpperCase()}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[16px] font-bold text-slate-100">{name}</p>
              {post.author.is_verified && <BadgeCheck className="h-4 w-4 text-indigo-400 shrink-0" />}
            </div>
            <p className="truncate text-[12px] text-slate-500">@{truncate(post.author.username || "user", 30)}</p>
            <p className="text-[10px] text-slate-600">Shared on Loop</p>
          </div>
        </div>

        {/* Post content (below author) */}
        <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-slate-300 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:6] overflow-hidden">
          {truncate(post.content || "Shared a loop", 400)}
        </p>

        {/* Stats row (CLOSE to content) */}
        {stats.some((s) => s.count > 0) && (
          <div className="flex items-center gap-5 mt-4">
            {stats.filter((s) => s.count > 0).map(({ icon: Icon, count, color }, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Icon className={`h-4 w-4 ${color}`} strokeWidth={2.2} />
                <span className={`text-[13px] font-semibold ${color}`}>{formatCount(count)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer - www.loopapp.me (close to content) */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-indigo-500/15" />
          <span className="text-[12px] font-medium text-indigo-400 flex items-center gap-1">
            <Globe className="h-3 w-3" /> www.{DOMAIN}
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-indigo-500/15" />
        </div>

        <div className="flex-1" />

        {/* Join the Loop section */}
        <div className="mb-[3%] rounded-2xl border border-transparent p-[1.5px]" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(34,211,238,0.15), rgba(99,102,241,0.3))" }}>
          <div className="rounded-[15px] bg-[#0d0b22]/70 p-4">
            <p className="text-[18px] font-bold text-slate-100">
              Join the <span className="text-indigo-400">Loop.</span>
            </p>
            <div className="flex items-center gap-3 mt-2">
              {[
                { emoji: "\u{1F465}", label: "Co-Loop" },
                { emoji: "\u2694\uFE0F", label: "Duels" },
                { emoji: "\u{1F4AC}", label: "Circles" },
                { emoji: "\u26A1", label: "Connect" },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-base">{f.emoji}</span>
                  <p className="text-[10px] font-bold text-slate-300">{f.label}</p>
                </div>
              ))}
              <div className="ml-auto shrink-0 text-center">
                <div className="h-[52px] w-[52px] rounded-md bg-white p-0.5">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(SITE_URL)}&bgcolor=ffffff&color=0f172a`}
                    alt="QR Code" className="h-full w-full" loading="lazy"
                  />
                </div>
                <p className="font-[Georgia] text-[9px] italic text-indigo-400 mt-0.5">Scan Me</p>
              </div>
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
    } catch (error: any) { toast({ title: "Download failed", description: error?.message || "Unknown error", variant: "destructive" }) }
    finally { setExporting(false) }
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
