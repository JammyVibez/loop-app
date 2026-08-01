"use client"

import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/header"
import { WelcomeBanner } from "@/components/welcome-banner"
import { CreateLoopButton } from "@/components/create-loop-button"
import { FeedTabs } from "@/components/feed-tabs"
import { TrendingSidebar } from "@/components/trending-sidebar"
import { UserSuggestions } from "@/components/users/user-suggestions"
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt"
import { MomentsStrip } from "@/components/engagement/moments-strip"
import { DailyPulse } from "@/components/engagement/daily-pulse"
import { Button } from "@/components/ui/button"
import { Compass, Users, Video, Plus, Bookmark, LogIn, Search } from "lucide-react"

export default function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const isGuest = !user

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header />

      <main className="container mx-auto px-2 pb-24 pt-3 sm:px-4 sm:py-6 lg:pb-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4 sm:space-y-5">
            {isGuest ? (
              <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-sky-500/10 via-background to-violet-500/10 p-4 sm:p-5">
                <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="max-w-xl">
                    <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
                      <Compass className="h-3.5 w-3.5" />
                      Guest mode
                    </p>
                    <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                      Explore Loop
                    </h1>
                    <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
                      Browse public loops and profiles freely. Sign in when you want to like, reply, follow, or post.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button asChild className="rounded-full">
                      <Link href="/signup">
                        Join free
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full">
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
                <MomentsStrip />
                <DailyPulse />
              </>
            )}

            <div className="scrollbar-none flex gap-2 overflow-x-auto pb-0.5">
              {!isGuest && (
                <Link
                  href="/create"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New loop
                </Link>
              )}
              <Link
                href="/explore"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Compass className="h-3.5 w-3.5" />
                Explore
              </Link>
              <Link
                href="/search"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Search className="h-3.5 w-3.5" />
                Search
              </Link>
              <Link
                href="/reels"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Video className="h-3.5 w-3.5" />
                Reels
              </Link>
              {!isGuest && (
                <>
                  <Link
                    href="/circles"
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Circles
                  </Link>
                  <Link
                    href="/bookmarks"
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    Saved
                  </Link>
                </>
              )}
            </div>

            <CreateLoopButton
              onLoopCreated={() => {
                window.dispatchEvent(new CustomEvent("loop-created"))
              }}
            />

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
                <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
                  <p className="font-semibold">Why join Loop?</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>Post loops & code snippets</li>
                    <li>Follow creators and build your feed</li>
                    <li>Chat, gift, and join communities</li>
                  </ul>
                  <Button asChild className="mt-4 w-full rounded-full">
                    <Link href="/signup">Create account</Link>
                  </Button>
                  <Button asChild variant="ghost" className="mt-1 w-full rounded-full">
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
