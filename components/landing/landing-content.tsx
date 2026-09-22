"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Users,
  MessageCircle,
  ArrowRight,
  Check,
  Zap,
  Swords,
  Coins,
  BarChart3,
  Trophy,
  Play,
  Smartphone,
  Sparkles,
  Layers,
  Globe2,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { AppLogo } from "@/components/brand/app-logo"

/* ─── Scroll-reveal ─────────────────────────────────────── */

function useReveal(threshold = 0.1) {
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
        "transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]",
        visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-12 opacity-0 scale-[0.98]",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

/* ─── 3D tilt card ──────────────────────────────────────── */

function TiltCard({
  children,
  className,
  intensity = 12,
}: {
  children: React.ReactNode
  className?: string
  intensity?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      const rx = (0.5 - y) * intensity
      const ry = (x - 0.5) * intensity
      setStyle({
        transform: `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`,
        transition: "transform 0.08s ease-out",
      })
    },
    [intensity],
  )

  const onLeave = useCallback(() => {
    setStyle({
      transform: "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)",
      transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
    })
  }, [])

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn("will-change-transform", className)}
      style={style}
    >
      {children}
    </div>
  )
}

/* ─── Ambient background ───────────────────────────────── */

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Deep base */}
      <div className="absolute inset-0 bg-[#050508]" />
      {/* Mesh orbs */}
      <div
        className="absolute -left-1/4 top-0 h-[70vh] w-[70vw] rounded-full opacity-40 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.35) 0%, rgba(56,189,248,0.12) 40%, transparent 70%)",
        }}
      />
      <div
        className="absolute -right-1/4 top-1/3 h-[60vh] w-[55vw] rounded-full opacity-30 blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, rgba(236,72,153,0.25) 0%, rgba(168,85,247,0.15) 45%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[50vh] w-[50vw] rounded-full opacity-25 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.2) 0%, transparent 65%)",
        }}
      />
      {/* Fine grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent)",
        }}
      />
      {/* Noise grain */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}

/* ─── Floating product stage ────────────────────────────── */

function ProductStage() {
  return (
    <TiltCard intensity={10} className="relative mx-auto w-full max-w-md">
      {/* Soft ground shadow */}
      <div className="absolute -bottom-8 left-1/2 h-16 w-4/5 -translate-x-1/2 rounded-[100%] bg-violet-500/20 blur-2xl" />
      {/* Card stack depth */}
      <div className="absolute inset-x-4 top-6 h-full rounded-2xl border border-white/[0.04] bg-white/[0.02] backdrop-blur-sm" style={{ transform: "translateZ(-24px) scale(0.96)" }} />
      <div className="absolute inset-x-2 top-3 h-full rounded-2xl border border-white/[0.06] bg-white/[0.03]" style={{ transform: "translateZ(-12px) scale(0.98)" }} />

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c0c10]/90 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_40px_-10px_rgba(99,102,241,0.25)] backdrop-blur-xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <div className="mx-auto rounded-md bg-white/[0.06] px-3 py-1 text-[10px] tracking-wide text-white/40">
            loopapp.me
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* Live Co-Loop */}
          <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] to-transparent p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {["from-cyan-400 to-blue-500", "from-violet-400 to-purple-500", "from-amber-400 to-orange-500", "from-emerald-400 to-teal-500"].map((g, i) => (
                  <div
                    key={i}
                    className={cn("h-7 w-7 rounded-full bg-gradient-to-br ring-2 ring-[#0c0c10]", g)}
                  />
                ))}
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">
                Co-Loop · 4 live
              </span>
              <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live
              </span>
            </div>
            <div className="space-y-2">
              <div className="h-2.5 w-full rounded-full bg-white/[0.06]" />
              <div className="h-2.5 w-4/5 rounded-full bg-white/[0.06]" />
              <div className="h-2.5 w-3/5 rounded-full bg-white/[0.06]" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
              </div>
              <span className="text-[10px] tabular-nums text-white/35">72%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "147", l: "Posts", c: "text-white" },
              { v: "12", l: "Duels", c: "text-rose-400" },
              { v: "23", l: "Circles", c: "text-violet-400" },
            ].map(({ v, l, c }) => (
              <div
                key={l}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-2.5 text-center"
              >
                <p className={cn("text-lg font-bold tracking-tight", c)}>{v}</p>
                <p className="text-[9px] uppercase tracking-widest text-white/30">{l}</p>
              </div>
            ))}
          </div>

          {/* Chat bubble */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-pink-500 shadow-lg shadow-violet-500/20" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-white/90">Kai</span>
                  <span className="rounded bg-violet-500/25 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-300">
                    Founder
                  </span>
                  <span className="text-[10px] text-white/25">just now</span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                  Just dropped the new badge system in #dev — check it out
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TiltCard>
  )
}

/* ─── Main landing ──────────────────────────────────────── */

export function LandingContent() {
  const [stats, setStats] = useState<{
    total_users: number
    total_loops: number
    total_circles: number
    total_duels: number
  } | null>(null)

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
      icon: Zap,
      title: "Co-Loop",
      description:
        "Write, edit, and publish live with up to 4 collaborators. Real cursors, real-time sync, shared attribution.",
      glow: "group-hover:shadow-cyan-500/20",
      iconBg: "from-cyan-500/25 to-cyan-500/5",
      iconColor: "text-cyan-400",
    },
    {
      icon: Swords,
      title: "Duels",
      description:
        "Stake coins, make your case, and let the community vote on who makes the better argument.",
      glow: "group-hover:shadow-rose-500/20",
      iconBg: "from-rose-500/25 to-rose-500/5",
      iconColor: "text-rose-400",
    },
    {
      icon: Users,
      title: "Circles",
      description:
        "Build spaces around shared interests with real-time chat, events, roles, and moderation tools.",
      glow: "group-hover:shadow-emerald-500/20",
      iconBg: "from-emerald-500/25 to-emerald-500/5",
      iconColor: "text-emerald-400",
    },
    {
      icon: Coins,
      title: "Loop Coins",
      description:
        "Earn through gifting, boost your best work, and cash out real earnings. Stripe-backed from day one.",
      glow: "group-hover:shadow-amber-500/20",
      iconBg: "from-amber-500/25 to-amber-500/5",
      iconColor: "text-amber-400",
    },
    {
      icon: Trophy,
      title: "Quests",
      description:
        "Complete missions, play games, take surveys, and unlock rewards. Earn coins and collect limited items.",
      glow: "group-hover:shadow-violet-500/20",
      iconBg: "from-violet-500/25 to-violet-500/5",
      iconColor: "text-violet-400",
    },
    {
      icon: Play,
      title: "Reels & Trees",
      description:
        "Short-form video with a vertical scroller, reactions, gifts, and a dedicated Explore grid.",
      glow: "group-hover:shadow-fuchsia-500/20",
      iconBg: "from-fuchsia-500/25 to-fuchsia-500/5",
      iconColor: "text-fuchsia-400",
    },
  ]

  const steps = [
    {
      n: "01",
      title: "Create your space",
      body: "Sign up in seconds. Claim your handle, set your vibe, and step into a feed that isn’t owned by an algorithm.",
    },
    {
      n: "02",
      title: "Build with others",
      body: "Co-write posts, join Circles, and settle debates in public Duels. Creation is social by default.",
    },
    {
      n: "03",
      title: "Own what you make",
      body: "Earn Loop Coins, cash out, and keep your content. Your work stays yours — always.",
    },
  ]

  const audiences = [
    {
      icon: Sparkles,
      title: "Creators",
      description:
        "Grow an audience, earn real money, and own every piece of content you put on Loop.",
    },
    {
      icon: MessageCircle,
      title: "Communities",
      description:
        "Moderation tools, roles, events, live chat — everything you need to run a space that actually works.",
    },
    {
      icon: Layers,
      title: "Builders",
      description:
        "Open platform, coming developer API, and a community that cares about how things are built.",
    },
  ]

  const roadmap = [
    {
      icon: Globe2,
      title: "Public developer API",
      description:
        "OAuth apps and API keys so developers can build tools on top of Loop, not just share code inside it.",
    },
    {
      icon: Smartphone,
      title: "Native mobile apps",
      description:
        "Packaged with Capacitor — full-screen, native push, installable from the App Store and Google Play.",
    },
    {
      icon: Users,
      title: "Larger live rooms",
      description:
        "Browser WebRTC works great for smaller audiences. Evaluating dedicated infrastructure to scale up.",
    },
    {
      icon: BarChart3,
      title: "Creator analytics",
      description:
        "Audience breakdowns, retention, per-post earnings history — all in Creator Studio.",
    },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />

      {/* ─── Header ──────────────────────────────────── */}
      <header className="relative z-30 border-b border-white/[0.06] bg-[#050508]/70 backdrop-blur-2xl">
        <div className="container mx-auto flex items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <AppLogo className="h-8 w-8 rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" />
            <span className="text-[15px] font-semibold tracking-tight text-white">
              loopapp.me
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-[13px] text-white/45 md:flex">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#community" className="transition-colors hover:text-white">
              Community
            </a>
            <a href="#creators" className="transition-colors hover:text-white">
              Creators
            </a>
            <a href="#roadmap" className="transition-colors hover:text-white">
              Roadmap
            </a>
            <Link
              href="/download"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <Smartphone className="h-3.5 w-3.5" />
              Get the app
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="text-[13px] text-white/55 hover:bg-white/[0.06] hover:text-white"
              >
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="sm"
                className="rounded-full bg-white px-4 text-[13px] font-semibold text-black shadow-[0_0_24px_-4px_rgba(255,255,255,0.35)] transition-all hover:bg-white/90 hover:shadow-[0_0_32px_-4px_rgba(255,255,255,0.5)]"
              >
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ─── Hero ───────────────────────────────────── */}
        <section className="container mx-auto px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:pb-28 lg:pt-32">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
            <div className="max-w-xl">
              <Reveal>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
                    The social platform for creators
                  </span>
                </div>
                <h1 className="text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.75rem] lg:leading-[1.05]">
                  Build together.
                  <br />
                  <span className="bg-gradient-to-r from-white/50 via-white/35 to-white/20 bg-clip-text text-transparent">
                    Not into the void.
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={100}>
                <p className="mt-6 max-w-lg text-base leading-relaxed text-white/45 sm:text-lg">
                  Co-write posts live with friends, settle debates in public Duels, and build
                  communities that actually work for the people in them. No algorithm deciding
                  what matters — just people building together.
                </p>
              </Reveal>

              <Reveal delay={180}>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="h-12 rounded-full bg-white px-8 text-sm font-semibold text-black shadow-[0_0_40px_-8px_rgba(255,255,255,0.4)] transition-all hover:bg-white/90 hover:shadow-[0_0_48px_-6px_rgba(255,255,255,0.55)]"
                    >
                      Start building free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-full border-white/10 bg-white/[0.02] px-8 text-sm text-white/65 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                    >
                      See what it looks like
                    </Button>
                  </Link>
                </div>
                <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/30">
                  {[
                    "No waitlist",
                    "Free to start"