"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  MessageCircle,
  ArrowRight,
  Check,
  Layers,
  Radio,
  GitBranch,
  Code2,
  Coins,
  Sparkles,
  Rocket,
  Smartphone,
  BarChart3,
  ShieldCheck,
  Swords,
  TrendingUp,
  Activity,
  Flame,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const features = [
  {
    title: "Co-Loop",
    badge: "Live Collaboration",
    description:
      "Write, edit, and publish live with up to 4 collaborators. Multi-author studios with live cursors, real-time sync, and shared attribution.",
    icon: Sparkles,
    className: "md:col-span-2",
    accent: "from-cyan-500/30 to-indigo-500/20",
  },
  {
    title: "Duels",
    badge: "1v1 Debates",
    description:
      "Stake coins and let the community vote on a winner in public Duels. Settle discussions, compare ideas, and earn rewards.",
    icon: Swords,
    className: "",
    accent: "from-rose-500/25 to-amber-500/15",
  },
  {
    title: "Circles",
    badge: "Custom Spaces",
    description:
      "Join or build communities around your exact interests with real-time chat, events, role management, and dedicated moderation.",
    icon: Users,
    className: "",
    accent: "from-emerald-500/25 to-teal-500/15",
  },
  {
    title: "Loop Coins",
    badge: "Creator Economy",
    description:
      "Earn, gift, and boost content with real Stripe-backed Loop Coins. Cash out earnings or sponsor your favorite creators directly.",
    icon: Coins,
    className: "md:col-span-2",
    accent: "from-amber-500/25 to-yellow-500/15",
  },
]

const checklist = [
  "Co-Loop: live collaboration with up to 4 creators",
  "Public Duels: stake coins & community vote on winners",
  "Circles: build spaces around shared interests",
  "Loop Coins: earn, gift, and boost content",
  "Developer Hub: share, fork & star code",
  "Browser live streaming & real Stripe checkout",
]

const roadmap = [
  {
    title: "Public developer API",
    description: "OAuth apps and API keys so developers can build tools on top of Loop, not just share code inside it.",
    icon: Code2,
    status: "Planned",
  },
  {
    title: "Native mobile apps",
    description: "Loop already installs as a PWA today — dedicated iOS and Android apps are next.",
    icon: Smartphone,
    status: "Planned",
  },
  {
    title: "Bigger live rooms",
    description: "Browser live streaming works great today for smaller audiences; we're evaluating dedicated streaming infrastructure to scale rooms up.",
    icon: Radio,
    status: "Exploring",
  },
  {
    title: "Deeper creator analytics",
    description: "More detail in Creator Studio — audience breakdowns, retention, and per-post earnings history.",
    icon: BarChart3,
    status: "In progress",
  },
]

interface StatsData {
  total_users: number
  total_loops: number
  total_circles: number
  active_co_loops: number
  total_duels: number
  recent_loops: Array<{ id: string; preview: string; author_username?: string }>
  recent_circles: Array<{ id: string; name: string; member_count?: number }>
}

export function LandingContent() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    let mounted = true
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return
        if (data && data.success !== false) {
          setStats({
            total_users: Number(data.total_users || 0),
            total_loops: Number(data.total_loops || 0),
            total_circles: Number(data.total_circles || 0),
            active_co_loops: Number(data.active_co_loops || 0),
            total_duels: Number(data.total_duels || 0),
            recent_loops: Array.isArray(data.recent_loops) ? data.recent_loops : [],
            recent_circles: Array.isArray(data.recent_circles) ? data.recent_circles : [],
          })
        }
      })
      .catch(() => {
        // Fallback gracefully
      })
      .finally(() => {
        if (mounted) setLoadingStats(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100 selection:bg-violet-500/30 selection:text-white">
      {/* Depth field: grid + aurora */}
      <div
        className="landing-grid-bg pointer-events-none absolute inset-0 opacity-[0.45]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b1220] via-transparent to-[#030712]" />
      <div
        className="landing-aurora-blob pointer-events-none absolute -left-1/4 top-[-20%] h-[70vmin] w-[70vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.45),transparent_65%)] blur-3xl"
        aria-hidden
      />
      <div
        className="landing-aurora-blob pointer-events-none absolute -right-1/4 top-[10%] h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.35),transparent_65%)] blur-3xl [animation-delay:-6s]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[-30%] left-1/2 h-[50vmin] w-[90vmin] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.25),transparent_70%)] blur-3xl"
        aria-hidden
      />

      <header className="relative z-20 border-b border-white/[0.06] bg-[#030712]/70 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 p-[1px] shadow-lg shadow-violet-500/25 transition-transform duration-300 group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#0b1220] text-sm font-bold tracking-tight text-white">
                L
              </div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold tracking-tight text-white">Loop</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Creators &amp; Developers
              </span>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#social-proof" className="hover:text-white transition-colors">Live Activity</a>
            <a href="#roadmap" className="hover:text-white transition-colors">What&apos;s coming</a>
            <a href="#creators" className="hover:text-white transition-colors">For creators</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login">
              <Button
                variant="ghost"
                className="text-slate-300 hover:bg-white/5 hover:text-white"
              >
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="relative overflow-hidden rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-5 font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:shadow-violet-500/40">
                <span className="relative z-10">Create account</span>
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity hover:opacity-100" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="container mx-auto px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:pb-28 lg:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
            <div>
              <Badge
                variant="secondary"
                className="mb-6 border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-cyan-200/90 backdrop-blur"
              >
                <Layers className="mr-1.5 h-3.5 w-3.5" />
                Live Collaboration &amp; Community OS
              </Badge>

              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.55rem] lg:leading-[1.05]">
                Build together.
                <span className="mt-1 block landing-shimmer-text font-semibold">
                  Not just post into the void.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Loop is where communities create in real time — co-write posts live with friends,
                settle debates in public Duels, and build spaces that are actually yours.
              </p>

              <ul className="mt-8 space-y-2.5 text-sm text-slate-300">
                {checklist.map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-white px-8 text-base font-semibold text-slate-900 shadow-xl shadow-black/40 transition hover:bg-slate-100"
                  >
                    Join free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-full border-white/15 bg-white/[0.03] px-8 text-base text-slate-200 backdrop-blur hover:bg-white/10"
                  >
                    Explore as guest
                  </Button>
                </Link>
              </div>

              <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/[0.06] pt-8 text-sm text-slate-500">
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-white">Co-Loop</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Up to 4 collaborators</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-white">Public Duels</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Stake coins &amp; vote</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-white">Circles</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Dedicated spaces</p>
                </div>
              </div>
            </div>

            {/* Live preview showcase */}
            <div className="relative mx-auto w-full max-w-lg lg:mx-0 lg:max-w-none">
              <div className="relative aspect-square max-h-[min(520px,78vw)] sm:aspect-[5/4] lg:max-h-[560px]">
                <div
                  className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/[0.12] to-transparent p-px shadow-2xl shadow-violet-900/40"
                  style={{ transform: "perspective(1200px) rotateY(-8deg)" }}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-[#070d18]/90 ring-1 ring-white/[0.08]">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-cyan-500/10" />
                    <div className="landing-hero-3d relative flex h-full flex-col p-6 sm:p-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
                          <div className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                        </div>
                        <Badge className="border-0 bg-cyan-500/20 text-[10px] uppercase tracking-widest text-cyan-200 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Co-Loop live
                        </Badge>
                      </div>

                      <div className="mt-8 flex flex-1 flex-col justify-center gap-4">
                        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-4 shadow-inner backdrop-blur">
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 ring-2 ring-[#070d18]" />
                              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 ring-2 ring-[#070d18]" />
                            </div>
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                              Collaborative post studio
                            </p>
                          </div>
                          <p className="mt-2 text-lg font-medium text-white sm:text-xl">
                            &ldquo;Co-writing live with friends...&rdquo;
                          </p>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_20px_rgba(139,92,246,0.6)]" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              <Swords className="h-3 w-3 text-rose-400" /> Duels
                            </p>
                            <p className="mt-1 text-base sm:text-lg font-semibold text-white">Public debates</p>
                            <p className="text-[11px] text-emerald-400/90">Community votes live</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
                              <Users className="h-3 w-3 text-cyan-400" /> Circles
                            </p>
                            <p className="mt-1 text-base sm:text-lg font-semibold text-white">Your spaces</p>
                            <p className="text-[11px] text-cyan-400/90">Chat, events &amp; roles</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-slate-400">
                        <span className="flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />
                          Real Stripe-backed coins
                        </span>
                        <span className="text-slate-500">Loop · Build together</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating glass chips */}
                <div
                  className="absolute -right-2 top-[12%] hidden max-w-[230px] rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-xs text-slate-200 shadow-xl backdrop-blur-md sm:block lg:-right-6"
                  style={{ transform: "perspective(900px) rotateY(12deg) translateZ(40px)" }}
                >
                  <p className="flex items-center gap-2 font-medium text-white">
                    <Coins className="h-3.5 w-3.5 text-amber-300" />
                    Loop Coins
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-slate-400">
                    Earn, gift creators, boost content, and cash out real earnings.
                  </p>
                </div>
                <div
                  className="absolute -left-4 bottom-[18%] hidden rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-100 shadow-lg backdrop-blur-md sm:block"
                  style={{ transform: "perspective(900px) rotateY(-10deg) translateZ(30px)" }}
                >
                  <p className="flex items-center gap-2 font-semibold text-cyan-50">
                    <Swords className="h-3.5 w-3.5" />
                    Public Duels
                  </p>
                  <p className="mt-1 text-[11px] text-cyan-200/80">
                    Stake coins, make your case, and let voters decide.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features bento */}
        <section id="features" className="scroll-mt-24 border-t border-white/[0.06] bg-[#050a14]/80 py-20 backdrop-blur-sm sm:py-24">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Badge className="border border-white/10 bg-white/5 text-slate-300">
                Core Differentiators
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Created for communities that
                <span className="text-slate-400"> create in real time.</span>
              </h2>
              <p className="mt-4 text-slate-400">
                Four core superpowers built to make social interactions collaborative, meaningful, and rewarding.
              </p>
            </div>

            <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
              {features.map(({ title, badge, description, icon: Icon, className, accent }) => (
                <div
                  key={title}
                  className={cn(
                    "landing-card-3d group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a1020]/90 p-6 shadow-xl shadow-black/30",
                    className,
                  )}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-70",
                      accent,
                    )}
                  />
                  <div className="flex items-center justify-between">
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                      <Icon className="h-5 w-5 text-violet-200" />
                    </div>
                    {badge && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                        {badge}
                      </span>
                    )}
                  </div>
                  <h3 className="relative mt-5 text-xl font-bold text-white">{title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-slate-300">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof Section (Dynamic DB Stats & Live Proof) */}
        <section id="social-proof" className="scroll-mt-24 border-t border-white/[0.06] bg-[#030814] py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="border border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                <Activity className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
                Live Community Activity
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Real people creating on Loop right now.
              </h2>
              <p className="mt-4 text-slate-400">
                Live metrics and active spaces pulled directly from our database.
              </p>
            </div>

            {/* Dynamic Non-Trivial Stats Counters */}
            <div className="mx-auto mt-12 max-w-5xl">
              {loadingStats ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 rounded-2xl border border-white/10 bg-white/5" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  {stats && stats.total_loops > 0 && (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0a1020]/90 p-5 text-center shadow-lg">
                      <p className="text-3xl font-bold text-white sm:text-4xl">
                        {stats.total_loops.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Loops Posted
                      </p>
                    </div>
                  )}

                  {stats && stats.total_circles > 0 && (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0a1020]/90 p-5 text-center shadow-lg">
                      <p className="text-3xl font-bold text-cyan-300 sm:text-4xl">
                        {stats.total_circles.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Circles Created
                      </p>
                    </div>
                  )}

                  {stats && stats.total_users > 0 && (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0a1020]/90 p-5 text-center shadow-lg">
                      <p className="text-3xl font-bold text-violet-300 sm:text-4xl">
                        {stats.total_users.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Creators &amp; Builders
                      </p>
                    </div>
                  )}

                  {stats && stats.total_duels > 0 ? (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0a1020]/90 p-5 text-center shadow-lg">
                      <p className="text-3xl font-bold text-amber-300 sm:text-4xl">
                        {stats.total_duels.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Public Duels
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0a1020]/90 p-5 text-center shadow-lg">
                      <p className="text-3xl font-bold text-amber-300 sm:text-4xl flex items-center justify-center gap-1">
                        <Flame className="h-7 w-7 text-amber-400 inline" /> Real-time
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Live Collaboration
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Qualitative Live Proof Showcase: Real active circles and loops */}
              {stats && (stats.recent_loops.length > 0 || stats.recent_circles.length > 0) && (
                <div className="mt-10 grid gap-6 md:grid-cols-2">
                  {stats.recent_loops.length > 0 && (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#060c1a]/90 p-5 shadow-xl">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <MessageCircle className="h-4 w-4 text-violet-400" /> Recent Public Loops
                        </span>
                        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      </div>
                      <div className="space-y-3">
                        {stats.recent_loops.slice(0, 3).map((loop) => (
                          <div key={loop.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs">
                            <p className="text-slate-200 line-clamp-2">&ldquo;{loop.preview}&rdquo;</p>
                            {loop.author_username && (
                              <p className="mt-1.5 text-[11px] font-semibold text-violet-300">
                                @{loop.author_username}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.recent_circles.length > 0 && (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#060c1a]/90 p-5 shadow-xl">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-cyan-400" /> Active Circles
                        </span>
                        <span className="text-[11px] text-cyan-300 font-medium">Community Spaces</span>
                      </div>
                      <div className="space-y-3">
                        {stats.recent_circles.slice(0, 3).map((circle) => (
                          <div key={circle.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs">
                            <span className="font-semibold text-white truncate max-w-[200px]">{circle.name}</span>
                            {typeof circle.member_count === "number" && (
                              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-300 border border-cyan-500/20">
                                {circle.member_count} member{circle.member_count === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Creator Studio section */}
        <section id="creators" className="scroll-mt-24 border-t border-white/[0.06] bg-[#030715]/95 py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="border border-amber-400/40 bg-amber-500/10 text-amber-100">
                Creator Studio
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                See your performance and money in one place.
              </h2>
              <p className="mt-4 text-slate-400">
                Coin balance, gifts received, top-performing Loops and Reels, live stream peaks, and
                boost spend — all pulled from what actually happened, updated in real time.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="landing-card-3d relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-amber-500/15 via-[#0b0f1e] to-violet-600/25 p-6 shadow-2xl shadow-black/40 sm:p-7">
                <div className="pointer-events-none absolute -right-28 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-amber-400/50 to-fuchsia-500/40 blur-3xl" />
                <div className="relative flex items-center justify-between gap-4">
                  <div className="text-left">
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/90">
                      Real earnings, not vanity numbers
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
                      Gift, earn, and request a real payout.
                    </p>
                  </div>
                </div>
                <div className="relative mt-6 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Fans gift you through real Stripe-purchased Loop Coins
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Every gift flows straight into your earnings ledger
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Withdrawal requests are manually reviewed, not a fake queue
                    </li>
                  </ul>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Boost your best Loops into more feeds
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Pin your best work to the top of your profile
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Referral dashboard shows exactly who you brought in
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-4 rounded-2xl border border-white/[0.08] bg-[#050818]/90 p-6 text-sm text-slate-300 shadow-xl sm:p-7">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
                  Built with early creators
                </p>
                <p className="text-base leading-relaxed">
                  We&apos;re shaping Loop directly with the first wave of creators and developers who
                  join. If something feels missing or broken, tell us — this is genuinely still early,
                  and your feedback shapes what ships next.
                </p>
                <Link href="/earnings" className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-300 hover:underline">
                  See Creator Studio <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* What's coming / roadmap */}
        <section id="roadmap" className="scroll-mt-24 border-t border-white/[0.06] bg-[#020617] py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Badge className="border border-white/10 bg-white/5 text-slate-200">
                <Rocket className="mr-1.5 h-3.5 w-3.5" />
                What&apos;s coming
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Loop is early. Here&apos;s what we&apos;re building next.
              </h2>
              <p className="mt-4 text-slate-400">
                No fake dates, no marketing promises — just an honest look at where we&apos;re headed.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
              {roadmap.map(({ title, description, icon: Icon, status }) => (
                <div
                  key={title}
                  className="landing-card-3d relative rounded-2xl border border-white/[0.08] bg-[#0a1020]/90 p-5 shadow-lg shadow-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
                      <Icon className="h-5 w-5 text-cyan-300" />
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] uppercase tracking-wider",
                        status === "In progress"
                          ? "border-emerald-400/40 text-emerald-300"
                          : status === "Planned"
                            ? "border-violet-400/40 text-violet-300"
                            : "border-slate-400/40 text-slate-300",
                      )}
                    >
                      {status}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{description}</p>
                </div>
              ))}
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
              Have a feature you want to see? Tell us once you&apos;re in — early users shape this
              roadmap directly.
            </p>
          </div>
        </section>

        {/* Early users */}
        <section className="border-t border-emerald-500/20 bg-gradient-to-r from-emerald-600/15 via-[#030712] to-cyan-600/15 py-10 sm:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mx-auto flex max-w-4xl flex-col items-start gap-4 rounded-2xl border border-emerald-400/30 bg-black/40 p-5 text-sm text-emerald-50 shadow-xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="border border-emerald-400/60 bg-emerald-500/15 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                    Early access
                  </Badge>
                </div>
                <p className="mt-3 text-base font-semibold text-white sm:text-lg">
                  Be one of the first creators and developers on Loop.
                </p>
                <p className="mt-1 text-sm text-emerald-100/80">
                  Every new signup starts with Loop Coins to try gifting, boosting, and the shop —
                  invite a friend into a Co-Loop and you both earn more.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                <Link href="/signup">
                  <Button className="w-full rounded-full bg-emerald-400 px-5 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 hover:bg-emerald-300 sm:w-auto">
                    Join Loop free
                  </Button>
                </Link>
                <p className="text-[11px] text-emerald-200/80">
                  No credit card required to sign up
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-20 sm:px-6 sm:py-24">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-600/30 via-[#0c1224] to-cyan-600/25 p-[1px] shadow-2xl shadow-violet-950/50">
            <div className="relative rounded-[2rem] bg-[#070b14]/95 px-6 py-14 text-center sm:px-12 sm:py-16">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.2),transparent_55%)]" />
              <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Ready to step inside the Loop?
              </h2>
              <p className="relative mx-auto mt-4 max-w-xl text-slate-400">
                Post a Loop, invite someone into a Co-Loop, or drop your first project in the
                Developer Hub — see what sticks.
              </p>
              <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="h-12 min-w-[200px] rounded-full bg-white px-8 text-base font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Join free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 min-w-[200px] rounded-full border-white/20 bg-transparent text-white hover:bg-white/10"
                  >
                    Log in
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] bg-[#030712]/90 py-10 text-center text-sm text-slate-500 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6">
          <p className="font-medium text-slate-400">Loop</p>
          <p className="mt-2">&copy; {new Date().getFullYear()} Loop. Built for creators and developers.</p>
        </div>
      </footer>
    </div>
  )
}
