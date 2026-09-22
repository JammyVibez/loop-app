"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, Coins, Calendar, TrendingUp, ExternalLink, Zap, Settings2, Plus } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { PageLoading } from "@/components/loading-states"
import { LoopCard } from "@/components/loop-card"
import type { NormalizedLoop } from "@/lib/normalize-loop"
import { Spinner } from "@/components/ui/skeletons"

interface OrgStatus {
  threshold: number
  follower_count: number
  eligible: boolean
  is_organization: boolean
  organization_name: string | null
  organization_badge_url: string | null
  organization_config: {
    coin_rate_multiplier: number
    custom_boost_discount: number
    circle_perk_price: number
    exclusive_rewards_enabled: boolean
  }
}

export default function OrganizationDashboardPage() {
  const { user, loading, authResolved, getAuthHeader } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [status, setStatus] = useState<OrgStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [stats, setStats] = useState<{ loops_count: number; loop_coins: number; total_earnings: number; xp_points: number } | null>(null)
  const [recentLoops, setRecentLoops] = useState<NormalizedLoop[]>([])

  useEffect(() => {
    // Wait for a conclusive session check — a failed lookup must not sign the
    // visitor out by redirect.
    if (!loading && authResolved && !user) router.replace("/login?redirect=/organization")
  }, [loading, authResolved, user, router])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      setLoadingStatus(true)
      try {
        const res = await fetch("/api/organizations/upgrade", { headers: getAuthHeader(), cache: "no-store" })
        const data = await res.json()
        if (res.ok) setStatus(data)
        else toast({ title: "Error", description: data.error || "Failed to load org status", variant: "destructive" })
      } catch {
        /* ignore */
      } finally {
        setLoadingStatus(false)
      }
    })()
    ;(async () => {
      try {
        const res = await fetch(`/api/users/profile?username=${encodeURIComponent(user.username || user.id)}`, {
          headers: getAuthHeader(),
          cache: "no-store",
        })
        const data = await res.json()
        if (res.ok && data.profile) {
          setStats({
            loops_count: Number(data.profile.loops_count || 0),
            loop_coins: Number(data.profile.loop_coins || 0),
            total_earnings: Number(data.profile.total_earnings || 0),
            xp_points: Number(data.profile.xp_points || 0),
          })
          setRecentLoops((data.profile.recent_loops || []).slice(0, 3))
        }
      } catch {
        /* ignore */
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (loading) return <PageLoading message="Loading…" />
  if (!user) return <PageLoading message="Redirecting to login…" />

  const isOrg = Boolean(status?.is_organization)
  const config = status?.organization_config

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mb-6 space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Building2 className="h-7 w-7 text-emerald-500" /> Organization Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Run your brand on loopapp.me — perks, growth, and live community events in one place.
          </p>
        </div>

        {loadingStatus ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Spinner className="h-4 w-4" /> Loading organization dashboard…
          </div>
        ) : !isOrg ? (
          <Card className="border-dashed py-16 text-center">
            <CardContent className="space-y-3">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Organization mode isn&apos;t enabled</h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Turn your account into an Official Organization once you hit the follower milestone to unlock boosted
                coin rates, custom perks, and event hosting.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <Button asChild className="rounded-full">
                  <Link href="/settings?tab=organization">Enable in Settings</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/">Back home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Hero */}
            <Card className="relative overflow-hidden border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-background to-cyan-500/10">
              <CardContent className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15">
                    {status?.organization_badge_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={status.organization_badge_url} alt="" className="h-12 w-12 rounded-full object-contain" />
                    ) : (
                      <Building2 className="h-8 w-8 text-emerald-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold">{status?.organization_name || user.display_name}</h2>
                      <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Official Organization</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href="/settings?tab=organization">
                      <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Manage perks
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href={`/profile/${user.username}`}>
                      View profile <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Users, label: "Followers", value: (status?.follower_count || 0).toLocaleString() },
                { icon: Zap, label: "Loops posted", value: (stats?.loops_count || 0).toLocaleString() },
                { icon: Coins, label: "Loop Coins", value: (stats?.loop_coins || 0).toLocaleString() },
                { icon: TrendingUp, label: "Earnings", value: `${(stats?.total_earnings || 0).toLocaleString()} coins` },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="flex flex-col items-center gap-1 py-4 text-center">
                    <s.icon className="h-4 w-4 text-emerald-500" />
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Org perks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-emerald-500" /> Organization perks
                </CardTitle>
                <CardDescription>Your active earnings & member perks.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Coin rate multiplier", value: `${config?.coin_rate_multiplier || 1.5}×`, desc: "per loop / engagement" },
                    { label: "Boost discount", value: `${Math.round((config?.custom_boost_discount || 0.2) * 100)}%`, desc: "on post boosts" },
                    { label: "Circle perk price", value: `${config?.circle_perk_price || 50} coins`, desc: "for member perks" },
                  ].map((p) => (
                    <div key={p.label} className="rounded-xl border border-border bg-card/60 p-4">
                      <p className="text-xs text-muted-foreground">{p.label}</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-500">{p.value}</p>
                      <p className="text-xs text-muted-foreground">{p.desc}</p>
                    </div>
                  ))}
                </div>
                {config?.exclusive_rewards_enabled && (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    ✦ Exclusive rewards enabled for your community
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Host an event + recent loops */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-background to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4 text-cyan-500" /> Host a community event
                  </CardTitle>
                  <CardDescription>Go live on the Events Stage and rally your community.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button asChild className="w-full rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500">
                    <Link href="/events">
                      <Plus className="mr-1.5 h-4 w-4" /> Host event on Events Stage
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full rounded-full">
                    <Link href="/circles">
                      <Users className="mr-1.5 h-4 w-4" /> Manage your Circles
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Your latest loops</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentLoops.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No loops yet — share your first post to start growing.
                    </p>
                  ) : (
                    recentLoops.map((loop) => <LoopCard key={loop.id} loop={loop} />)
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
