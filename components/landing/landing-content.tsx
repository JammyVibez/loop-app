"use client"

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Check,
  Swords,
  Coins,
  Trophy,
  Play,
  Smartphone,
  ArrowUpRight,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { AppLogo } from "@/components/brand/app-logo"

/* ─── motion primitives ─────────────────────────────────── */

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, visible }
}

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        visible ? "translate-y-0 opacity-100 blur-0" : "translate-y-12 opacity-0 blur-[2px]",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

/** Magnetic pull toward cursor on hover */
function Magnetic({
  children,
  className,
  strength = 0.35,
}: {
  children: React.ReactNode
  className?: string
  strength?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [t, setT] = useState({ x: 0, y: 0 })

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const x = (e.clientX - (r.left + r.width / 2)) * strength
      const y = (e.clientY - (r.top + r.height / 2)) * strength
      setT({ x, y })
    },
    [strength],
  )

  const onLeave = useCallback(() => setT({ x: 0, y: 0 }), [])

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn("inline-block will-change-transform", className)}
      style={{
        transform: `translate(${t.x}px, ${t.y}px)`,
        transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {children}
    </div>
  )
}

/* ─── living background ─────────────────────────────────── */

function LivingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: -9999, y: -9999 })
  const raf = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number }
    let particles: P[] = []

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.min(48, Math.floor((w * h) / 28000))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 0.6 + Math.random() * 1.4,
        a: 0.08 + Math.random() * 0.18,
      }))
    }

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY }
    }
    const onLeave = () => {
      mouse.current = { x: -9999, y: -9999 }
    }

    const tick = () => {
      ctx.clearRect(0, 0, w, h)

      const { x: mx, y: my } = mouse.current
      if (mx > -100) {
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 380)
        g.addColorStop(0, "rgba(91,141,239,0.11)")
        g.addColorStop(0.45, "rgba(91,141,239,0.03)")
        g.addColorStop(1, "transparent")
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }

      for (const p of particles) {
        if (mx > -100) {
          const dx = mx - p.x
          const dy = my - p.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist < 280) {
            p.vx += (dx / dist) * 0.008
            p.vy += (dy / dist) * 0.008
          }
        }

        p.vx *= 0.99
        p.vy *= 0.99
        p.x += p.vx
        p.y += p.vy

        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200,210,255,${p.a})`
        ctx.fill()
      }

      if (mx > -100) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i]
            const b = particles[j]
            const dx = a.x - b.x
            const dy = a.y - b.y
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < 90) {
              const midX = (a.x + b.x) / 2
              const midY = (a.y + b.y) / 2
              const toMouse = Math.sqrt((midX - mx) ** 2 + (midY - my) ** 2)
              if (toMouse < 200) {
                ctx.beginPath()
                ctx.moveTo(a.x, a.y)
                ctx.lineTo(b.x, b.y)
                ctx.strokeStyle = `rgba(140,170,255,${0.06 * (1 - d / 90)})`
                ctx.stroke()
              }
            }
          }
        }
      }

      raf.current = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener("resize", resize)
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseleave", onLeave)
    raf.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf.current)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseleave", onLeave)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div className="absolute inset-0 bg-[#060607]" />
      <div
        className="absolute -left-24 top-0 h-[55vh] w-[50vw] opacity-40 blur-[110px]"
        style={{
          background: "radial-gradient(circle, rgba(91,141,239,0.4), transparent 70%)",
        }}
      />
      <div
        className="absolute -right-16 top-[30%] h-[45vh] w-[40vw] opacity-25 blur-[130px]"
        style={{
          background: "radial-gradient(circle, rgba(139,120,255,0.35), transparent 70%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOcta[...]
        }}
      />
    </div>
  )
}

/* ─── interactive product mock ──────────────────────────── */

function InteractiveMock() {
  const [tab, setTab] = useState<"coloop" | "duel" | "circle">("coloop")
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    setTilt({ x: (py - 0.5) * -10, y: (px - 0.5) * 12 })
  }, [])

  const onLeave = useCallback(() => setTilt({ x: 0, y: 0 }), [])

  const tabs = useMemo(
    () =>
      [
        { id: "coloop" as const, label: "Co-Loop" },
        { id: "duel" as const, label: "Duel" },
        { id: "circle" as const, label: "Circle" },
      ] as const,
    [],
  )

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative will-change-transform"
      style={{
        transform: `perspective(1100px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: "transform 0.15s ease-out",
      }}
    >
      <div
        className="pointer-events-none absolute -bottom-12 left-1/2 h-28 w-[90%] -translate-x-1/2 rounded-[100%] bg-[#5b8def]/30 blur-3xl"
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#0a0a0d] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95),0_0_60px_-20px_rgba(91,141,239,0.25)]">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
          </div>
          <div className="mx-auto flex gap-1 rounded-lg bg-white/[0.04] p-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
                  tab === t.id
                    ? "bg-white/[0.1] text-white"
                    : "text-white/35 hover:text-white/60",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[280px] p-4 sm:p-5">
          {tab === "coloop" && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="rounded-xl border border-white/[0.07] bg-[#111114] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {["#4ade80", "#60a5fa", "#f472b6", "#fbbf24"].map((c, i) => (
                        <div
                          key={i}
                          className="h-6 w-6 rounded-full ring-2 ring-[#111114]"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <span className="text-[12px] text-white/50">4 writing</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    Live
                  </span>
                </div>
                <div className="space-y-2 font-mono text-[12px] leading-relaxed text-white/55">
                  <p>
                    <span className="text-sky-400/90">@kai</span> badge unlock after 3 wins,
                    not 10
                  </p>
                  <p>
                    <span className="text-pink-400/90">@mira</span> + show streak on profile
                  </p>
                  <p className="text-white/20">_</p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-white/50 to-white/25" />
                  </div>
                  <span className="text-[10px] tabular-nums text-white/30">72%</span>
                </div>
              </div>
              <p className="text-center text-[11px] text-white/25">
                Real cursors · shared publish · attribution for everyone
              </p>
            </div>
          )}

          {tab === "duel" && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="rounded-xl border border-white/[0.07] bg-[#111114] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15">
                    <Swords className="h-4 w-4 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-white/90">
                      Is mobile-first killing longform?
                    </p>
                    <p className="text-[11px] text-white/35">214 votes · ends in 2h</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full w-[58%] rounded-full bg-sky-400/70" />
                    </div>
                    <span className="w-8 text-right text-[11px] tabular-nums text-white/40">
                      58%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full w-[42%] rounded-full bg-rose-400/70" />
                    </div>
                    <span className="w-8 text-right text-[11px] tabular-nums text-white/40">
                      42%
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/[0.08]"
                  >
                    Stake 50c · Yes
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/[0.08]"
                  >
                    Stake 50c · No
                  </button>
                </div>
              </div>
              <p className="text-center text-[11px] text-white/25">
                Stake coins · make the case · crowd decides
              </p>
            </div>
          )}

          {tab === "circle" && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <div className="rounded-xl border border-white/[0.07] bg-[#111114] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-white/90">#builders</p>
                    <p className="text-[11px] text-white/35">1,204 members · 47 online</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    Live chat
                  </span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { u: "Nova", m: "shipped the invite flow — lmk if broken" },
                    { u: "Rex", m: "anyone free for a co-loop on the docs?" },
                    { u: "Ash", m: "duel idea: tabs vs spaces 👀" },
                  ].map(({ u, m }) => (
                    <div key={u} className="flex gap-2">
                      <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600" />
                      <div>
                        <span className="text-[12px] font-medium text-white/70">{u}</span>
                        <p className="text-[12px] leading-snug text-white/45">{m}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-center text-[11px] text-white/25">
                Roles · events · moderation that scales
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── unforgettable moment ──────────────────────────────── */

function SignatureMoment() {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 50, y: 40 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      setPos({
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      })
    }
    el.addEventListener("mousemove", onMove)
    return () => el.removeEventListener("mousemove", onMove)
  }, [])

  return (
    <section className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div
            ref={ref}
            className="relative overflow-hidden rounded-[28px] border border-white/[0.1] px-6 py-20 text-center sm:px-12 sm:py-28"
            style={{
              background: `
                radial-gradient(ellipse 90% 70% at ${pos.x}% ${pos.y}%, rgba(91,141,239,0.22), transparent 55%),
                linear-gradient(180deg, #0c0c10 0%, #08080a 100%)
              `,
            }}
          >
            <div
              className="pointer-events-none absolute left-[12%] top-[20%] h-32 w-32 rounded-full opacity-40 blur-3xl"
              style={{ background: "rgba(91,141,239,0.5)" }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute bottom-[15%] right-[15%] h-40 w-40 rounded-full opacity-30 blur-3xl"
              style={{ background: "rgba(167,139,250,0.45)" }}
              aria-hidden
            />

            <p className="relative text-[13px] font-medium tracking-wide text-white/40">
              The whole idea
            </p>
            <h2 className="relative mx-auto mt-5 max-w-2xl text-[clamp(2rem,5.5vw,3.75rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-white">
              Creation was never
              <br />
              meant to be lonely.
            </h2>
            <p className="relative mx-auto mt-6 max-w-md text-[16px] leading-relaxed text-white/45">
              Co-write. Duel. Build rooms. Get paid.
              <br className="hidden sm:block" />
              Loop is social software for people who make things.
            </p>

            <div className="relative mt-10 flex flex-wrap items-center justify-center gap-3">
              <Magnetic strength={0.4}>
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-white px-8 text-[14px] font-semibold text-black shadow-[0_0_40px_-8px_rgba(255,255,255,0.5)] hover:bg-white/90"
                  >
                    Start free
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
              </Magnetic>
              <Magnetic strength={0.3}>
                <Link href="/download">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-12 rounded-full border border-white/10 px-6 text-[14px] text-white/60 hover:bg-white/[0.05] hover:text-white"
                  >
                    <Smartphone className="mr-1.5 h-4 w-4" />
                    Get the app
                  </Button>
                </Link>
              </Magnetic>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── page ──────────────────────────────────────────────── */

export function LandingContent() {
  const [stats, setStats] = useState<{
    total_users: number
    total_loops: number
    total_circles: number
    total_duels: number
  } | null>(null)
  const [heroIn, setHeroIn] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setHeroIn(true))
    return () => cancelAnimationFrame(t)
  }, [])

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.success !== false) {
          setStats({
            total_users: Number(d.total_users || 0),
            total_loops: Number(d.total_loops || 0),
            total_circles: Number(d.total_circles || 0),
            total_duels: Number(d.total_duels || 0),
          })
        }
      })
      .catch(() => {})
  }, [])

  const features = [
    {
      tag: "Co-Loop",
      title: "Write with people in the room",
      body: "Up to four of you, same draft, live cursors. Publish once — everyone gets credit.",
    },
    {
      tag: "Duels",
      title: "Argue. Stake. Get judged.",
      body: "Put coins on the line, make the case, let the crowd decide. No vague quote-tweets.",
    },
    {
      tag: "Circles",
      title: "Rooms that actually run",
      body: "Chat, roles, events, moderation. Built for communities that outgrow group chats.",
    },
    {
      tag: "Coins",
      title: "Earn without the middleman tax",
      body: "Gifts, boosts, cash-outs via Stripe. Your work, your money — from day one.",
    },
  ]

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#060607] text-white">
      <LivingBackground />

      <header className="relative z-40 border-b border-white/[0.05] bg-[#060607]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <AppLogo className="h-7 w-7 rounded-lg" />
            <span className="text-[14px] font-semibold tracking-tight">loopapp.me</span>
          </Link>
          <nav className="hidden items-center gap-8 text-[13px] text-white/40 md:flex">
            <a href="#features" className="transition-colors hover:text-white">
              Product
            </a>
            <a href="#money" className="transition-colors hover:text-white">
              Creators
            </a>
            <a href="#moment" className="transition-colors hover:text-white">
              Why Loop
            </a>
            <Link href="/download" className="transition-colors hover:text-white">
              App
            </Link>
          </nav>
          <div className="flex items-center gap-1.5">
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[13px] text-white/50 hover:bg-white/[0.05] hover:text-white"
              >
                Log in
              </Button>
            </Link>
            <Magnetic strength={0.45}>
              <Link href="/signup">
                <Button
                  size="sm"
                  className="h-8 rounded-full bg-white px-3.5 text-[13px] font-semibold text-black hover:bg-white/90"
                >
                  Sign up
                </Button>
              </Link>
            </Magnetic>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-20 sm:px-8 sm:pt-28 lg:pb-28 lg:pt-32">
          <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div>
              <p
                className={cn(
                  "mb-6 text-[13px] font-medium text-white/40 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  heroIn ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
                )}
              >
                Social for people who make things
              </p>
              <h1
                className={cn(
                  "max-w-[12ch] text-[clamp(2.75rem,7vw,4.25rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-white transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  heroIn ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0",
                )}
                style={{ transitionDelay: "80ms" }}
              >
                Stop posting into silence.
              </h1>
              <p
                className={cn(
                  "mt-7 max-w-md text-[17px] leading-relaxed text-white/45 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  heroIn ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
                )}
                style={{ transitionDelay: "160ms" }}
              >
                Co-write live. Settle debates in public. Build circles that work.
                Creation was never meant to be a solo act.
              </p>
              <div
                className={cn(
                  "mt-10 flex flex-wrap items-center gap-3 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  heroIn ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
                )}
                style={{ transitionDelay: "240ms" }}
              >
                <Magnetic strength={0.4}>
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="h-12 rounded-full bg-white px-7 text-[14px] font-semibold text-black shadow-[0_0_48px_-10px_rgba(255,255,255,0.55)] hover:bg-white/90"
                    >
                      Get started free
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                </Magnetic>
                <Magnetic strength={0.3}>
                  <Link href="/download">
                    <Button
                      size="lg"
                      variant="ghost"
                      className="h-12 rounded-full px-5 text-[14px] text-white/55 hover:bg-white/[0.05] hover:text-white"
                    >
                      <Smartphone className="mr-1.5 h-4 w-4" />
                      Get the app
                    </Button>
                  </Link>
                </Magnetic>
              </div>
              <p
                className={cn(
                  "mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/30 transition-all duration-1000",
                  heroIn ? "opacity-100" : "opacity-0",
                )}
                style={{ transitionDelay: "320ms" }}
              >
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3 text-white/40" /> No waitlist
                </span>
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3 text-white/40" /> Free to start
                </span>
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3 text-white/40" /> You keep your content
                </span>
              </p>
            </div>

            <div
              className={cn(
                "hidden transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] lg:block",
                heroIn ? "translate-y-0 opacity-100 scale-100" : "translate-y-16 opacity-0 scale-[0.96]",
              )}
              style={{ transitionDelay: "200ms" }}
            >
              <InteractiveMock />
            </div>
          </div>
        </section>

        {stats &&
          (stats.total_loops > 0 ||
            stats.total_users > 0 ||
            stats.total_circles > 0 ||
            stats.total_duels > 0) && (
            <Reveal>
              <section className="border-y border-white/[0.05]">
                <div className="mx-auto grid max-w-6xl grid-cols-2 sm:grid-cols-4">
                  {[
                    { v: stats.total_loops, l: "Loops" },
                    { v: stats.total_users, l: "People" },
                    { v: stats.total_circles, l: "Circles" },
                    { v: stats.total_duels, l: "Duels" },
                  ]
                    .filter(({ v }) => v > 0)
                    .map(({ v, l }) => (
                      <div
                        key={l}
                        className="flex flex-col items-center justify-center py-9 sm:py-11"
                      >
                        <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
                          {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString()}
                        </span>
                        <span className="mt-1 text-[12px] text-white/35">{l}</span>
                      </div>
                    ))}
                </div>
              </section>
            </Reveal>
          )}

        <section id="features" className="scroll-mt-20 py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <p className="text-[13px] font-medium text-white/35">What you get</p>
              <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Not another infinite feed.
              </h2>
            </Reveal>

            <div className="mt-16 divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {features.map(({ tag, title, body }, i) => (
                <Reveal key={tag} delay={i * 60}>
                  <div className="grid gap-4 py-10 sm:grid-cols-[140px_1fr] sm:gap-10 lg:grid-cols-[160px_1fr_1.2fr] lg:items-baseline">
                    <span className="text-[13px] font-medium uppercase tracking-wider text-white/30">
                      {tag}
                    </span>
                    <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
                      {title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-white/40 lg:pl-4">
                      {body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={80}>
              <div className="mt-10 flex flex-wrap gap-2">
                {[
                  { icon: Trophy, label: "Quests & rewards" },
                  { icon: Play, label: "Reels & Trees" },
                  { icon: Coins, label: "Boosts" },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.02] px-3.5 py-1.5 text-[13px] text-white/45"
                  >
                    <Icon className="h-3.5 w-3.5 text-white/30" />
                    {label}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section
          id="money"
          className="scroll-mt-20 border-y border-white/[0.05] bg-white/[0.015] py-24 sm:py-32"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
              <Reveal>
                <p className="text-[13px] font-medium text-white/35">Creator Studio</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                  Get paid for the work.
                </h2>
                <p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/40">
                  Fans gift with real money. You boost the posts that matter. Cash out
                  when you want — Stripe handles the rest.
                </p>
                <ul className="mt-8 space-y-3">
                  {[
                    "Stripe payouts, not IOUs",
                    "Boost into discovery without ads",
                    "Gift economy that rewards craft",
                    "You own everything you post",
                  ].map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2.5 text-[14px] text-white/55"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                      {line}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="mt-9 inline-flex">
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white/80 transition-colors hover:text-white">
                    Open Creator Studio
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </Reveal>

              <Reveal delay={100}>
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c0f] p-6 sm:p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="text-[13px] text-white/40">This month</span>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                      Live
                    </span>
                  </div>
                  <p className="text-4xl font-semibold tracking-tight tabular-nums">$2,340</p>
                  <p className="mt-1 text-[13px] text-white/35">earned from gifts & boosts</p>
                  <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-6">
                    {[
                      { v: "1.8k", l: "Followers" },
                      { v: "127", l: "Loops" },
                      { v: "89", l: "Gifts" },
                    ].map(({ v, l }) => (
                      <div key={l}>
                        <p className="text-lg font-semibold tabular-nums">{v}</p>
                        <p className="text-[12px] text-white/30">{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <div id="moment" className="scroll-mt-20">
          <SignatureMoment />
        </div>

        <section className="border-t border-white/[0.05] py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <p className="text-[13px] font-medium text-white/35">Getting in</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Three moves.
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-8">
              {[
                {
                  n: "1",
                  t: "Claim a handle",
                  b: "Sign up, pick a name, set the tone. Takes under a minute.",
                },
                {
                  n: "2",
                  t: "Find your people",
                  b: "Join a Circle, start a Co-Loop, or throw down a Duel.",
                },
                {
                  n: "3",
                  t: "Keep what you make",
                  b: "Earn, cash out, export. Nothing locked behind our walls.",
                },
              ].map(({ n, t, b }, i) => (
                <Reveal key={n} delay={i * 70}>
                  <div>
                    <span className="text-[13px] font-medium text-white/25">{n}</span>
                    <h3 className="mt-3 text-lg font-semibold tracking-tight">{t}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-white/40">{b}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-28 sm:pb-36">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] px-8 py-16 text-center sm:px-16 sm:py-20">
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 80% at 50% 0%, rgba(91,141,239,0.14), transparent 60%)",
                  }}
                  aria-hidden
                />
                <h2 className="relative mx-auto max-w-lg text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                  Ready when you are.
                </h2>
                <p className="relative mx-auto mt-4 max-w-sm text-[15px] text-white/40">
                  Free to join. No algorithm deciding you&apos;re invisible.
                </p>
                <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
                  <Magnetic strength={0.4}>
                    <Link href="/signup">
                      <Button
                        size="lg"
                        className="h-12 rounded-full bg-white px-7 text-[14px] font-semibold text-black hover:bg-white/90"
                      >
                        Get started free
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </Link>
                  </Magnetic>
                  <Magnetic strength={0.3}>
                    <Link href="/download">
                      <Button
                        size="lg"
                        variant="ghost"
                        className="h-12 rounded-full px-5 text-[14px] text-white/50 hover:bg-white/[0.05] hover:text-white"
                      >
                        Download the app
                      </Button>
                    </Link>
                  </Magnetic>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.05] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2">
            <AppLogo className="h-5 w-5 rounded-md opacity-70" />
            <span className="text-[13px] text-white/30">loopapp.me</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-white/30">
            <a href="#features" className="hover:text-white/55">
              Product
            </a>
            <a href="#money" className="hover:text-white/55">
              Creators
            </a>
            <a href="#moment" className="hover:text-white/55">
              Why Loop
            </a>
            <Link href="/status" className="hover:text-white/55">
              Status
            </Link>
            <Link href="/download" className="hover:text-white/55">
              Download
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
