"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Gift, Star, X } from "lucide-react"
import { GiftArtwork } from "@/components/gifting/gift-art"
import { cn } from "@/lib/utils"

export interface GiftSendEvent {
  /** Client-side unique key for the queue. */
  key: string
  giftId: string
  canonicalId?: string | null
  name: string
  cost: number
  type: string
  rarity: string
  art?: string | null
  celebration?: string | null
  durationMs?: number | null
  palette?: { primary: string; secondary: string; accent?: string } | null
  sender?: {
    display_name?: string | null
    username?: string | null
    avatar_url?: string | null
  } | null
  message?: string | null
  anonymous?: boolean
  optimistic?: boolean
  sound?: string | null
}

const DEFAULT_PALETTE = { primary: "#a78bfa", secondary: "#f472b6", accent: "#fde68a" }

/**
 * Plays gift animations one at a time. Rapid sends queue instead of stacking
 * full-screen overlays on top of each other.
 */
export function useGiftCelebration() {
  const [queue, setQueue] = useState<GiftSendEvent[]>([])
  const [current, setCurrent] = useState<GiftSendEvent | null>(null)

  useEffect(() => {
    if (current || queue.length === 0) return
    setCurrent(queue[0])
    setQueue((prev) => prev.slice(1))
  }, [current, queue])

  const enqueue = useCallback((event: GiftSendEvent) => {
    setQueue((prev) => [...prev, event].slice(-12))
  }, [])

  const finish = useCallback(() => setCurrent(null), [])

  const clear = useCallback(() => {
    setQueue([])
    setCurrent(null)
  }, [])

  return { current, queue, enqueue, finish, clear }
}

const STYLE_COLORS: Record<string, string[]> = {
  hearts: ["#ff3d7f", "#ff8fb1", "#ffd1dc", "#ffe0ea"],
  paws: ["#ffb26b", "#ffd8a8", "#ffe9cc", "#fff3e2"],
  confetti: ["#f5c542", "#ffe89a", "#fbbf24", "#ffffff", "#b7791f"],
  rainbow: ["#f472b6", "#a78bfa", "#67e8f9", "#86efac", "#fde68a"],
  gold: ["#fbbf24", "#fde68a", "#f59e0b", "#fff7cc"],
  launch: ["#fbbf24", "#fb923c", "#fde68a", "#fff7ed"],
  flame: ["#ef4444", "#f97316", "#fde68a", "#fca5a5"],
  galaxy: ["#a855f7", "#22d3ee", "#f0abfc", "#e0f2fe", "#6366f1"],
  speed: ["#ef4444", "#f97316", "#fde68a", "#fef2f2"],
  meteor: ["#fde68a", "#c4b5fd", "#e0f2fe", "#fef9c3"],
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  shape: "dot" | "rect" | "streak" | "star"
  rot: number
  vr: number
  gravity: number
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false
  if (document.documentElement.classList.contains("loop-reduced-motion")) return true
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function ParticleField({
  style,
  palette,
  durationMs,
}: {
  style: string
  palette: { primary: string; secondary: string; accent?: string }
  durationMs: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reduced = prefersReducedMotion()
    if (reduced) return

    const colors = STYLE_COLORS[style] || [palette.primary, palette.secondary, palette.accent || "#fff"]
    let width = 0
    let height = 0
    let dpr = 1
    let raf = 0
    let stopped = false
    let last = performance.now()
    let spawnBudget = 0
    const particles: Particle[] = []

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener("resize", resize)

    const random = (min: number, max: number) => min + Math.random() * (max - min)
    const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

    const spawn = () => {
      const color = pick(colors)
      const cx = width * 0.5
      const cy = height * 0.44

      if (style === "hearts" || style === "paws") {
        particles.push({
          x: random(width * 0.12, width * 0.88),
          y: height + 20,
          vx: random(-10, 10),
          vy: random(-70, -34),
          life: 0,
          maxLife: random(2.2, 3.6),
          size: random(4, 11),
          color,
          shape: "dot",
          rot: random(0, Math.PI),
          vr: random(-2, 2),
          gravity: -4,
        })
        return
      }

      if (style === "confetti" || style === "gold") {
        particles.push({
          x: random(0, width),
          y: -16,
          vx: random(-30, 30),
          vy: random(40, 110),
          life: 0,
          maxLife: random(2.4, 4),
          size: random(3, 8),
          color,
          shape: style === "gold" ? "star" : "rect",
          rot: random(0, Math.PI),
          vr: random(-4, 4),
          gravity: 24,
        })
        return
      }

      if (style === "rainbow") {
        const angle = random(0, Math.PI * 2)
        const speed = random(30, 100)
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: random(1.8, 3.2),
          size: random(2.5, 7),
          color,
          shape: "dot",
          rot: 0,
          vr: 0,
          gravity: 8,
        })
        return
      }

      if (style === "launch" || style === "flame") {
        particles.push({
          x: width * (style === "launch" ? 0.5 : 0.3) + random(-40, 40),
          y: height * 0.72 + random(-20, 20),
          vx: random(-26, 26),
          vy: style === "launch" ? random(-220, -90) : random(-130, -40),
          life: 0,
          maxLife: random(0.9, 2.2),
          size: random(3, 9),
          color,
          shape: style === "launch" ? "streak" : "dot",
          rot: 0,
          vr: 0,
          gravity: style === "launch" ? 40 : -20,
        })
        return
      }

      if (style === "galaxy") {
        const angle = random(0, Math.PI * 2)
        const radius = random(4, 30)
        particles.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          vx: Math.cos(angle) * random(25, 130),
          vy: Math.sin(angle) * random(25, 130),
          life: 0,
          maxLife: random(1.6, 3.4),
          size: random(1.5, 5),
          color,
          shape: Math.random() > 0.7 ? "star" : "dot",
          rot: random(0, Math.PI),
          vr: random(-2, 2),
          gravity: 6,
        })
        return
      }

      if (style === "speed") {
        particles.push({
          x: -60,
          y: random(height * 0.25, height * 0.9),
          vx: random(420, 900),
          vy: random(-12, 12),
          life: 0,
          maxLife: random(0.7, 1.6),
          size: random(20, 90),
          color,
          shape: "streak",
          rot: 0,
          vr: 0,
          gravity: 0,
        })
        return
      }

      // meteor
      particles.push({
        x: random(width * 0.5, width * 1.05),
        y: random(-10, height * 0.4),
        vx: random(-220, -120),
        vy: random(130, 240),
        life: 0,
        maxLife: random(1, 2.1),
        size: random(24, 80),
        color,
        shape: "streak",
        rot: 0,
        vr: 0,
        gravity: 12,
      })
    }

    const drawStar = (size: number) => {
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const radius = i % 2 === 0 ? size : size * 0.4
        const angle = (Math.PI / 4) * i
        const px = Math.cos(angle) * radius
        const py = Math.sin(angle) * radius
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
    }

    const frame = (now: number) => {
      if (stopped) return
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = "lighter"

      spawnBudget += dt * (style === "galaxy" || style === "flame" ? 120 : style === "hearts" ? 48 : 66)
      while (spawnBudget >= 1 && particles.length < 700) {
        spawn()
        spawnBudget -= 1
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life += dt
        if (p.life >= p.maxLife) {
          particles.splice(i, 1)
          continue
        }
        p.vy += p.gravity * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.vr * dt

        const progress = p.life / p.maxLife
        const alpha = Math.max(0, 1 - progress) * 0.95
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color

        if (p.shape === "streak") {
          const length = Math.max(8, p.size)
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(Math.atan2(p.vy, p.vx))
          const gradient = ctx.createLinearGradient(-length, 0, 0, 0)
          gradient.addColorStop(0, "rgba(255,255,255,0)")
          gradient.addColorStop(1, p.color)
          ctx.fillStyle = gradient
          ctx.fillRect(-length, -1.1, length, 2.2)
          ctx.restore()
        } else if (p.shape === "rect") {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rot)
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
          ctx.restore()
        } else if (p.shape === "star") {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rot)
          drawStar(p.size)
          ctx.restore()
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = "source-over"

      if (performance.now() - startedAt < durationMs + 1500) {
        raf = window.requestAnimationFrame(frame)
      }
    }

    const startedAt = performance.now()
    raf = window.requestAnimationFrame(frame)

    return () => {
      stopped = true
      window.cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [style, palette, durationMs])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  )
}

function playGiftSound(sound: string | undefined, muted: boolean) {
  if (muted || !sound || typeof window === "undefined") return
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    const notes =
      sound === "boom" ? [92, 61] : sound === "whoosh" ? [420, 680] : sound === "chime" ? [880, 1320] : [660, 990]
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = sound === "boom" ? "sine" : "triangle"
      osc.frequency.setValueAtTime(freq, now + index * 0.08)
      gain.gain.setValueAtTime(0.0001, now + index * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.06, now + index * 0.08 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + index * 0.08)
      osc.stop(now + index * 0.08 + 0.55)
    })
    window.setTimeout(() => void ctx.close().catch(() => {}), 1200)
  } catch {
    /* Audio is optional. */
  }
}

export function GiftCelebration({
  event,
  queued = 0,
  muted = true,
  onDone,
}: {
  event: GiftSendEvent
  queued?: number
  muted?: boolean
  onDone: () => void
}) {
  const duration = Math.min(Math.max(event.durationMs || 6500, 4200), 10000)
  const [reduced, setReduced] = useState(false)
  const doneRef = useRef(false)

  const palette = event.palette || DEFAULT_PALETTE
  const style = event.celebration || "confetti"

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }, [onDone])

  useEffect(() => {
    const isReduced = prefersReducedMotion()
    setReduced(isReduced)
    playGiftSound(event.sound || undefined, muted)
    const timer = window.setTimeout(finish, isReduced ? 2600 : duration)
    return () => window.clearTimeout(timer)
  }, [duration, event, finish, muted])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [finish])

  const senderName = event.anonymous
    ? "Someone"
    : event.sender?.display_name || event.sender?.username || "A fan"

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label={`${senderName} sent ${event.name}`}
    >
      <div
        className="gift-celebration-veil absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${palette.primary}2e, transparent 70%), radial-gradient(ellipse 50% 40% at 50% 50%, ${palette.secondary}24, transparent 72%), rgba(2,3,8,0.42)`,
        }}
      />

      <ParticleField
        key={event.key}
        style={reduced ? "none" : style}
        palette={palette}
        durationMs={duration}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
        <div className="gift-celebration-stage relative flex h-[min(52vh,420px)] w-[min(80vw,420px)] items-center justify-center">
          <span
            className="gift-celebration-halo absolute inset-0 rounded-full blur-2xl"
            style={{
              background: `conic-gradient(from 0deg, ${palette.primary}66, ${palette.secondary}55, ${palette.accent || palette.primary}44, ${palette.primary}66)`,
            }}
          />
          <span
            className="gift-celebration-ring absolute inset-[12%] rounded-full border"
            style={{ borderColor: `${palette.accent || "#fff"}66` }}
          />
          <span
            className="gift-celebration-ring gift-celebration-ring-late absolute inset-[2%] rounded-full border"
            style={{ borderColor: `${palette.primary}55` }}
          />
          <GiftArtwork
            art={event.art}
            title={event.name}
            className="gift-celebration-art relative z-10 h-[74%] w-[74%] drop-shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
          />

          <span className="gift-celebration-spark absolute left-[8%] top-[18%] h-2 w-2 rounded-full bg-white" />
          <span className="gift-celebration-spark gift-celebration-spark-2 absolute right-[12%] top-[30%] h-1.5 w-1.5 rounded-full bg-white" />
          <span className="gift-celebration-spark gift-celebration-spark-3 absolute bottom-[22%] left-[22%] h-1.5 w-1.5 rounded-full bg-white" />
        </div>

        <div className="gift-celebration-card mt-2 w-[min(92vw,440px)]">
          <div className="relative overflow-hidden rounded-[26px] border border-white/15 bg-black/55 px-5 py-4 text-center shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${palette.accent || palette.primary}, transparent)`,
              }}
            />
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/55">
              Gift delivered
            </p>
            <p className="mt-1.5 text-lg font-black tracking-tight text-white">
              {senderName} sent{" "}
              <span style={{ color: palette.accent || palette.primary }}>{event.name}</span>
            </p>
            {event.message ? (
              <p className="mx-auto mt-2 max-w-sm rounded-2xl bg-white/10 px-3 py-2 text-[13px] italic text-white/85">
                “{event.message}”
              </p>
            ) : null}
            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-semibold text-white/65">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 capitalize">
                <Star className="h-3 w-3" style={{ color: palette.accent || palette.primary }} />
                {event.rarity}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1">
                <Gift className="h-3 w-3" style={{ color: palette.primary }} />
                {event.cost.toLocaleString()} coins
              </span>
              {event.optimistic ? (
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">sending…</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-2">
        {queued > 0 ? (
          <span className="rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white/80 backdrop-blur">
            +{queued} queued
          </span>
        ) : null}
        <button
          type="button"
          onClick={finish}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 text-[11px] font-semibold text-white/80 backdrop-blur transition hover:bg-black/70"
        >
          <X className="h-3.5 w-3.5" />
          Skip
        </button>
      </div>

      <style jsx global>{`
        @keyframes gift-veil-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes gift-stage-in {
          0% { opacity: 0; transform: scale(0.5) rotate(-8deg); }
          55% { opacity: 1; transform: scale(1.06) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes gift-art-float {
          0%, 100% { transform: translateY(0) rotate(-1.5deg); }
          50% { transform: translateY(-14px) rotate(1.5deg); }
        }
        @keyframes gift-halo-spin {
          from { transform: rotate(0deg) scale(0.94); opacity: 0.7; }
          50% { opacity: 1; }
          to { transform: rotate(360deg) scale(0.94); opacity: 0.7; }
        }
        @keyframes gift-ring-pulse {
          0% { transform: scale(0.7); opacity: 0.9; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes gift-card-in {
          0% { opacity: 0; transform: translateY(28px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes gift-spark-drift {
          0% { opacity: 0; transform: translateY(10px) scale(0.6); }
          30% { opacity: 0.9; }
          100% { opacity: 0; transform: translateY(-38px) scale(1.15); }
        }
        .gift-celebration-veil { animation: gift-veil-in 500ms ease-out both; }
        .gift-celebration-stage { animation: gift-stage-in 900ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .gift-celebration-halo { animation: gift-halo-spin 9s linear infinite; }
        .gift-celebration-ring { animation: gift-ring-pulse 2.6s ease-out infinite; }
        .gift-celebration-ring-late { animation-delay: 1.2s; }
        .gift-celebration-art { animation: gift-art-float 3.6s ease-in-out infinite; }
        .gift-celebration-card { animation: gift-card-in 700ms 700ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .gift-celebration-spark { animation: gift-spark-drift 2.2s ease-out infinite; }
        .gift-celebration-spark-2 { animation-delay: 0.6s; }
        .gift-celebration-spark-3 { animation-delay: 1.1s; }
        @media (prefers-reduced-motion: reduce) {
          .gift-celebration-stage,
          .gift-celebration-halo,
          .gift-celebration-ring,
          .gift-celebration-art,
          .gift-celebration-card,
          .gift-celebration-spark,
          .gift-celebration-veil {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}

/** Small inline preview used by the live-room gift strip. */
export function GiftBurstBadge({ art, className }: { art?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5",
        className,
      )}
    >
      <GiftArtwork art={art} className="h-7 w-7" />
    </span>
  )
}

export function useStableGiftKey() {
  return useMemo(() => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, [])
}
