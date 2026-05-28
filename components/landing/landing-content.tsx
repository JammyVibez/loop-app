"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles,
  Users,
  MessageCircle,
  Zap,
  Crown,
  ArrowRight,
  Check,
  Layers,
  Shield,
  Radio,
  Bot,
  Blocks,
  Palette,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const features = [
  {
    title: "Spatial 3D chrome",
    description:
      "Depth-aware surfaces, glass highlights, and motion that feels tactile—not gimmicky.",
    icon: Sparkles,
    className: "md:col-span-2",
    accent: "from-violet-500/30 to-fuchsia-500/20",
  },
  {
    title: "Tree conversations",
    description: "Branch replies stay readable at scale. Context stays attached to the root.",
    icon: MessageCircle,
    className: "",
    accent: "from-cyan-500/25 to-blue-500/15",
  },
  {
    title: "Circles & roles",
    description: "Communities with clear moderation, events, and voice-ready rooms.",
    icon: Users,
    className: "",
    accent: "from-emerald-500/25 to-teal-500/15",
  },
  {
    title: "Loop economy",
    description: "Earn, gift, and unlock premium flourishes that match your identity.",
    icon: Zap,
    className: "md:col-span-2",
    accent: "from-amber-500/25 to-orange-500/15",
  },
  {
    title: "Premium polish",
    description: "Themes, motion packs, and profile depth for creators who care about craft.",
    icon: Crown,
    className: "",
    accent: "from-rose-500/25 to-purple-500/15",
  },
  {
    title: "Realtime fabric",
    description: "Notifications and feeds tuned for low-latency social moments.",
    icon: Radio,
    className: "",
    accent: "from-indigo-500/25 to-violet-500/15",
  },
  {
    title: "Custom community studio",
    description:
      "Redesign your header, sidebar, chat space, and post forum. Add your own tools, use AI bots, and install premium community design packs from the marketplace.",
    icon: Blocks,
    className: "md:col-span-2",
    accent: "from-pink-500/25 to-purple-500/15",
  },
]

const checklist = [
  "Supabase-backed auth & profiles",
  "Circles, loops, reels, streams",
  "Gamified rewards & shop",
  "Moderation & safety primitives",
  "Custom community builder + bot support",
  "Massive scale architecture",
]

export function LandingContent() {
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

      {/* Orbit accents */}
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] hidden h-px w-px -translate-x-1/2 lg:block"
        aria-hidden
      >
        <div className="landing-orbit-dot absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-cyan-400/80 shadow-[0_0_24px_rgba(34,211,238,0.9)]" />
      </div>

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
                Social OS
              </span>
            </div>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
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
          </nav>
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
                Next-gen platform · cinematic 3D UI
              </Badge>

              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.55rem] lg:leading-[1.05]">
                Build a stunning
                <span className="mt-1 block landing-shimmer-text font-semibold">
                  3D community universe.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Loop gives creators and brands a professional, immersive social experience with
                modern 3D visuals, fluid animation, and a modular community system that can be
                reshaped however they want.
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
                    Start free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#features">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-full border-white/15 bg-white/[0.03] px-8 text-base text-slate-200 backdrop-blur hover:bg-white/10"
                  >
                    Explore product
                  </Button>
                </Link>
              </div>

              <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/[0.06] pt-8 text-sm text-slate-500">
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-white">3D-first</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Experience</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-white">No-code style</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Community customizer</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-white">Massive scale</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Millions of users</p>
                </div>
              </div>
            </div>

            {/* 3D showcase */}
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
                        <Badge className="border-0 bg-white/10 text-[10px] uppercase tracking-widest text-slate-300">
                          Live preview
                        </Badge>
                      </div>

                      <div className="mt-8 flex flex-1 flex-col justify-center gap-4">
                        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-4 shadow-inner backdrop-blur">
                          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                            For you
                          </p>
                          <p className="mt-2 text-lg font-medium text-white sm:text-xl">
                            Loops that feel spatial—not flat.
                          </p>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_20px_rgba(139,92,246,0.6)]" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              Circles
                            </p>
                            <p className="mt-1 text-2xl font-semibold text-white">128</p>
                            <p className="text-[11px] text-emerald-400/90">+12 this week</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              Streak
                            </p>
                            <p className="mt-1 text-2xl font-semibold text-white">14d</p>
                            <p className="text-[11px] text-cyan-400/90">Keep it glowing</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-slate-400">
                        <span className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-violet-300" />
                          Encrypted session
                        </span>
                        <span className="text-slate-500">v0.1 · Loop</span>
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
                    <Palette className="h-3.5 w-3.5 text-fuchsia-200" />
                    Theme marketplace
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-slate-400">
                    Install premium community skins and redesign every layout zone.
                  </p>
                </div>
                <div
                  className="absolute -left-4 bottom-[18%] hidden rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-100 shadow-lg backdrop-blur-md sm:block"
                  style={{ transform: "perspective(900px) rotateY(-10deg) translateZ(30px)" }}
                >
                  <p className="flex items-center gap-2 font-semibold text-cyan-50">
                    <Bot className="h-3.5 w-3.5" />
                    AI bots enabled
                  </p>
                  <p className="mt-1 text-[11px] text-cyan-200/80">
                    Add moderation, support, and engagement bots to any community.
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
                Product surface
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Not just social UI.
                <span className="text-slate-400"> A fully customizable community engine.</span>
              </h2>
              <p className="mt-4 text-slate-400">
                From default templates to premium marketplace designs, every community can customize
                structure, style, and tooling while staying fast, secure, and deeply immersive.
              </p>
            </div>

            <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
              {features.map(({ title, description, icon: Icon, className, accent }) => (
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
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                    <Icon className="h-5 w-5 text-violet-200" />
                  </div>
                  <h3 className="relative mt-5 text-lg font-semibold text-white">{title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-slate-400">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Premium section */}
        <section className="border-t border-white/[0.06] bg-[#030715]/95 py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="border border-amber-400/40 bg-amber-500/10 text-amber-100">
                Premium creators
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Go beyond default with Loop Premium.
              </h2>
              <p className="mt-4 text-slate-400">
                Unlock advanced analytics, exclusive 3D motion packs, premium community layouts, and
                higher limits for events, storage, and automation—while keeping the core experience
                free for your members.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="landing-card-3d relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-amber-500/15 via-[#0b0f1e] to-violet-600/25 p-6 shadow-2xl shadow-black/40 sm:p-7">
                <div className="pointer-events-none absolute -right-28 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-amber-400/50 to-fuchsia-500/40 blur-3xl" />
                <div className="relative flex items-center justify-between gap-4">
                  <div className="text-left">
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-200/90">
                      Loop Premium
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
                      Pro-grade depth for serious communities.
                    </p>
                  </div>
                  <div className="hidden rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-right text-sm text-slate-200 sm:block">
                    <p className="text-xs uppercase tracking-wide text-amber-200/80">
                      Early access
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">Founders pricing</p>
                    <p className="text-[11px] text-amber-100/70">Limited seats available.</p>
                  </div>
                </div>
                <div className="relative mt-6 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Advanced engagement & retention analytics
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Premium 3D motion + transition packs
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Exclusive marketplace layouts and components
                    </li>
                  </ul>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Higher limits for members, events, and media
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Automation, workflows, and advanced roles
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Priority support from the Loop team
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-4 rounded-2xl border border-white/[0.08] bg-[#050818]/90 p-6 text-sm text-slate-300 shadow-xl sm:p-7">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
                  For early builders
                </p>
                <p className="text-base leading-relaxed">
                  We&apos;re actively partnering with early communities, creators, DAOs, and brands
                  to shape the Premium roadmap. If you&apos;re building something ambitious, Loop
                  Premium gives you the polish and headroom to grow.
                </p>
                <p className="text-sm text-slate-400">
                  Tell us what you need and we&apos;ll help you design a space that feels like
                  it&apos;s from the future—while your members still feel right at home.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Auto theme / light & dark */}
        <section className="border-t border-white/[0.06] bg-[#020617] py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div>
                <Badge className="border border-white/10 bg-white/5 text-slate-200">
                  Auto theme · Light & Dark
                </Badge>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Automatically beautiful in light or dark.
                </h2>
                <p className="mt-4 text-slate-400">
                  Loop respects system preferences out of the box, switching between clean white
                  surfaces and cinematic dark mode without extra setup. Your components, layouts,
                  and marketplace themes adapt instantly.
                </p>
                <ul className="mt-6 space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    Auto-detects system light/dark preference for every member.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    Theme-aware components that stay legible and on-brand.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    One-click overrides for creators who want a fixed look.
                  </li>
                </ul>
              </div>

              <div className="landing-card-3d relative mx-auto flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-white/[0.10] bg-[#020617] p-4 shadow-2xl shadow-black/50 sm:p-5">
                <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-slate-50 to-slate-100 p-3 text-slate-900">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                      Light preview
                    </p>
                    <p className="mt-2 text-sm font-semibold">Clean white UI</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Ideal for productivity-focused communities and teams.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.12] bg-gradient-to-br from-slate-900 via-slate-950 to-black p-3 text-slate-100">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                      Dark preview
                    </p>
                    <p className="mt-2 text-sm font-semibold">Cinematic dark UI</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Perfect for creators, gaming, and late-night sessions.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-full border border-white/[0.12] bg-white/5 px-2 py-1 text-xs text-slate-200">
                  <span className="ml-2 text-[11px] uppercase tracking-[0.2em] text-slate-300">
                    Auto theme
                  </span>
                  <div className="flex items-center gap-1 rounded-full bg-black/50 p-1">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-900">
                      System
                    </span>
                    <span className="px-2 py-0.5 text-[11px] text-slate-300">Light</span>
                    <span className="px-2 py-0.5 text-[11px] text-slate-300">Dark</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Early users giveaway */}
        <section className="border-t border-emerald-500/20 bg-gradient-to-r from-emerald-600/15 via-[#030712] to-cyan-600/15 py-10 sm:py-12">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mx-auto flex max-w-4xl flex-col items-start gap-4 rounded-2xl border border-emerald-400/30 bg-black/40 p-5 text-sm text-emerald-50 shadow-xl sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="border border-emerald-400/60 bg-emerald-500/15 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                    Early users giveaway
                  </Badge>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/80">
                    Limited slots
                  </span>
                </div>
                <p className="mt-3 text-base font-semibold text-white sm:text-lg">
                  Be one of the first communities on Loop and unlock founder-only rewards.
                </p>
                <p className="mt-1 text-sm text-emerald-100/80">
                  Early users get access to exclusive 3D themes, bonus credits, and surprise drops
                  for their members as we roll out new features.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                <Link href="/signup">
                  <Button className="w-full rounded-full bg-emerald-400 px-5 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 hover:bg-emerald-300 sm:w-auto">
                    Join early & claim perks
                  </Button>
                </Link>
                <p className="text-[11px] text-emerald-200/80">
                  No credit card required · giveaways reserved for early spaces
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
                Create your space, invite your circle, and run a customizable, bot-powered
                community built to support millions of members without platform fees.
              </p>
              <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="h-12 min-w-[200px] rounded-full bg-white px-8 text-base font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Launch your community
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 min-w-[200px] rounded-full border-white/20 bg-transparent text-white hover:bg-white/10"
                  >
                    Sign in
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] bg-[#030712]/90 py-10 text-center text-sm text-slate-500 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6">
          <p className="font-medium text-slate-400">Loop Social Platform</p>
          <p className="mt-2">&copy; {new Date().getFullYear()} Loop. Crafted for creators.</p>
        </div>
      </footer>
    </div>
  )
}
