"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { ProfileMarketplace } from "@/components/profile/profile-marketplace"
import { useAuth } from "@/hooks/use-auth"
import { normalizeProfileLayout } from "@/lib/profile-layout"

export default function ProfileMarketplacePage() {
  const { user, getAuthHeader } = useAuth()
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    let cancelled = false
    fetch("/api/users/profile", { headers: getAuthHeader(), cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || "Could not load your profile.")
        if (!cancelled) setProfile(data.profile || null)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, getAuthHeader])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <ProfileMarketplace
          currentLayout={normalizeProfileLayout(profile?.profile_layout)}
          currentCss={profile?.custom_profile_css || ""}
          designCss={profile?.profile_design_css || ""}
          themeTokens={profile?.theme_preferences?.colors || {}}
        />
      </main>
      <MobileBottomNav />
    </div>
  )
}
