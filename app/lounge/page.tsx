"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DiscordInviteWidget } from "@/components/lounge/discord-invite-widget"
import { UserBadges } from "@/components/user-badge"
import { getDiceBearUrl } from "@/lib/dicebear"
import {
  Lock,
  Zap,
  Users,
  Vote,
  Megaphone,
  Crown,
  Coins,
  LifeBuoy,
  Rocket,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Gift,
  Palette,
} from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"

type PerkCategory = "community" | "economic" | "cosmetic"

const CATEGORY_META: Record<PerkCategory, { label: string; chip: string; iconBg: string }> = {
  community: {
    label: "Community",
    chip: "border-indigo-500/30 bg-indigo-500/10 text-indigo-500",
    iconBg: "bg-indigo-500/10 text-indigo-500",
  },
  economic: {
    label: "Earning power",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    iconBg: "bg-amber-500/10 text-amber-500",
  },
  cosmetic: {
    label: "Identity & looks",
    chip: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-500",
    iconBg: "bg-fuchsia-500/10 text-fuchsia-500",
  },
}

interface Perk {
  icon: typeof Users
  category: PerkCategory
  title: string
  description: string
  featured?: boolean
  tag?: string
}

const PERKS: Perk[] = [
  {
    icon: Users,
    category: "community",
    title: "Founder Q&As",
    description:
      "Monthly live sessions with the loopapp.me team — ask anything about the roadmap and shape what ships next. Past sessions are archived in the Lounge.",
    featured: true,
    tag: "Every month",
  },
  {
    icon: Vote,
    category: "community",
    title: "Priority feature voting",
    description: "Pro members get weighted votes on the features loopapp.me builds next. Your vote counts double.",
  },
  {
    icon: Rocket,
    category: "community",
    title: "Early access builds",
    description: "Try new features, themes, and Co-Loop studio tools weeks before they roll out to everyone.",
  },
  {
    icon: Crown,
    category: "cosmetic",
    title: "Exclusive Pro identity",
    description: "The gold Pro badge, animated avatar frames, premium card effects, and a members-only theme collection.",
  },
  {
    icon: Coins,
    category: "economic",
    title: "Weekly Loop Coin bonus",
    description: "A recurring coin stipend every week, plus bigger rewards in duels, contests, and daily claims.",
  },
  {
    icon: Gift,
    category: "economic",
    title: "Referral rewards",
    description: "Invite a friend and you both earn Loop Coins the moment they join and get active.",
  },
  {
    icon: LifeBuoy,
    category: "community",
    title: "Priority support",
    description: "Your support tickets jump the queue, with a dedicated Pro channel to talk to the team directly.",
  },
]

function ProBadgePreview() {
  const { user } = useAuth()
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative">
        {/* Live rotating gradient ring behind the avatar */}
        <div className="cosmetic-ring-rotate absolute -inset-2 rounded-full bg-gradient-to-tr from-amber-400 via-rose-400 to-fuchsia-500 opacity-80" />
        <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-amber-300/70 bg-gradient-to-br from-amber-200 via-orange-100 to-rose-200 shadow-xl shadow-amber-500/20">
          <img src={user?.avatar_url || getDiceBearUrl(user?.username || user?.id)} alt="" className={`h-full w-full object-cover ${!user?.avatar_url ? "animate-[dicebear-breathe_3s_ease-in-out_infinite]" : ""}`} />
        </div>
        <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-amber-500/30">
          <Crown className="h-4 w-4 text-white" />
        </span>
      </div>
      <div className="space-y-1.5 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="text-lg font-bold">{user?.display_name || user?.username || "Your name"}</span>
          <UserBadges
            is_premium
            is_verified={user?.is_verified}
            is_sponsor={user?.is_sponsor}
            is_team_member={user?.is_team_member}
            username={user?.username}
            size="sm"
          />
        </div>
        <p className="text-sm text-muted-foreground">Your gold Pro badge, live — exactly what followers see.</p>
        <div className="flex items-center gap-2 text-xs text-fuchsia-400">
          <Zap className="h-3.5 w-3.5" />
          Animated avatar frames, glow, and premium card effects included
        </div>
      </div>
    </div>
  )
}

export default function LoungePage() {
  const { user, loading, refreshUser } = useAuth()
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [checkoutBanner, setCheckoutBanner] = useState<"success" | "cancelled" | null>(null)

  // Stripe Pro checkout redirects back here (?checkout=success|cancelled)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get("checkout")
    if (status === "success" || status === "cancelled") {
      setCheckoutBanner(status)
      window.history.replaceState({}, "", window.location.pathname)
      if (status === "success") {
        // Pro grant lands via the Stripe webhook — refresh so the badge shows up
        window.setTimeout(() => void refreshUser?.(), 2000)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!user?.is_premium && !user?.is_admin) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/lounge")
        const data = await res.json().catch(() => ({}))
        if (!cancelled && data.announcement) setAnnouncement(data.announcement)
      } catch {
        /* soft-fail */
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user?.is_premium, user?.is_admin])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (checkoutBanner) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto max-w-lg px-4 py-16 text-center">
          <div
            className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${
              checkoutBanner === "success" ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"
            }`}
          >
            {checkoutBanner === "success" ? <Crown className="h-8 w-8" /> : <Lock className="h-8 w-8" />}
          </div>
          <h1 className="text-2xl font-bold">
            {checkoutBanner === "success" ? "Payment received! 🎉" : "Checkout cancelled"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {checkoutBanner === "success"
              ? "Your Loop Pro membership is being activated — this usually takes a few seconds. Welcome aboard!"
              : "No charge was made. You can upgrade anytime from the Premium page."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              <Link href="/lounge">Enter the Lounge</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/premium">Back to Pro</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!user?.is_premium) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">The Pro Lounge is Pro-only</h1>
          <p className="mt-2 text-muted-foreground">
            Upgrade to Loop Pro to unlock the Lounge, the private Discord invite, and every other Pro perk.
          </p>
          <Button asChild className="mt-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white">
            <Link href="/premium">
              <Zap className="mr-2 h-4 w-4" /> Get Loop Pro
            </Link>
          </Button>
        </main>
      </div>
    )
  }

  const expiresAt = user.premium_expires_at ? new Date(user.premium_expires_at) : null
  const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : false
  const isLifetime = !expiresAt

  // Renewal progress: show how much of the current billing window is used
  const renewalProgress = (() => {
    if (!expiresAt || isExpired) return null
    const start = expiresAt.getTime() - 30 * 24 * 60 * 60 * 1000
    const total = Math.max(1, expiresAt.getTime() - start)
    const used = Math.min(total, Math.max(0, Date.now() - start))
    return { pct: Math.round((used / total) * 100), daysLeft: Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)) }
  })()

  const featuredPerks = PERKS.filter((p) => p.featured)
  const compactPerks = PERKS.filter((p) => !p.featured)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-4xl space-y-8 px-4 py-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-orange-600/10 p-6 sm:p-8">
          <div className="relative space-y-4">
            <Badge className="rounded-full bg-indigo-500/15 text-indigo-500">
              <Crown className="mr-1 h-3 w-3" /> Invite Only · Loop Pro
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome to the{" "}
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
                Pro Lounge
              </span>
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              A private space for Loop Pro members and the dev team. Get early access, vote on the roadmap, and hang
              out with the people building loopapp.me.
            </p>

            {announcement && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <p className="text-sm font-medium">{announcement}</p>
              </div>
            )}
          </div>
        </div>

        <DiscordInviteWidget />

        {/* Pro status + renewal progress */}
        <Card className="overflow-hidden border-indigo-500/20">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-amber-500/20">
                  <BadgeCheck className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-semibold">Your Pro membership is active</p>
                  <p className="text-sm text-muted-foreground">
                    {isLifetime
                      ? "Lifetime Pro — thank you for supporting loopapp.me! 🎉"
                      : isExpired
                        ? "Your membership has expired. Renew to keep your Pro perks."
                        : renewalProgress
                          ? `${renewalProgress.daysLeft} day${renewalProgress.daysLeft === 1 ? "" : "s"} left · renews ${expiresAt?.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`
                          : "Active"}
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="shrink-0 rounded-full">
                <Link href="/premium">
                  Manage subscription <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {renewalProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Current billing period</span>
                  <span>{renewalProgress.pct}% used</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                    style={{ width: `${renewalProgress.pct}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Perks */}
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold">Every Pro perk, in one place</h2>
              <p className="text-sm text-muted-foreground">Here is what your membership unlocks.</p>
            </div>
          </div>

          {/* Featured perk — large visual card */}
          {featuredPerks.map((perk) => {
            const meta = CATEGORY_META[perk.category]
            return (
              <Card
                key={perk.title}
                className="overflow-hidden border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-card to-fuchsia-500/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              >
                <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
                  <div className="relative shrink-0">
                    <div className="cosmetic-glow-pulse absolute -inset-1.5 rounded-2xl bg-gradient-to-tr from-amber-400/40 via-rose-400/30 to-indigo-500/40 blur-sm" />
                    <span
                      className={cn(
                        "relative flex h-16 w-16 items-center justify-center rounded-2xl border shadow-lg",
                        meta.iconBg,
                      )}
                    >
                      <perk.icon className="h-8 w-8" />
                    </span>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold">{perk.title}</p>
                      <Badge variant="outline" className={cn("rounded-full", meta.chip)}>
                        {perk.tag || meta.label}
                      </Badge>
                    </div>
                    <p className="max-w-xl text-sm text-muted-foreground">{perk.description}</p>
                  </div>
                  <Button asChild variant="outline" className="shrink-0 rounded-full">
                    <Link href="/events">
                      <CalendarClock className="mr-1.5 h-4 w-4" /> See schedule
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}

          {/* Compact perks grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {compactPerks.map((perk) => {
              const meta = CATEGORY_META[perk.category]
              return (
                <Card key={perk.title} className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                  <CardContent className="flex flex-col items-start gap-3 p-5">
                    <div className="flex w-full items-center justify-between">
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", meta.iconBg)}>
                        <perk.icon className="h-5 w-5" />
                      </span>
                      <Badge variant="outline" className={cn("rounded-full text-[10px]", meta.chip)}>
                        {meta.label}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-semibold">{perk.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{perk.description}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Live Pro identity preview */}
        <Card className="overflow-hidden border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/5 via-card to-amber-500/5">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-500">
                <Palette className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">Exclusive Pro identity</p>
                <p className="text-xs text-muted-foreground">Live preview of your badge and avatar frame.</p>
              </div>
            </div>
            <ProBadgePreview />
          </CardContent>
        </Card>

        {/* Referral CTA — tied into the coin-reward system */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card to-orange-600/10 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
              <Gift className="h-6 w-6" />
            </span>
            <div>
              <p className="font-semibold">Invite a friend, you both earn coins</p>
              <p className="text-sm text-muted-foreground">
                Share your invite link — when they join and post their first loop, you both get Loop Coins instantly.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white">
            <Link href="/settings?tab=referrals">
              <Zap className="mr-2 h-4 w-4" /> Get your invite link
            </Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
