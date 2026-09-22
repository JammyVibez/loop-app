"use client"

import { useEffect, useState, useRef, useCallback } from "react"
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

/* ─── hooks ─────────────────────────────────────────────── */

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
      { threshold, rootMargin: "0px 0px -48px 0px" },
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
        "transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        visible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function usePointerGlow() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      el.style.setProperty("--mx", `${e.clientX - r.left}px`)
      el.style.setProperty("--my", `${e.clientY - r.top}px`)
    }
    el.addEventListener("mousemove", onMove)
    return () => el.removeEventListener("mousemove", onMove)
  }, [])

  return ref
}

/* ─── product frame ─────────────────────────────────────── */

function LiveFrame() {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -bottom-10 left-1/2 h-24 w-[85%] -translate-x-1/2 rounded-[100%] bg-[#5b8def]/25 blur-3xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#0b0b0e] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
          </div>
          <div className="mx-auto rounded-md bg-white/[0.04] px-3 py-1 text-[11px] text-white/30">
            loopapp.me
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <div className="rounded-xl border border-white/[0.07] bg-[#111114] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
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
                <span className="text-[12px] text-white/50">Co-Loop · 4 writing</span>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400/90">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Live
              </span>
            </div>
            <div className="space-y-2 font-mono text-[12px] leading-relaxed text-white/55">
              <p>
                <span className="text-sky-400/80">@kai</span> the badge system
                should unlock after 3 duels won, not 10
              </p>
              <p>
                <span className="text-pink-400/80">@mira</span> agree — and show
                the streak on the profile
              </p>
              <p className="text-white/25">|</p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full w-[68%] rounded-full bg-white/40" />
              </div>
              <span className="text-[10px] tabular-nums text-white/30">68%</span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#111114] px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
              <Swords className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white/85">
                Is mobile-first killing longform?
              </p>
              <p className="text-[11px] text-white/35">Duel · 214 votes · ends in 2h</p>
            </div>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/50">
              50c
            </span>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-[#111114] px-4 py-3">
            <div className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-white/90">Kai</span>
                  <span className="text-[10px] text-white/25">now</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-white/50">
                  shipped the badge unlock change — test it in #dev
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
  const glowRef = usePointerGlow()

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
    <div
      ref={glowRef}
      className="relative min-h-screen overflow-x-hidden bg-[#070708] text-white"
      style={
        {
          "--mx": "50%",
          "--my": "20%",
        } as React.CSSProperties
      }
    >
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute inset-0 bg-[#070708]" />
        <div
          className="absolute inset-0 opacity-90 transition-opacity duration-300"
          style={{
            background:
              "radial-gradient(700px circle at var(--mx) var(--my), rgba(91,141,239,0.12), transparent 55%)",
          }}
        />
        <div
          className="absolute -left-32 top-0 h-[50vh] w-[50vw] opacity-30 blur-[100px]"
          style={{
            background: "radial-gradient(circle, rgba(91,141,239,0.35), transparent 70%)",
          }}
        />
        <div
          className="absolute right-0 top-1/3 h-[40vh] w-[40vw] opacity-20 blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(167,139,250,0.3), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <header className="relative z-40 border-b border-white/[0.05] bg-[#070708]/75 backdrop-blur-xl">
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
            <a href="#roadmap" className="transition-colors hover:text-white">
              Roadmap
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
            <Link href="/signup">
              <Button
                size="sm"
                className="h-8 rounded-full bg-white px-3.5 text-[13px] font-semibold text-black hover:bg-white/90"
              >
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24 lg:pb-24 lg:pt-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div>
              <Reveal>
                <p className="mb-5 text-[13px] font-medium text-white/40">
                  Social, for people who actually make things
                </p>
                <h1 className="max-w-[14ch] text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.5rem]">
                  Stop posting into silence.
                </h1>
              </Reveal>
              <Reveal delay={90}>
                <p className="mt-6 max-w-md text-[17px] leading-relaxed text-white/45">
                  Co-write live, settle debates in public, build circles that work.
                  Loop is the place where creation isn&apos;t a solo performance.
                </p>
              </Reveal>
              <Reveal delay={160}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="h-11 rounded-full bg-white px-6 text-[14px] font-semibold text-black hover:bg-white/90"
                    >
                      Get started free
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/download">
                    <Button
                      size="lg"
                      variant="ghost"
                      className="h-11 rounded-full px-5 text-[14px] text-white/55 hover:bg-white/[0.05] hover:text-white"
                    >
                      <Smartphone className="mr-1.5 h-4 w-4" />
                      Get the app
                    </Button>
                  </Link>
                </div>
                <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/30">
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
              </Reveal>
            </div>

            <Reveal delay={120} className="hidden lg:block">
              <LiveFrame />
            </Reveal>
          </div>
        </section>

        {stats &&
          (stats.total_loops > 0 ||
            stats.total_users > 0 ||
            stats.total_circles > 0 ||
            stats.total_duels > 0) && (
            <Reveal>
              <section className="border-y border-white/[0.05]">
                <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px sm:grid-cols-4">
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
                        className="flex flex-col items-center justify-center py-8 sm:py-10"
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
                <Reveal key={tag} delay={i * 50}>
                  <div className="group grid gap-4 py-10 sm:grid-cols-[140px_1fr] sm:gap-10 lg:grid-cols-[160px_1fr_1.2fr] lg:items-baseline">
                    <span className="text-[13px] font-medium uppercase tracking-wider text-white/30">
                      {tag}
                    </span>
                    <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
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
                  Fans gift with real money. You boost the posts that matter.
                  Cash out when you want — Stripe handles the rest.
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
                  <p className="text-4xl font-semibold tracking-tight tabular-nums">
                    $2,340
                  </p>
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

        <section className="py-24 sm:py-32">
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

        <section
          id="roadmap"
          className="scroll-mt-20 border-t border-white/[0.05] py-24 sm:py-32"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <p className="text-[13px] font-medium text-white/35">Coming up</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                On the board.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {[
                {
                  t: "Public API",
                  b: "OAuth apps and keys so you can build on top of Loop, not just inside it.",
                },
                {
                  t: "Native apps",
                  b: "Capacitor builds for App Store and Play — full screen, push, installable.",
                },
                {
                  t: "Bigger rooms",
                  b: "WebRTC is solid for small crowds. Scaling live sessions is next.",
                },
                {
                  t: "Creator analytics",
                  b: "Who stuck around, what paid, what flopped — inside Studio.",
                },
              ].map(({ t, b }, i) => (
                <Reveal key={t} delay={i * 40}>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-5 py-5 transition-colors hover:border-white/[0.1] hover:bg-white/[0.03]">
                    <h3 className="text-[15px] font-semibold">{t}</h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-white/40">{b}</p>
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
                      "radial-gradient(ellipse 80% 80% at 50% 0%, rgba(91,141,239,0.15), transparent 60%)",
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
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="h-11 rounded-full bg-white px-7 text-[14px] font-semibold text-black hover:bg-white/90"
                    >
                      Get started free
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/download">
                    <Button
                      size="lg"
                      variant="ghost"
                      className="h-11 rounded-full px-5 text-[14px] text-white/50 hover:bg-white/[0.05] hover:text-white"
                    >
                      Download the app
                    </Button>
                  </Link>
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
            <a href="#roadmap" className="hover:text-white/55">
              Roadmap
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
