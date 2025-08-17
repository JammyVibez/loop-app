"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"

export function OnboardingRedirect() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && user) {
      // Skip redirect if already on onboarding page or auth pages
      const skipRoutes = ["/onboarding", "/login", "/signup", "/reset-password"]
      if (skipRoutes.includes(pathname)) return

      // Check if user has completed onboarding - look for bio or onboarding_completed flag
      const needsOnboarding = !user.bio || user.bio.trim() === ""

      if (needsOnboarding && pathname !== "/onboarding") {
        router.push("/onboarding")
      }
    }
  }, [user, loading, router, pathname])

  return null
}