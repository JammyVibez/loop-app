"use client";
import { useAuth } from "@/hooks/use-auth";
import { Theme3DProvider } from "@/providers/theme-3d-provider";
import { Header } from "@/components/header";
import { WelcomeBanner } from "@/components/welcome-banner";
import { CreateLoopButton } from "@/components/create-loop-button";
import { FeedTabs } from "@/components/feed-tabs";
import { TrendingSidebar } from "@/components/trending-sidebar";
import { LandingContent } from "@/components/landing/landing-content";
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import Link from "next/link";
import { Compass, Users, Video, Plus } from "lucide-react";

export default function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    )
  }

  if (!user) {
    return <LandingContent />
  }

  return (
    <Theme3DProvider>
      <div className="min-h-screen bg-transparent text-slate-100 transition-colors duration-500">
        <Header />

        <main className="container mx-auto px-2 sm:px-4 py-3 sm:py-6">
          <div className="grid grid-cols-1 xl:grid-cols-4 lg:grid-cols-3 gap-3 sm:gap-6">
            <div className="xl:col-span-3 lg:col-span-2 space-y-3 sm:space-y-6">
              <WelcomeBanner />

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <Link
                  href="/create"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New loop
                </Link>
                <Link
                  href="/explore"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300"
                >
                  <Compass className="h-3.5 w-3.5" />
                  Explore
                </Link>
                <Link
                  href="/circles"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300"
                >
                  <Users className="h-3.5 w-3.5" />
                  Circles
                </Link>
                <Link
                  href="/reels"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300"
                >
                  <Video className="h-3.5 w-3.5" />
                  Reels
                </Link>
              </div>

              <div className="mb-2">
                <CreateLoopButton
                  onLoopCreated={() => {
                    // Soft refresh feed tabs by reloading home content
                    window.dispatchEvent(new Event("loop-created"))
                    // Fallback: reload if no listener refreshes
                    setTimeout(() => {
                      if (typeof window !== "undefined") window.location.reload()
                    }, 400)
                  }}
                />
              </div>
              <FeedTabs />
            </div>

            <div className="hidden lg:block xl:col-span-1 lg:col-span-1">
              <div className="sticky top-20 space-y-4">
                <TrendingSidebar />
              </div>
            </div>
          </div>
        </main>

        <PWAInstallPrompt />
      </div>
    </Theme3DProvider>
  )
}
