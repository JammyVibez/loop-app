"use client";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/header";
import { WelcomeBanner } from "@/components/welcome-banner";
import { CreateLoopButton } from "@/components/create-loop-button";
import { FeedTabs } from "@/components/feed-tabs";
import { TrendingSidebar } from "@/components/trending-sidebar";
import { UserSuggestions } from "@/components/users/user-suggestions";
import { LandingContent } from "@/components/landing/landing-content";
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import Link from "next/link";
import { Compass, Users, Video, Plus } from "lucide-react";

export default function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return <LandingContent />
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header />

      <main className="container mx-auto px-2 py-3 sm:px-4 sm:py-6">
        <div className="grid grid-cols-1 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-3 sm:space-y-6 lg:col-span-2 xl:col-span-3">
            <WelcomeBanner />

            <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
              <Link
                href="/create"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                New loop
              </Link>
              <Link
                href="/explore"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
              >
                <Compass className="h-3.5 w-3.5" />
                Explore
              </Link>
              <Link
                href="/circles"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
              >
                <Users className="h-3.5 w-3.5" />
                Circles
              </Link>
              <Link
                href="/reels"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
              >
                <Video className="h-3.5 w-3.5" />
                Reels
              </Link>
            </div>

            <div className="mb-2">
              <CreateLoopButton
                onLoopCreated={() => {
                  window.dispatchEvent(new Event("loop-created"))
                  setTimeout(() => {
                    if (typeof window !== "undefined") window.location.reload()
                  }, 400)
                }}
              />
            </div>
            <FeedTabs />
            <div className="lg:hidden">
              <UserSuggestions title="People you may know" limit={4} />
            </div>
          </div>

          <div className="hidden lg:col-span-1 lg:block xl:col-span-1">
            <div className="sticky top-20 space-y-4">
              <TrendingSidebar />
            </div>
          </div>
        </div>
      </main>

      <PWAInstallPrompt />
    </div>
  )
}
