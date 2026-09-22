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
  Trophy,
  Play,
  Smartphone,
  Sparkles,
  Layers,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { AppLogo } from "@/components/brand/app-logo"

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
      setStyle({
        transform: `perspective(900px) rotateX(${(0.5 - y) * intensity}deg) rotateY(${(x - 0.5) * intensity}deg)`,
        transition: "transform 0.08s ease-out",
      })
    },
    [intensity],
  )
  const onLeave = useCallback(() => {
    setStyle({
      transform: "perspective(900px) rotateX(0deg) rotateY(0deg)",
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

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#050508]" />
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
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent)",
        }}
      />
    </div>
  )
}

function ProductStage() {
  return (
    <TiltCard intensity={10} className="relative mx-auto w-full max-w-md">
      <div className="absolute -bottom-8 left-1/2 h-16 w-4/5 -translate-x-1/2 rounded-[100%] bg-violet-500/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c0c10]/90 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_40px_-10px_rgba(99,102,241,0.25)] backdrop-blur-xl">
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
          <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] to-transparent p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {["from-cyan-400 to-blue-500", "from-violet-400 to-purple-500", "from-amber-400 to-orange-500"].map(
                  (g, i) => (
                    <div
                      key={i}
                      className={cn("h-7 w-7 rounded-full bg-gradient-to-br ring-2 ring-[#0c0c10]", g)}
                    />
                  ),
                )}
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
          </div>
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
        </div>
      </div>
    </TiltCard>
  )
}

export function LandingContent() {
  const features = [
    {
      icon: Zap,
      title: "Co-Loop",
      description: "Write, edit, and publish live with up to 4 collaborators. Real cursors, shared attribution.",
      iconBg: "from-cyan-500/25 to-cyan-500/5",
      iconColor: "text-cyan-400",
    },
    {
      icon: Swords,
      title: "Duels",
      description: "Stake coins, make your case, and let the community vote on who makes the better argument.",
      iconBg: "from-rose-500/25 to-rose-500/5",
      iconColor: "text-rose-400",
    },
    {
      icon: Users,
      title: "Circles",
      description: "Build spaces with real-time chat, events, roles, and moderation tools.",
      iconBg: "from-emerald-500/25 to-emerald-500/5",
      iconColor: "text-emerald-400",
    },
    {
      icon: Coins,
      title: "Loop Coins",
      description: "Earn through gifting, boost your best work, and cash out. Stripe-backed from day one.",
      iconBg: "from-amber-500/25 to-amber-500/5",
      iconColor: "text-amber-400",
    },
    {
      icon: Trophy,
      title: "Quests",
      description: "Complete missions, play games, unlock rewards. Earn coins and collect limited items.",
      iconBg: "from-violet-500/25 to-violet-500/5",
      iconColor: "text-violet-400",
    },
    {
      icon: Play,
      title: "Reels & Trees",
      description: "Short-form video with a vertical scroller, reactions, gifts, and Explore.",
      iconBg: "from-fuchsia-500/25 to-fuchsia-500/5",
      iconColor: "text-fuchsia-400",
    },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <AmbientBackground />

      <header className="relative z-30 border-b border-white/[0.06] bg-[#050508]/70 backdrop-blur-2xl">
        <div className="container mx-auto flex items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <AppLogo className="h-8 w-8 rounded-xl transition-transform duration-300 group-hover:scale-110" />
            <span className="text-[15px] font-semibold tracking-tight text-white">loopapp.me</span>
          </Link>
          <nav className="hidden items-center gap-7 text-[13px] text-white/45 md:flex">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#creators" className="transition-colors hover:text-white">
              Creators
            </a>
            <Link href="/download" className="transition-colors hover:text-white">
              Get the app
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-[13px] text-white/55 hover:bg-white/[0.06] hover:text-white">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="sm"
                className="rounded-full bg-white px-4 text-[13px] font-semibold text-black shadow-[0_0_24px_-4px_rgba(255,255,255,0.35)] hover:bg-white/90"
              >
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="container mx-auto px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:pb-28 lg:pt-32">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
            <div className="max-w-xl">
              <Reveal>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
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
                <p className="mt-6 text-[16px] leading-relaxed text-white/45">
                  Co-Loops, Duels, Circles, and coins — social software for people who make things.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="h-12 rounded-full bg-white px-7 text-[14px] font-semibold text-black hover:bg-white/90"
                    >
                      Get started free
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/download">
                    <Button
                      size="lg"
                      variant="ghost"
                      className="h-12 rounded-full border border-white/10 px-6 text-[14px] text-white/65 hover:bg-white/[0.06] hover:text-white"
                    >
                      See what it looks like
                    </Button>
                  </Link>
                </div>
                <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/30">
                  {["No waitlist", "Free to start", "Real product"].map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-400/80" />
                      {t}
                    </span>
                  ))}
                </p>
              </Reveal>
            </div>
            <Reveal delay={120}>
              <ProductStage />
            </Reveal>
          </div>
        </section>

        <section id="features" className="container mx-auto px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <p className="text-center text-[12px] font-medium uppercase tracking-[0.2em] text-white/35">
              What you get
            </p>
            <h2 className="mx-auto mt-3 max-w-lg text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything social software should have been
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
                  <div
                    className={cn(
                      "mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br",
                      f.iconBg,
                    )}
                  >
                    <f.icon className={cn("h-5 w-5", f.iconColor)} />
                  </div>
                  <h3 className="text-[15px] font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/40">{f.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="creators" className="container mx-auto px-5 pb-28 sm:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-br from-white/[0.06] to-transparent px-8 py-16 text-center sm:px-16 sm:py-20">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ready when you are.</h2>
              <p className="mx-auto mt-4 max-w-sm text-[15px] text-white/40">
                Free to join. No algorithm deciding you're invisible.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-white px-7 text-[14px] font-semibold text-black hover:bg-white/90"
                  >
                    Get started free
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/download">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="h-12 rounded-full px-5 text-[14px] text-white/50 hover:bg-white/[0.05] hover:text-white"
                  >
                    Download the app
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.05] py-10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2">
            <AppLogo className="h-5 w-5 rounded-md opacity-70" />
            <span className="text-[13px] text-white/30">loopapp.me</span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-white/30">
            <a href="#features" className="hover:text-white/55">
              Product
            </a>
            <a href="#creators" className="hover:text-white/55">
              Creators
            </a>
            <Link href="/download" className="hover:text-white/55">
              Download
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
