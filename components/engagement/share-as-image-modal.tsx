"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, Share2, Heart, MessageCircle, GitBranch, Globe, BadgeCheck } from "lucide-react"

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

const CARD_W = 1080
const CARD_H = 1350
const SCALE = 1.5
const DOMAIN = "loopapp.me"
const SITE_URL = `https://www.${DOMAIN}`

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

/* ── Avatar ── */
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

/* ── Canvas ── */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
function setup(c: HTMLCanvasElement, s: number) {
  const ctx = c.getContext("2d"); if (!ctx) return null
  c.width = Math.round(CARD_W * s); c.height = Math.round(CARD_H * s)
  ctx.setTransform(s, 0, 0, s, 0, 0); return ctx
}
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, sy: number, mw: number, fs: number, color: string) {
  ctx.font = `${fs}px system-ui, sans-serif`
  const words = text.split(" "), lines: string[] = []
  let ln = ""
  for (const w of words) { const t = ln ? `${ln} ${w}` : w; if (ctx.measureText(t).width > mw && ln) { lines.push(ln); ln = w } else ln = t; if (lines.length >= 8) break }
  if (ln && lines.length < 8) lines.push(ln)
  ctx.fillStyle = color; ctx.textAlign = "left"
  let y = sy
  for (const l of lines) { ctx.fillText(l, x, y); y += fs * 1.35 }
  return y
}

function drawCard(canvas: HTMLCanvasElement, post: ShareAsImageModalProps["post"], scale: number, av: AV | null) {
  const ctx = setup(canvas, scale); if (!ctx) return
  const m = 64, iw = CARD_W - m * 2, cx = CARD_W / 2

  // ── BACKGROUND: warm off-white in light, deep navy in dark (we use dark for export) ──
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H)
  bg.addColorStop(0, "#fafaf9"); bg.addColorStop(0.5, "#f5f5f4"); bg.addColorStop(1, "#e7e5e4")
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CARD_W, CARD_H)

  // subtle texture — very light dot pattern
  ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.015)"
  for (let gx = 16; gx < CARD_W; gx += 28) for (let gy = 16; gy < CARD_H; gy += 28) { ctx.beginPath(); ctx.arc(gx, gy, 0.7, 0, Math.PI * 2); ctx.fill() }
  ctx.restore()

  let y = m + 20

  // ── HEADER: App icon + "Loop" wordmark left-aligned ──
  // Icon
  ctx.save()
  const igs = 44
  const ig = ctx.createLinearGradient(m, y, m + igs, y + igs)
  ig.addColorStop(0, "#6366f1"); ig.addColorStop(1, "#4f46e5")
  rr(ctx, m, y, igs, igs, 12); ctx.fillStyle = ig; ctx.fill()
  ctx.fillStyle = "#fff"; ctx.font = "bold 24px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText("L", m + igs / 2, y + igs / 2)
  ctx.restore()
  // Wordmark
  ctx.font = "bold 30px system-ui, sans-serif"; ctx.fillStyle = "#1c1917"; ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.fillText("Loop", m + igs + 12, y + igs / 2)
  // Tagline on the right
  ctx.font = "500 15px system-ui, sans-serif"; ctx.fillStyle = "#78716c"; ctx.textAlign = "right"
  ctx.fillText("build together.", m + iw, y + igs / 2)
  y += igs + 24

  // ── THIN RULE ──
  ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(m + iw, y); ctx.stroke()
  y += 24

  // ── AUTHOR ROW ──
  const avS = 56
  // Gradient ring
  ctx.save()
  const rg = ctx.createLinearGradient(m, y, m + avS, y + avS)
  rg.addColorStop(0, "#a78bfa"); rg.addColorStop(0.5, "#818cf8"); rg.addColorStop(1, "#60a5fa")
  ctx.beginPath(); ctx.arc(m + avS / 2, y + avS / 2, avS / 2 + 3, 0, Math.PI * 2); ctx.fillStyle = rg; ctx.fill()
  ctx.restore()
  // Avatar clip
  ctx.save(); ctx.beginPath(); ctx.arc(m + avS / 2, y + avS / 2, avS / 2, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = "#d6d3d1"; ctx.fillRect(m, y, avS, avS)
  if (av) { const { w, h } = avDim(av); const s = Math.min(w, h); ctx.drawImage(av, (w - s) / 2, (h - s) / 2, s, s, m, y, avS, avS) }
  else { ctx.font = "bold 24px system-ui"; ctx.fillStyle = "#57534e"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText((post.author.display_name || "U").charAt(0).toUpperCase(), m + avS / 2, y + avS / 2 + 1) }
  ctx.restore()

  // Name + handle
  const nx = m + avS + 14
  ctx.textAlign = "left"; ctx.textBaseline = "middle"
  ctx.font = "bold 22px system-ui, sans-serif"; ctx.fillStyle = "#1c1917"
  const nm = truncate(post.author.display_name || post.author.username || "User", 26)
  ctx.fillText(nm, nx, y + 18)
  if (post.author.is_verified) {
    const vx = nx + ctx.measureText(nm).width + 6
    ctx.fillStyle = "#6366f1"; ctx.beginPath(); ctx.arc(vx + 9, y + 18, 9, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText("\u2713", vx + 9, y + 18)
  }
  ctx.font = "16px system-ui, sans-serif"; ctx.fillStyle = "#a8a29e"
  ctx.fillText(`@${truncate(post.author.username || "user", 30)}`, nx, y + 40)

  y += avS + 16

  // ── POST CONTENT ──
  const body = truncate(post.content || "Shared a loop", 420)
  const textEnd = wrap(ctx, body, m, y + 6, iw, 24, "#292524")
  y = textEnd + 8

  // ── MEDIA (if any) ──
  if (post.media_url && (post.media_type === "image" || post.media_type === "gif")) {
    y += 8; const ih = 180
    rr(ctx, m, y, iw, ih, 14); ctx.fillStyle = "#e2e0dc"; ctx.fill()
    ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 1; rr(ctx, m, y, iw, ih, 14); ctx.stroke()
    ctx.font = "14px system-ui"; ctx.fillStyle = "#a8a29e"; ctx.textAlign = "center"
    ctx.fillText("Media attached", cx, y + ih / 2)
    y += ih + 12
  }

  // ── STATS ROW ──
  const stats = [
    { icon: "heart", count: Number(post.stats?.likes_count || 0), color: "#e11d48" },
    { icon: "repost", count: Number(post.stats?.branches_count || 0), color: "#059669" },
    { icon: "comment", count: Number(post.stats?.comments_count || 0), color: "#0891b2" },
  ]
  let sx = m
  for (const s of stats) {
    if (s.icon === "heart") {
      ctx.save(); ctx.fillStyle = s.color; ctx.beginPath()
      ctx.moveTo(sx + 7, y + 3); ctx.bezierCurveTo(sx + 7, y - 2, sx + 1.5, y - 1.5, sx + 1.5, y + 3)
      ctx.bezierCurveTo(sx + 1.5, y + 8, sx + 6.5, y + 10, sx + 7, y + 13)
      ctx.bezierCurveTo(sx + 7.5, y + 10, sx + 12.5, y + 8, sx + 12.5, y + 3)
      ctx.bezierCurveTo(sx + 12.5, y - 1.5, sx + 7, y - 2, sx + 7, y + 3); ctx.fill(); ctx.restore()
    } else if (s.icon === "comment") {
      ctx.fillStyle = s.color; rr(ctx, sx + 0.5, y - 2, 12, 9, 3); ctx.fill()
      ctx.beginPath(); ctx.moveTo(sx + 3.5, y + 7); ctx.lineTo(sx + 3.5, y + 9.5); ctx.lineTo(sx + 7, y + 7); ctx.fill()
    } else {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineCap = "round"
      ctx.beginPath(); ctx.moveTo(sx + 7, y - 2); ctx.lineTo(sx + 7, y + 6); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(sx + 2.5, y + 2); ctx.lineTo(sx + 7, y - 3); ctx.lineTo(sx + 11.5, y + 2); ctx.stroke()
    }
    ctx.font = "600 15px system-ui, sans-serif"; ctx.fillStyle = s.color; ctx.textAlign = "left"; ctx.textBaseline = "middle"
    const label = fmt(s.count)
    ctx.fillText(label, sx + 16, y + 5)
    sx += ctx.measureText(label).width + 30
  }
  y += 34

  // ── FOOTER: www.loopapp.me ──
  ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(m + iw, y); ctx.stroke()
  y += 18
  ctx.font = "500 15px system-ui, sans-serif"; ctx.fillStyle = "#6366f1"; ctx.textAlign = "center"
  ctx.fillText(`www.${DOMAIN}`, cx, y + 6)
  y += 32

  // ── "JOIN THE LOOP" CARD ──
  const jy = y, jh = 160
  rr(ctx, m, jy, iw, jh, 16); ctx.fillStyle = "#fff"; ctx.fill()
  // shadow
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.06)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4
  rr(ctx, m, jy, iw, jh, 16); ctx.fill()
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.restore()

  ctx.font = "bold 26px system-ui, sans-serif"; ctx.fillStyle = "#1c1917"; ctx.textAlign = "left"
  ctx.fillText("Join the ", m + 24, jy + 38)
  const jtw = ctx.measureText("Join the ").width
  ctx.fillStyle = "#6366f1"; ctx.fillText("Loop.", m + 24 + jtw, jy + 38)

  // Features row
  const feats = [
    { emoji: "\u{1F465}", label: "Co-Loop" },
    { emoji: "\u2694\uFE0F", label: "Duels" },
    { emoji: "\u{1F4AC}", label: "Circles" },
    { emoji: "\u26A1", label: "Connect" },
  ]
  const featStart = m + 24
  const featY = jy + 66
  const featGap = (iw - 48) / 4
  for (let i = 0; i < feats.length; i++) {
    const fx = featStart + i * featGap
    ctx.font = "24px system-ui"; ctx.textAlign = "left"
    ctx.fillText(feats[i].emoji, fx, featY + 10)
    ctx.font = "bold 13px system-ui, sans-serif"; ctx.fillStyle = "#44403c"
    ctx.fillText(feats[i].label, fx + 30, featY + 10)
  }

  // QR
  const qrS = 60, qrX = m + iw - qrS - 24, qrY = jy + 50
  ctx.save(); rr(ctx, qrX, qrY, qrS, qrS, 6); ctx.fillStyle = "#f5f5f4"; ctx.fill(); ctx.restore()
  // QR pattern
  ctx.save(); ctx.fillStyle = "#1c1917"
  const cs = qrS / 8
  const dc = (ox: number, oy: number) => { ctx.fillRect(ox, oy, cs * 2.5, cs * 0.8); ctx.fillRect(ox, oy + cs * 1.7, cs * 2.5, cs * 0.8); ctx.fillRect(ox, oy, cs * 0.8, cs * 2.5); ctx.fillRect(ox + cs * 1.7, oy, cs * 0.8, cs * 2.5) }
  dc(qrX + 3, qrY + 3); dc(qrX + qrS - cs * 2.5 - 3, qrY + 3); dc(qrX + 3, qrY + qrS - cs * 2.5 - 3)
  const seed = post.id.charCodeAt(0) || 42
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { if ((r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3)) continue; if ((seed * (r * 8 + c + 1) * 7) % 3 === 0) ctx.fillRect(qrX + c * cs + 3, qrY + r * cs + 3, cs, cs) }
  ctx.restore()

  ctx.font = "italic 12px Georgia, serif"; ctx.fillStyle = "#6366f1"; ctx.textAlign = "center"
  ctx.fillText("Scan Me", qrX + qrS / 2, qrY + qrS + 14)
}

function toBlob(c: HTMLCanvasElement, q = 0.92): Promise<Blob> {
  return new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error("empty")), "image/jpeg", q))
}

/* ── JSX Preview ── */
function CardPreview({ post }: { post: ShareAsImageModalProps["post"] }) {
  const nm = truncate(post.author.display_name || post.author.username || "User", 26)
  const stats = [
    { icon: Heart, count: Number(post.stats?.likes_count || 0), fg: "text-rose-600" },
    { icon: GitBranch, count: Number(post.stats?.branches_count || 0), fg: "text-emerald-600" },
    { icon: MessageCircle, count: Number(post.stats?.comments_count || 0), fg: "text-cyan-600" },
  ]

  return (
    <div className="relative w-full aspect-[4/5] select-none overflow-hidden rounded-xl text-left bg-stone-50 dark:bg-stone-900">
      {/* Dot texture */}
      <div className="absolute inset-0 opacity-[0.025] dark:opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, currentColor 0.5px, transparent 0.5px)", backgroundSize: "28px 28px" }} />

      <div className="relative z-10 flex flex-col h-full px-[6%] pt-[5%]">
        {/* Header: icon + wordmark + tagline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-sm">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <span className="text-[22px] font-bold text-stone-900 dark:text-stone-100">Loop</span>
          </div>
          <span className="text-[13px] font-medium text-stone-400 dark:text-stone-500">build together.</span>
        </div>

        {/* Rule */}
        <div className="my-4 h-px w-full bg-black/[0.06] dark:bg-white/[0.06]" />

        {/* Author */}
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full p-[2.5px]" style={{ background: "linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)" }}>
            <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-lg font-bold">
              {post.author.avatar_url ? (
                <img src={`/api/image-proxy?url=${encodeURIComponent(post.author.avatar_url)}`} alt="" className="h-full w-full object-cover" />
              ) : nm.charAt(0).toUpperCase()}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[15px] font-bold text-stone-900 dark:text-stone-100">{nm}</p>
              {post.author.is_verified && <BadgeCheck className="h-4 w-4 text-indigo-500 shrink-0" />}
            </div>
            <p className="truncate text-[12px] text-stone-400">@{truncate(post.author.username || "user", 30)}</p>
          </div>
        </div>

        {/* Content */}
        <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-stone-700 dark:text-stone-300 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:7] overflow-hidden">
          {truncate(post.content || "Shared a loop", 420)}
        </p>

        {/* Stats */}
        {stats.some(s => s.count > 0) && (
          <div className="flex items-center gap-5 mt-4">
            {stats.filter(s => s.count > 0).map(({ icon: Icon, count, fg }, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Icon className={`h-4 w-4 ${fg}`} strokeWidth={2.2} />
                <span className={`text-[13px] font-semibold ${fg}`}>{fmt(count)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-black/[0.06] dark:bg-white/[0.06]" />
          <span className="text-[12px] font-medium text-indigo-500 flex items-center gap-1">
            <Globe className="h-3 w-3" /> www.{DOMAIN}
          </span>
          <div className="h-px flex-1 bg-black/[0.06] dark:bg-white/[0.06]" />
        </div>

        <div className="flex-1" />

        {/* Join the Loop */}
        <div className="mb-[4%] rounded-2xl bg-white dark:bg-stone-800 shadow-md shadow-black/[0.04] p-5">
          <p className="text-[18px] font-bold text-stone-900 dark:text-stone-100">
            Join the <span className="text-indigo-500">Loop.</span>
          </p>
          <div className="flex items-center gap-3 mt-3">
            {[
              { emoji: "\u{1F465}", label: "Co-Loop" },
              { emoji: "\u2694\uFE0F", label: "Duels" },
              { emoji: "\u{1F4AC}", label: "Circles" },
              { emoji: "\u26A1", label: "Connect" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-base">{f.emoji}</span>
                <p className="text-[11px] font-bold text-stone-600 dark:text-stone-400">{f.label}</p>
              </div>
            ))}
            <div className="ml-auto shrink-0 text-center">
              <div className="h-[48px] w-[48px] rounded-md bg-stone-100 dark:bg-stone-700 p-0.5">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(SITE_URL)}&bgcolor=fafaf9&color=1c1917`}
                  alt="QR" className="h-full w-full rounded" loading="lazy"
                />
              </div>
              <p className="font-[Georgia] text-[9px] italic text-indigo-500 mt-0.5">Scan Me</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main ── */
export function ShareAsImageModal({ open, onOpenChange, post }: ShareAsImageModalProps) {
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)
  const [exporting, setExporting] = useState(false)
  const avRef = useRef<AV | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const genRef = useRef(0)

  const key = useMemo(() => [post.id, post.content, post.author.username, post.author.avatar_url, post.stats?.likes_count, post.stats?.comments_count, post.stats?.branches_count].join("|"),
    [post.id, post.content, post.author.username, post.author.avatar_url, post.stats?.likes_count, post.stats?.comments_count, post.stats?.branches_count])

  useEffect(() => {
    if (!open) { setRendered(false); setExporting(false); blobRef.current = null; avRef.current = null; return }
    const g = ++genRef.current; let c = false; setRendered(false)
    const run = async () => {
      const cv = canvasRef.current; if (!cv) return
      try {
        drawCard(cv, post, SCALE, avRef.current)
        if (c || genRef.current !== g) return
        blobRef.current = await toBlob(cv); setRendered(true)
        const a = post.author.avatar_url ? await loadAv(`/api/image-proxy?url=${encodeURIComponent(post.author.avatar_url)}`) : null
        if (c || genRef.current !== g) return
        avRef.current = a; drawCard(cv, post, SCALE, a)
        const b2 = await toBlob(cv)
        if (!c && genRef.current === g) blobRef.current = b2
      } catch { if (!c) setRendered(false) }
    }
    const t = window.setTimeout(() => void run(), 80)
    return () => { c = true; clearTimeout(t) }
  }, [open, key])

  const getBlob = async (): Promise<Blob> => {
    if (blobRef.current) return blobRef.current
    const cv = canvasRef.current; if (!cv) throw new Error("Canvas not ready")
    drawCard(cv, post, SCALE, avRef.current)
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
          <CardPreview post={post} />
          {!rendered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/70 backdrop-blur-[1px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Preparing image…</p>
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
