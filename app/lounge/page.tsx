"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DiscordInviteWidget } from "@/components/lounge/discord-invite-widget"
import {
  Lock,
  Sparkles,
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
} from "lucide-react"

const PERKS = [
  {
    icon: Users,
    color: "bg-amber-500/10 text-amber-500",
    title: "Founder Q&As",
    description: "Monthly live sessions with the Loop team — ask anything about the roadmap and shape what ships next.",
  },
  {
    icon: Vote,
    color: "bg-emerald-500/10 text-emerald-500",
    title: "Priority feature voting",
    description: "Pro members get weighted votes on the features Loop builds next. Your vote counts double.",
  },
  {
    icon: Rocket,
    color: "bg-cyan-500/10 text-cyan-500",
    title: "Early access builds",
    description: "Try new features, themes, and Co-Loop studio tools weeks before they roll out to everyone.",
  },
  {
    icon: Crown,
    color: "bg-purple-500/10 text-purple-500",
    title: "Exclusive Pro identity",
    description: "The gold Pro badge, premium card effects, and a members-only theme collection for your profile.",
  },
  {
    icon: Coins,
    color: "bg-yellow-500/10 text-yellow-500",
    title: "Weekly Loop Coin bonus",
    description: "A recurring coin stipend every week, plus bigger rewards in duels, contests, and daily claims.",
  },
  {
    icon: LifeBuoy,
    color: "bg-rose-500/10 text-rose-500",
    title: "Priority support",
    description: "Your support tickets jump the queue, with a dedicated Pro channel to talk to the team directly.",
  },
]

export default function LoungePage() {
  const { user, loading } = useAuth()
  const [announcement, setAnnouncement] = useState<string | null>(null)

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
              <Sparkles className="mr-2 h-4 w-4" /> Get Loop Pro
            </Link>
          </Button>
        </main>
      </div>
    )
  }

  const expiresAt = user.premium_expires_at ? new Date(user.premium_expires_at) : null
  const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : false
  const isLifetime = !expiresAt

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-4xl space-y-8 px-4 py-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-orange-600/10 p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
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
              out with the people building Loop.
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

        {/* Pro status */}
        <Card className="overflow-hidden border-indigo-500/20">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-amber-500/20">
                <BadgeCheck className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold">Your Pro membership is active</p>
                <p className="text-sm text-muted-foreground">
                  {isLifetime
                    ? "Lifetime Pro — thank you for supporting Loop! 🎉"
                    : isExpired
                      ? "Your membership has expired. Renew to keep your Pro perks."
                      : expiresAt
                        ? `Renews on ${expiresAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`
                        : "Active"}
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0 rounded-full">
              <Link href="/premium">
                Manage subscription <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((perk) => (
              <Card key={perk.title} className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="flex flex-col items-start gap-3 p-5">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${perk.color}`}>
                    <perk.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{perk.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{perk.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-amber-500/30 bg-amber-500/5 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-6 w-6 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold">Know someone who should be here?</p>
              <p className="text-sm text-muted-foreground">Share the Lounge with your favorite creators and communities.</p>
            </div>
          </div>
          <Button asChild className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white">
            <Link href="/premium">
              <Sparkles className="mr-2 h-4 w-4" /> View all Pro perks
            </Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
