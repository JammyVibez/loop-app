"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Users,
  MessageCircle,
  ArrowRight,
  Check,
  Zap,
  Rocket,
  Coins,
  Swords,
  ShieldCheck,
  BarChart3,
  Smartphone,
  Code2,
  Radio,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { AppDownloadBadges } from "@/components/app-download-badges"

/* ─── Feature definitions ─────────────────────────────── */

const features = [
  {
    title: "Co-Loop",
    description:
      "Write, edit, and publish live with up to 4 collaborators. Real cursors, real-time sync, shared attribution.",
    icon: Zap,
    accent: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
    iconBg: "bg-cyan-500/10",
  },
  {
    title: "Duels",
    description:
      "Stake coins, make your case, and let the community vote on who makes the better argument.",
    icon: Swords,
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    iconBg: "bg-rose-500/10",
  },
  {
    title: "Circles",
    description:
      "Build spaces around shared interests — real-time chat, events, roles, and moderation tools that actually work.",
    icon: Users,
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    iconBg: "bg-emerald-500/10",
  },
  {
    title: "Loop Coins",
    description:
      "Earn through gifting, boost your best work, and cash out real earnings. Stripe-backed from day one.",
    icon: Coins,
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    iconBg: "bg-amber-500/10",
  },
]

const roadmap = [
  {
    title: "Public developer API",
    description:
      "OAuth apps and API keys so developers can build tools on top of Loop, not just share code inside it.",
    icon: Code2,
    status: "Planned" as const,
  },
  {
    title: "Native mobile apps",
    description:
      "Packaged with Capacitor — full-screen, native push, installable from the App Store and Google Play.",
    icon: Smartphone,
    status: "In progress" as const,
  },
  {
    title: "Larger live rooms",
    description:
      "Browser WebRTC works great for smaller audiences. Evaluating dedicated infrastructure to scale up.",
    icon: Radio,
    status: "Exploring" as const,
  },
  {
    title: "Creator analytics",
    description:
      "Audience breakdowns, retention, per-post earnings history — all in Creator Studio.",
    icon: BarChart3,
    status: "In progress" as const,
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

/* ─── Scroll-reveal hook ──────────────────────────────── */

function useReveal() {
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
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return { ref, visible }
}

/* ─── Reveal wrapper component ────────────────────────── */

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
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-6 opacity-0",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

/* ─── Main landing component ──────────────────────────── */

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
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingStats(false)
      })
    return () => { mounted = false }
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Subtle grid texture — no aurora blobs */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
        aria-hidden
      />

      {/* ─── Header ──────────────────────────────────── */}
      <header className="relative z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background text-sm font-bold tracking-tight transition-transform duration-200 group-hover:scale-105">
              L
            </div>
            <span className="text-base font-semibold tracking-tight text-foreground">
              loopapp.me
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground transition-colors duration-150">Features</a>
            <a href="#activity" className="hover:text-foreground transition-colors duration-150">Activity</a>
            <a href="#roadmap" className="hover:text-foreground transition-colors duration-150">Roadmap</a>
            <a href="#creators" className="hover:text-foreground transition-colors duration-150">Creators</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="rounded-full bg-foreground text-background px-4 font-semibold hover:opacity-90 transition-opacity">
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* ─── Hero ───────────────────────────────────── */}
        <section className="container mx-auto px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:pb-24 lg:pt-28">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div>
              <Reveal>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
                  Build together.
                  <br />
                  <span className="text-muted-foreground">
                    Not just post into the void.
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={80}>
                <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Loop is where communities create in real time — co-write posts live
                  with friends, settle debates in public Duels, and build spaces that
                  are actually yours.
                </p>
              </Reveal>

              <Reveal delay={160}>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="h-11 rounded-full bg-foreground px-7 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
                    >
                      Join free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-11 rounded-full border-border px-7 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      Explore as guest
                    </Button>
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={240}>
                <div className="mt-10 flex items-center gap-8 border-t border-border/60 pt-6">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight text-foreground">4</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Live collaborators</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tracking-tight text-foreground">1v1</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Public Duels</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tracking-tight text-foreground">100%</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Creator-owned</p>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={320}>
                <div className="mt-8">
                  <AppDownloadBadges className="justify-start" />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    iOS &amp; Android — coming soon to the App Store and Google Play.
                  </p>
                </div>
              </Reveal>
            </div>

            {/* ─── Product mockup ──────────────────────── */}
            <Reveal delay={120} className="hidden lg:block">
              <div className="relative mt-4">
                <div className="rounded-2xl border border-border bg-card shadow-xl shadow-black/[0.04] dark:shadow-black/40 overflow-hidden">
                  {/* Fake browser chrome */}
                  <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/30 px-4 py-2.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
                    <div className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
                    <div className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
                    <div className="ml-3 flex-1 rounded-md bg-background/60 px-3 py-1 text-[11px] text-muted-foreground">
                      loopapp.me
                    </div>
                  </div>
                  {/* Content area */}
                  <div className="p-5 space-y-3">
                    {/* Co-Loop mock card */}
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex -space-x-1.5">
                          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 ring-2 ring-background" />
                          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 ring-2 ring-background" />
                          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 ring-2 ring-background" />
                        </div>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Co-Loop — 3 collaborators
                        </span>
                        <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        &ldquo;Co-writing a thread about the future of open-source creator
                        tools...&rdquo;
                      </p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-cyan-500 to-violet-500" />
                      </div>
                    </div>

                    {/* Mini stat row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-border bg-background p-2.5 text-center">
                        <p className="text-xs font-semibold text-foreground">12</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Loops today</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-2.5 text-center">
                        <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-300">3</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Active Duels</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-2.5 text-center">
                        <p className="text-xs font-semibold text-violet-600 dark:text-violet-300">8</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Circles</p>
                      </div>
                    </div>

                    {/* Circle preview */}
                    <div className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10">
                          <Users className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-xs font-medium text-foreground">Indie Hackers</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">42 members</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── Features ───────────────────────────────── */}
        <section id="features" className="scroll-mt-20 border-t border-border/60 py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <Reveal>
              <div className="mx-auto max-w-xl text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Four things Loop does that nothing else does.
                </h2>
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  Built for people who want more than likes and replies.
                </p>
              </div>
            </Reveal>

            <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
              {features.map(({ title, description, icon: Icon, accent, iconBg }, i) => (
                <Reveal key={title} delay={i * 60}>
                  <div className="group rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-md hover:shadow-black/[0.02] dark:hover:shadow-black/20 sm:p-6">
                    <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl", iconBg)}>
                      <Icon className={cn("h-5 w-5", accent.replace(/bg-\S+ /, ""))} />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Live activity ──────────────────────────── */}
        <section id="activity" className="scroll-mt-20 border-t border-border/60 bg-muted/20 py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <Reveal>
              <div className="mx-auto max-w-xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Live community
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Real activity, pulled from the database.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  These numbers update every time someone posts, joins, or debates.
                </p>
              </div>
            </Reveal>

            <div className="mx-auto mt-10 max-w-4xl">
              {loadingStats ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-xl border border-border bg-muted/50" />
                  ))}
                </div>
              ) : (
                <Reveal>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {stats && stats.total_loops > 0 && (
                      <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                          {stats.total_loops.toLocaleString()}
                        </p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Loops posted
                        </p>
                      </div>
                    )}
                    {stats && stats.total_circles > 0 && (
                      <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                          {stats.total_circles.toLocaleString()}
                        </p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Circles created
                        </p>
                      </div>
                    )}
                    {stats && stats.total_users > 0 && (
                      <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                          {stats.total_users.toLocaleString()}
                        </p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Creators &amp; builders
                        </p>
                      </div>
                    )}
                    {stats && stats.total_duels > 0 && (
                      <div className="rounded-xl border border-border bg-card p-4 text-center">
                        <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                          {stats.total_duels.toLocaleString()}
                        </p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Public Duels
                        </p>
                      </div>
                    )}
                  </div>
                </Reveal>
              )}

              {stats && (stats.recent_loops.length > 0 || stats.recent_circles.length > 0) && (
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {stats.recent_loops.length > 0 && (
                    <Reveal delay={60}>
                      <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 border-b border-border/60 pb-2.5 mb-3">
                          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Recent Loops
                          </span>
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <div className="space-y-2.5">
                          {stats.recent_loops.slice(0, 3).map((loop) => (
                            <div key={loop.id} className="rounded-lg bg-muted/40 p-2.5">
                              <p className="text-xs text-foreground line-clamp-1">{loop.preview}</p>
                              {loop.author_username && (
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  @{loop.author_username}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </Reveal>
                  )}
                  {stats.recent_circles.length > 0 && (
                    <Reveal delay={120}>
                      <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2 border-b border-border/60 pb-2.5 mb-3">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Active Circles
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {stats.recent_circles.slice(0, 3).map((circle) => (
                            <div key={circle.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5">
                              <span className="text-xs font-medium text-foreground truncate max-w-[180px]">
                                {circle.name}
                              </span>
                              {typeof circle.member_count === "number" && (
                                <span className="text-[10px] text-muted-foreground">
                                  {circle.member_count} member{circle.member_count === 1 ? "" : "s"}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </Reveal>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Creator Studio ─────────────────────────── */}
        <section id="creators" className="scroll-mt-20 border-t border-border/60 py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <Reveal>
                <div className="rounded-2xl border border-border bg-card p-6 sm:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Creator Studio
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Your numbers, your money, one dashboard.
                  </h2>
                  <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                      <span>Fans gift you through real Stripe-purchased Loop Coins</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                      <span>Every gift flows into your earnings ledger automatically</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                      <span>Withdrawal requests are manually reviewed, not a fake queue</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                      <span>Boost your best Loops into more feeds</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                      <span>Pin your best work to the top of your profile</span>
                    </div>
                  </div>
                  <Link
                    href="/earnings"
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
                  >
                    See Creator Studio <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={80}>
                <div className="flex flex-col justify-center rounded-2xl border border-border bg-muted/30 p-6 sm:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Built with early creators
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    We&apos;re shaping Loop with the first wave of creators and developers who
                    join. If something feels off, tell us — this is early, and your feedback
                    directly shapes what ships next.
                  </p>
                  <div className="mt-6 flex items-center gap-6 text-sm">
                    <div>
                      <p className="text-lg font-semibold text-foreground">Open</p>
                      <p className="text-xs text-muted-foreground">No waitlist</p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <p className="text-lg font-semibold text-foreground">Free</p>
                      <p className="text-xs text-muted-foreground">to start</p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <p className="text-lg font-semibold text-foreground">Yours</p>
                      <p className="text-xs text-muted-foreground">your content</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ─── Roadmap ────────────────────────────────── */}
        <section id="roadmap" className="scroll-mt-20 border-t border-border/60 bg-muted/20 py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <Reveal>
              <div className="mx-auto max-w-xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Roadmap
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  What we&apos;re building next.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  No fake dates. Just what&apos;s real.
                </p>
              </div>
            </Reveal>

            <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
              {roadmap.map(({ title, description, icon: Icon, status }, i) => (
                <Reveal key={title} delay={i * 50}>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-medium uppercase tracking-wider",
                          status === "In progress"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : status === "Planned"
                              ? "text-violet-600 dark:text-violet-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {status}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={200}>
              <p className="mx-auto mt-6 max-w-md text-center text-xs text-muted-foreground">
                Have a feature request? Tell us once you&apos;re in — early users shape the
                roadmap directly.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ─── Early access CTA ───────────────────────── */}
        <section className="border-t border-border/60 py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Ready to build something?
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Post a Loop, start a Co-Loop with a friend, or drop your first project
                  in the Developer Hub. See what sticks.
                </p>
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="h-11 rounded-full bg-foreground px-7 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
                    >
                      Join free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-11 rounded-full border-border px-7 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      Log in
                    </Button>
                  </Link>
                </div>
                <div className="mt-6">
                  <AppDownloadBadges />
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ─── Footer ──────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border/60 py-8">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background text-[10px] font-bold">
              L
            </div>
            <span className="font-medium text-foreground">Loop</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="hover:text-foreground transition-colors duration-150">Features</a>
            <a href="#activity" className="hover:text-foreground transition-colors duration-150">Activity</a>
            <a href="#roadmap" className="hover:text-foreground transition-colors duration-150">Roadmap</a>
            <a href="#creators" className="hover:text-foreground transition-colors duration-150">Creators</a>
            <Link href="/status" className="hover:text-foreground transition-colors duration-150">Status</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
