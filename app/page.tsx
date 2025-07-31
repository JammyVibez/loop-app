"use client"

import { useAuth } from "../providers/auth-provider"
import { Header } from "../components/header"
import { WelcomeBanner } from "../components/welcome-banner"
import { FeedTabs } from "../components/feed-tabs"
import { LoopFeed } from "../components/loop-feed"
import { TrendingSidebar } from "../components/trending-sidebar"
import { LandingContent } from "../components/landing/landing-content"

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            <WelcomeBanner />
            <FeedTabs />
            <LoopFeed />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <TrendingSidebar />
          </div>
        </div>
      </main>
    </div>
  )
}
