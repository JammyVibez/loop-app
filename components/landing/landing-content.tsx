"use client"

import { useEffect, useState, useRef } from "react"
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
  Users,
  Smartphone,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { AppLogo } from "@/components/brand/app-logo"

/* ─── Scroll-reveal ─────────────────────────────────────── */

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
      { threshold, rootMargin: "0px 0px -60px 0px" },
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
        "transition-all duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

/* ─── Fake product screenshot (Co-Loop mock) ─────────────── */

function ProductMockup() {
  return (
    <div className="relative">
      {/* Glow behind */}
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-violet-500/8 via-cyan-500/5 to-transparent blur-2xl" aria-hidden />
      <div className="relative rounded-2xl border border-white/[0.08] bg-[#111113] shadow-2xl shadow-black/40 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-white/10" />
            <div className="h-3 w-3 rounded-full bg-white/10" />
            <div className="h-3 w-3 rounded-full bg-white/10" />
          </div>
          <div className="flex-1 mx-8">
            <div className="mx-auto max-w-xs rounded-md bg-white/[0.06] px-3 py-1 text-center text-[11px] text-white/40">
              loopapp.me
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Co-Loop live card */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex -space-x-2">
                {["from-cyan-400 to-blue-500", "from-violet-400 to-purple-500", "from-amber-400 to-orange-500", "from-emerald-400 to-teal-500"].map((g, i) => (
                  <div
                    key={i}
                    className={`h-6 w-6 rounded-full bg-gradient-to-br ${g} ring-2 ring-[#111113]`}
                  />
                ))}
              </div>
              <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
                Co-Loop — 4 collaborators
              </span>
              <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-white/[0.04]" />
              <div className="h-3 w-4/5 rounded bg-white/[0.04]" />
              <div className="h-3 w-3/5 rounded bg-white/[0.04]" />
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <div className="h-1 flex-1 rounded-full bg-white/[0.04]">
                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-cyan-500/60 to-violet-500/60" />
              </div>
              <span className="text-[10px] text-white/30">72%</span>
            </div>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "147", label: "Posts today", color: "text-white" },
              { value: "12", label: "Active Duels", color: "text-rose-400" },
              { value: "23", label: "Circles", color: "text-violet-400" },
            ].map(({ value, label, color }) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Chat bubble preview */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-start gap-2">
              <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-pink-500" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white/80">Kai</span>
                  <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[8px] font-bold text-violet-300">Founder</span>
                  <span className="text-[10px] text-white/20">just now</span>
                </div>
                <p className="text-[13px] text-white/60 mt-1 leading-relaxed">
                  Just dropped the new badge system in #dev — check it out
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main landing component ─────────────────────────────── */

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0c] text-white">
      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
        aria-hidden
      />

      {/* ─── Header ──────────────────────────────────── */}
      <header className="relative z-20 border-b border-white/[0.06] bg-[#0a0a0c]/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <AppLogo className="h-8 w-8 rounded-lg transition-transform duration-200 group-hover:scale-105" />
            <span className="text-[15px] font-semibold tracking-tight text-white">
              loopapp.me
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] text-white/50 md:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#community" className="transition-colors hover:text-white">Community</a>
            <a href="#creators" className="transition-colors hover:text-white">Creators</a>
            <a href="#roadmap" className="transition-colors hover:text-white">Roadmap</a>
            <Link href="/download" className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
              <Smartphone className="h-3.5 w-3.5" />
              Get the app
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-[13px] text-white/60 hover:text-white hover:bg-white/[0.06]">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="rounded-full bg-white px-4 text-[13px] font-semibold text-black hover:bg-white/90 transition-colors">
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ─── Hero ───────────────────────────────────── */}
        <section className="container mx-auto px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:pb-24 lg:pt-28">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-14">
            <div className="max-w-xl">
              <Reveal>
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
                  The social platform for creators
                </p>
                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
                  Build together.
                  <br />
                  <span className="text-white/40">
                    Not just post into the void.
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={80}>
                <p className="mt-6 max-w-lg text-base leading-relaxed text-white/50 sm:text-lg">
                  Co-write posts live with friends, settle debates in public Duels, and build communities that actually work for the people in them. No algorithm deciding what matters. Just people building together.
                </p>
              </Reveal>

              <Reveal delay={160}>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="h-12 rounded-full bg-white px-8 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
                    >
                      Start building free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-full border-white/10 px-8 text-sm text-white/70 hover:bg-white/[0.04] hover:text-white transition-colors"
                    >
                      See what it looks like
                    </Button>
                  </Link>
                </div>
                <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/30">
                  <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500/80" /> No waitlist</span>
                  <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500/80" /> Free to start</span>
                  <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500/80" /> Your content stays yours</span>
                </p>
              </Reveal>
            </div>

            {/* Product mockup */}
            <Reveal delay={100} className="hidden lg:block">
              <ProductMockup />
            </Reveal>
          </div>
        </section>

        {/* ─── Social proof bar ───────────────────────── */}
        {stats && (
          <Reveal>
            <section className="border-y border-white/[0.06] bg-white/[0.015] py-8">
              <div className="container mx-auto px-5 sm:px-8">
                <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                  {[
                    { value: stats.total_loops, label: "Loops posted" },
                    { value: stats.total_users, label: "Creators & builders" },
                    { value: stats.total_circles, label: "Circles created" },
                    { value: stats.total_duels, label: "Duels fought" },
                  ].filter(({ value }) => value > 0).map(({ value, label }) => (
                    <div key={label} className="text-center">
                      <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString()}
                      </p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-widest text-white/30">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </Reveal>
        )}

        {/* ─── Features ───────────────────────────────── */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-28">
          <div className="container mx-auto px-5 sm:px-8">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
                  What makes Loop different
                </p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Not another feed app.
                </h2>
                <p className="mt-3 text-base text-white/40">
                  Built for people who want more than likes and empty replies.
                </p>
              </div>
            </Reveal>

            <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Zap,
                  title: "Co-Loop",
                  description: "Write, edit, and publish live with up to 4 collaborators. Real cursors, real-time sync, shared attribution.",
                  accent: "from-cyan-500/20 to-cyan-500/5",
                  iconColor: "text-cyan-400",
                },
                {
                  icon: Swords,
                  title: "Duels",
                  description: "Stake coins, make your case, and let the community vote on who makes the better argument.",
                  accent: "from-rose-500/20 to-rose-500/5",
                  iconColor: "text-rose-400",
                },
                {
                  icon: Users,
                  title: "Circles",
                  description: "Build spaces around shared interests with real-time chat, events, roles, and moderation tools.",
                  accent: "from-emerald-500/20 to-emerald-500/5",
                  iconColor: "text-emerald-400",
                },
                {
                  icon: Coins,
                  title: "Loop Coins",
                  description: "Earn through gifting, boost your best work, and cash out real earnings. Stripe-backed from day one.",
                  accent: "from-amber-500/20 to-amber-500/5",
                  iconColor: "text-amber-400",
                },
                {
                  icon: Trophy,
                  title: "Quests",
                  description: "Complete missions, play games, take surveys, and unlock rewards. Earn coins and collect limited items.",
                  accent: "from-violet-500/20 to-violet-500/5",
                  iconColor: "text-violet-400",
                },
                {
                  icon: Play,
                  title: "Reels & Trees",
                  description: "Short-form video with a vertical scroller, reactions, gifts, and a dedicated Explore grid.",
                  accent: "from-fuchsia-500/20 to-fuchsia-500/5",
                  iconColor: "text-fuchsia-400",
                },
              ].map(({ icon: Icon, title, description, accent, iconColor }, i) => (
                <Reveal key={title} delay={i * 50}>
                  <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.035]">
                    <div className={cn("inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b", accent)}>
                      <Icon className={cn("h-5 w-5", iconColor)} />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/40">{description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── How it works ──────────────────────────── */}
        <section id="community" className="scroll-mt-20 border-y border-white/[0.06] bg-white/[0.015] py-20 sm:py-28">
          <div className="container mx-auto px-5 sm:px-8">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
                  How it works
                </p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Three steps to start building.
                </h2>
              </div>
            </Reveal>

            <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Join a Circle",
                  description: "Find a community around something you care about. Anime, coding, music, design — or start your own in 30 seconds.",
                },
                {
                  step: "02",
                  title: "Create something",
                  description: "Post a Loop, start a Co-Loop with friends, launch a Duel, or go live in chat. Make it real.",
                },
                {
                  step: "03",
                  title: "Earn and build",
                  description: "Receive gifts, complete quests, grow your reputation. Your content and your earnings belong to you.",
                },
              ].map(({ step, title, description }, i) => (
                <Reveal key={step} delay={i * 80}>
                  <div className="relative text-center">
                    <p className="text-[4rem] font-bold leading-none text-white/[0.06]">{step}</p>
                    <h3 className="relative -mt-4 text-lg font-semibold text-white">{title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-white/40">{description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Creator Studio ─────────────────────────── */}
        <section id="creators" className="scroll-mt-20 py-20 sm:py-28">
          <div className="container mx-auto px-5 sm:px-8">
            <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
              <Reveal>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
                    Creator Studio
                  </p>
                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Your numbers. Your money. One dashboard.
                  </h2>
                  <ul className="mt-8 space-y-4 text-sm text-white/50">
                    {[
                      "Fans gift you through real Stripe-purchased Loop Coins",
                      "Every gift flows into your earnings ledger automatically",
                      "Withdrawal requests reviewed within 48 hours",
                      "Boost your best Loops into more feeds",
                      "Pin your best work to the top of your profile",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500/80" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/earnings"
                    className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-white hover:text-white/80 transition-colors"
                  >
                    See Creator Studio <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={80}>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Total earned", value: "$2,340", sub: "this month" },
                      { label: "Followers", value: "1,892", sub: "+340 this week" },
                      { label: "Loops", value: "127", sub: "4 boosted" },
                      { label: "Gifts received", value: "89", sub: "from 23 people" },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">{label}</p>
                        <p className="mt-1 text-xl font-bold text-white">{value}</p>
                        <p className="mt-0.5 text-[11px] text-white/25">{sub}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Pending withdrawal</p>
                        <p className="mt-1 text-lg font-bold text-white">$420.00</p>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold text-emerald-400 uppercase">
                        Processing
                      </span>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ─── Built for ──────────────────────────────── */}
        <section className="border-y border-white/[0.06] bg-white/[0.015] py-20 sm:py-28">
          <div className="container mx-auto px-5 sm:px-8">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
                  Built for
                </p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  People who make things.
                </h2>
              </div>
            </Reveal>

            <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Users,
                  title: "Creators",
                  description: "Grow an audience, earn real money, and own every piece of content you put on Loop.",
                },
                {
                  icon: MessageCircle,
                  title: "Communities",
                  description: "Moderation tools, roles, events, live chat — everything you need to run a space that actually works.",
                },
                {
                  icon: BarChart3,
                  title: "Builders",
                  description: "Open platform, coming developer API, and a community that cares about how things are built.",
                },
              ].map(({ icon: Icon, title, description }, i) => (
                <Reveal key={title} delay={i * 60}>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
                    <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
                      <Icon className="h-5 w-5 text-white/60" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/40">{description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Roadmap ────────────────────────────────── */}
        <section id="roadmap" className="scroll-mt-20 py-20 sm:py-28">
          <div className="container mx-auto px-5 sm:px-8">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
                  Roadmap
                </p>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  What we're building next.
                </h2>
                <p className="mt-3 text-sm text-white/40">
                  No fake dates. Just what's real.
                </p>
              </div>
            </Reveal>

            <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Public developer API",
                  description: "OAuth apps and API keys so developers can build tools on top of Loop, not just share code inside it.",
                  status: "Planned",
                  statusColor: "bg-violet-500/15 text-violet-400",
                },
                {
                  title: "Native mobile apps",
                  description: "Packaged with Capacitor — full-screen, native push, installable from the App Store and Google Play.",
                  status: "In progress",
                  statusColor: "bg-emerald-500/15 text-emerald-400",
                },
                {
                  title: "Larger live rooms",
                  description: "Browser WebRTC works great for smaller audiences. Evaluating dedicated infrastructure to scale up.",
                  status: "Exploring",
                  statusColor: "bg-amber-500/15 text-amber-400",
                },
                {
                  title: "Creator analytics",
                  description: "Audience breakdowns, retention, per-post earnings history — all in Creator Studio.",
                  status: "In progress",
                  statusColor: "bg-emerald-500/15 text-emerald-400",
                },
              ].map(({ title, description, status, statusColor }, i) => (
                <Reveal key={title} delay={i * 50}>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">{title}</h3>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", statusColor)}>
                        {status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/40">{description}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={200}>
              <p className="mx-auto mt-8 max-w-md text-center text-xs text-white/25">
                Have a feature request? Tell us once you're in — early users shape the roadmap directly.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ─── Final CTA ──────────────────────────────── */}
        <section className="border-t border-white/[0.06] py-20 sm:py-28">
          <div className="container mx-auto px-5 sm:px-8">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  You're invited.
                </h2>
                <p className="mt-4 text-base text-white/40 max-w-md mx-auto">
                  We're still early — and that's the best time to join. Post a Loop, start a Co-Loop with a friend, or just explore. Your feedback shapes what we build next.
                </p>
                <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="h-12 rounded-full bg-white px-8 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
                    >
                      Start building free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-full border-white/10 px-8 text-sm text-white/60 hover:bg-white/[0.04] hover:text-white transition-colors"
                    >
                      Explore first
                    </Button>
                  </Link>
                </div>
                <p className="mt-6 text-xs text-white/20">
                  No credit card. No waitlist. Your content stays yours.
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ─── Footer ──────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.06] py-8">
        <div className="container mx-auto flex flex-col items-center gap-4 px-5 text-[13px] text-white/30 sm:flex-row sm:justify-between sm:px-8">
          <div className="flex items-center gap-2">
            <AppLogo className="h-5 w-5 rounded" />
            <span className="font-medium text-white/50">loopapp.me</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="transition-colors hover:text-white/60">Features</a>
            <a href="#community" className="transition-colors hover:text-white/60">Community</a>
            <a href="#creators" className="transition-colors hover:text-white/60">Creators</a>
            <a href="#roadmap" className="transition-colors hover:text-white/60">Roadmap</a>
            <Link href="/status" className="transition-colors hover:text-white/60">Status</Link>
            <Link href="/download" className="transition-colors hover:text-white/60">Download</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
