"use client"

import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/header"
import { WelcomeBanner } from "@/components/welcome-banner"
import { ReturnRecap } from "@/components/return-recap"
import { CircleActivityStrip } from "@/components/circle-activity-strip"
import { FeedTabs } from "@/components/feed-tabs"
import { TrendingSidebar } from "@/components/trending-sidebar"
import { UserSuggestions } from "@/components/users/user-suggestions"
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt"
import { AppDownloadBadges } from "@/components/app-download-badges"
import { DailyPulse } from "@/components/engagement/daily-pulse"
import { Button } from "@/components/ui/button"
import { Compass, Users, Video, Plus, Bookmark, LogIn, Search } from "lucide-react"
import { useEffect, useState } from "react"

export function HomePageClient() {
  const { user } = useAuth()

  // Treat unresolved auth as guest so SSR/crawlers get real content + <h1>
  // instead of an empty loading shell.
  const isGuest = !user

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header />

      <main className="container mx-auto px-2 pb-24 pt-3 sm:px-4 sm:py-6 lg:pb-6">
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-2.5 sm:space-y-3">
            {isGuest ? (
              <section className="rounded-2xl border border-border/60 bg-card/50 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="max-w-xl">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      Build together.
                      <span className="text-muted-foreground"> Not just post into the void.</span>
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                      Co-write posts live with friends, settle debates in public Duels, and build spaces that are actually yours.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button asChild className="rounded-full" size="sm">
                      <Link href="/signup">Join free</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full" size="sm">
                      <Link href="/login">
                        <LogIn className="mr-1.5 h-4 w-4" />
                        Log in
                      </Link>
                    </Button>
                  </div>
                </div>
              </section>
            ) : (
              <>
                <WelcomeBanner />
                <ReturnRecap />
                <CircleActivityStrip />
                <DailyPulse />
              </>
            )}

            {/* Quick Filter & Nav Chips with Horizontal Scroll and Fade Edges */}
            <div className="relative group">
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent z-10" />
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10" />
              <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5 px-0.5 scroll-smooth">
                {!isGuest && (
                  <Link
                    href="/create"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New loop
                  </Link>
                )}
                <Link
                  href="/explore"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                >
                  <Compass className="h-3.5 w-3.5" />
                  Explore
                </Link>
                <Link
                  href="/search"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                >
                  <Search className="h-3.5 w-3.5" />
                  Search
                </Link>
                <Link
                  href="/reels"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                >
                  <Video className="h-3.5 w-3.5" />
                  Reels
                </Link>
                {!isGuest && (
                  <>
                    <Link
                      href="/circles"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Circles
                    </Link>
                    <Link
                      href="/bookmarks"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      Saved
                    </Link>
                  </>
                )}
              </div>
            </div>

            <FeedTabs guestMode={isGuest} />

            {!isGuest && (
              <div className="lg:hidden">
                <UserSuggestions title="Who to follow" limit={4} compact />
              </div>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              {isGuest ? (
                <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
                  <h2 className="text-sm font-semibold">Why join Loop?</h2>
                  <ul className="mt-3 space-y-2.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                      <span><strong className="text-foreground">Co-Loop</strong> — Co-write and publish live with up to 4 people.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                      <span><strong className="text-foreground">Duels</strong> — Stake coins, let the community vote on a winner.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                      <span><strong className="text-foreground">Circles</strong> — Build communities around your interests.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                      <span><strong className="text-foreground">Coins</strong> — Earn, gift, and boost content across Loop.</span>
                    </li>
                  </ul>

                  <div className="mt-4">
                    <StatsBlock />
                  </div>

                  <Button asChild className="mt-4 w-full rounded-full" size="sm">
                    <Link href="/signup">Create account</Link>
                  </Button>
                  <Button asChild variant="ghost" className="mt-1 w-full rounded-full" size="sm">
                    <Link href="/landing">What is Loop?</Link>
                  </Button>
                </div>
              ) : null}
              <TrendingSidebar />
              {!isGuest && <UserSuggestions title="Who to follow" limit={5} compact />}
            </div>
          </aside>
        </div>
      </main>

      <PWAInstallPrompt />
    </div>
  )
}

function StatsBlock() {
  const [stats, setStats] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function fetchStats() {
      try {
        const res = await fetch(`/api/stats`, { cache: "no-store" })
        const data = await res.json()
        if (!mounted) return
        if (!res.ok) throw new Error(data?.error || "Failed to load stats")
        setStats(data)
      } catch (err: any) {
        console.error("Stats fetch error:", err)
        setError(err.message || "Failed to load")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void fetchStats()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) return <p className="mt-3 text-sm text-muted-foreground">Loading live activity…</p>
  if (error) return <p className="mt-3 text-sm text-red-500">Couldn't load activity</p>
  if (!stats) return null

  // Only show counts if they're non-trivial (threshold: 10)
  const showCount = (n: number | null | undefined) => typeof n === "number" && n >= 10
  const counts = [
    showCount(stats.total_loops) ? { label: "Loops created", value: stats.total_loops } : null,
    showCount(stats.total_users) ? { label: "People on Loop", value: stats.total_users } : null,
    showCount(stats.total_circles) ? { label: "Circles", value: stats.total_circles } : null,
    showCount(stats.active_co_loops) ? { label: "People building right now", value: stats.active_co_loops } : null,
  ].filter(Boolean)

  if (counts.length > 0) {
    return (
      <div className="mt-4 border-t border-border/60 pt-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Live activity</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {counts.map((c: any) => (
            <div key={c.label} className="rounded-md bg-muted/20 p-2 text-sm">
              <div className="text-lg font-bold">{c.value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Fallback: show a few recent items (loops or circles) if counts are low
  const recentLoops = (stats.recent_loops || []).slice(0, 3)
  const recentCircles = (stats.recent_circles || []).slice(0, 3)

  if (recentLoops.length || recentCircles.length) {
    return (
      <div className="mt-4 border-t border-border/60 pt-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Recent activity</p>
        <div className="mt-2 space-y-2">
          {recentLoops.map((l: any) => (
            <Link key={l.id} href={`/loop/${l.id}`} className="block text-sm text-foreground/90 hover:underline">
              {l.preview}
              <div className="text-xs text-muted-foreground">by @{l.author_username}</div>
            </Link>
          ))}
          {recentCircles.map((c: any) => (
            <Link key={c.id} href={`/circles/${c.id}`} className="block text-sm text-foreground/90 hover:underline">
              {c.name}
              <div className="text-xs text-muted-foreground">{c.member_count ?? "Active"} active</div>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return <p className="mt-3 text-sm text-muted-foreground">Join free to start building with others.</p>
}
