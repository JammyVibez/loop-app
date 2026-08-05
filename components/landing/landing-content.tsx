"use client"

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
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const features = [
  {
    title: "Co-Loop: write together, live",
    description:
      "Invite a friend into a real-time studio and co-author a post together — live cursors, live chat, one shared publish. Nobody else on a social app lets two people write the same post at once.",
    icon: Sparkles,
    className: "md:col-span-2",
    accent: "from-cyan-500/30 to-indigo-500/20",
  },
  {
    title: "Branchable Loops",
    description: "Reply by branching into a new Loop. Context stays attached to the root, so a conversation reads like a tree, not a scroll.",
    icon: GitBranch,
    className: "",
    accent: "from-violet-500/25 to-purple-500/15",
  },
  {
    title: "Circles",
    description: "Public or private communities with real-time chat, events, and roles — private Circles require the owner's approval before you can post.",
    icon: Users,
    className: "",
    accent: "from-emerald-500/25 to-teal-500/15",
  },
  {
    title: "Browser live streaming",
    description: "Go live straight from your browser with camera or screen share, live chat, and gifts — no software to install.",
    icon: Radio,
    className: "md:col-span-2",
    accent: "from-rose-500/25 to-orange-500/15",
  },
  {
    title: "Developer Hub",
    description: "Share code snippets with real syntax highlighting, attach files, and let other developers fork and star your work.",
    icon: Code2,
    className: "",
    accent: "from-blue-500/25 to-cyan-500/15",
  },
  {
    title: "Loop Coins economy",
    description: "Buy coin packs through real Stripe checkout, gift creators for their content, and cash out real earnings — no fake balances.",
    icon: Coins,
    className: "",
    accent: "from-amber-500/25 to-yellow-500/15",
  },
]

const checklist = [
  "Loops, Reels, Circles & live streams",
  "Real-time Co-Loop collaboration",
  "Developer Hub for sharing & forking code",
  "Stripe-backed Loop Coins & creator payouts",
  "Creator Studio with real earnings & analytics",
  "Light & dark mode that syncs everywhere",
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
                Early access · building in public
              </Badge>

              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.55rem] lg:leading-[1.05]">
                Where creators perform
                <span className="mt-1 block landing-shimmer-text font-semibold">
                  and developers build.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Loop is a social platform for people who make things — Loops, Reels, and live streams
                for creators, real-time Co-Loop collaboration for anyone, and a Developer Hub for
                sharing and forking code. Real Loop Coins economy, real Stripe payments, no fake
                numbers.
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
                  <p className="text-xs uppercase tracking-wider text-slate-500">Write together, live</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-white">Real payouts</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Stripe-backed coins</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-white">Open source vibe</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Developer Hub built in</p>
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
                              Two authors, one post
                            </p>
                          </div>
                          <p className="mt-2 text-lg font-medium text-white sm:text-xl">
                            &ldquo;Let's write this together...&rdquo;
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
                            <p className="mt-1 text-2xl font-semibold text-white">Live chat</p>
                            <p className="text-[11px] text-emerald-400/90">+ events, roles</p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                              Developer Hub
                            </p>
                            <p className="mt-1 text-2xl font-semibold text-white">Fork &amp; star</p>
                            <p className="text-[11px] text-cyan-400/90">Real code preview</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-slate-400">
                        <span className="flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />
                          Real Stripe-backed coins
                        </span>
                        <span className="text-slate-500">Loop · early access</span>
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
                    Buy through Stripe, gift creators, cash out real earnings.
                  </p>
                </div>
                <div
                  className="absolute -left-4 bottom-[18%] hidden rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-100 shadow-lg backdrop-blur-md sm:block"
                  style={{ transform: "perspective(900px) rotateY(-10deg) translateZ(30px)" }}
                >
                  <p className="flex items-center gap-2 font-semibold text-cyan-50">
                    <Radio className="h-3.5 w-3.5" />
                    Go live from your browser
                  </p>
                  <p className="mt-1 text-[11px] text-cyan-200/80">
                    Camera, screen share, chat, and gifts — no install needed.
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
                What you can actually do
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Built for making things,
                <span className="text-slate-400"> together or solo.</span>
              </h2>
              <p className="mt-4 text-slate-400">
                Every feature below is live in the product today — no mockups, no &ldquo;coming soon&rdquo;
                badges hiding empty screens.
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
                    Get started free
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
          <p className="font-medium text-slate-400">Loop</p>
          <p className="mt-2">&copy; {new Date().getFullYear()} Loop. Built for creators and developers.</p>
        </div>
      </footer>
    </div>
  )
}
