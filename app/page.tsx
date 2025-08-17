"use client"

import { useAuth } from "@/hooks/use-auth"
import { Theme3DProvider } from "@/providers/theme-3d-provider"
import { Header } from "@/components/header"
import { WelcomeBanner } from "@/components/welcome-banner"
import { CreateLoopButton } from "@/components/create-loop-button"
import { FeedTabs } from "@/components/feed-tabs"
import { TrendingSidebar } from "@/components/trending-sidebar"
import { LandingContent } from "@/components/landing/landing-content"
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt"

export default function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!user) {
    return <LandingContent />
  }

  return (
    <Theme3DProvider>
      <div className="min-h-screen bg-gradient-to-br from-[var(--theme-bg-start,#faf5ff)] via-[var(--theme-bg-mid,#ffffff)] to-[var(--theme-bg-end,#eff6ff)] dark:from-[var(--theme-bg-dark-start,#111827)] dark:via-[var(--theme-bg-dark-mid,#1f2937)] dark:to-[var(--theme-bg-dark-end,#111827)] transition-colors duration-500">
        <Header />

        <main className="container mx-auto px-2 sm:px-4 py-3 sm:py-6">
          <div className="grid grid-cols-1 xl:grid-cols-4 lg:grid-cols-3 gap-3 sm:gap-6">
            {/* Main Content */}
            <div className="xl:col-span-3 lg:col-span-2 space-y-3 sm:space-y-6">
              <WelcomeBanner />
             <div className="lg:col-span-3">
             <div className="mb-6">
              <CreateLoopButton />
            </div>
            <FeedTabs />
          
            </div>
            </div>

            {/* Sidebar - Hidden on mobile, shown on large screens */}
            <div className="hidden lg:block xl:col-span-1 lg:col-span-1">
              <div className="sticky top-20">
                <TrendingSidebar />
              </div>
            </div>
          </div>
        </main>
        
        {/* PWA Install Prompt */}
        <PWAInstallPrompt />
        
        {/* Mobile bottom spacing for navigation */}
        <div className="h-16 lg:hidden"></div>
      </div>
    </Theme3DProvider>
  )
}
