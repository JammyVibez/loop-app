"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { PageLoading } from "@/components/loading-states"

export function OnboardingRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [redirecting, setRedirecting] = useState(false)

  const publicRoutes = ["/login", "/signup", "/landing", "/terms", "/privacy", "/reset-password", "/verify-email"]
  const isPublicRoute = publicRoutes.includes(pathname)

  useEffect(() => {
    if (loading) return

    if (user) {
      // Check if user has completed onboarding
      if (!user.bio && pathname !== "/onboarding") {
        setRedirecting(true)
        router.push("/onboarding")
        return
      }

      // If user is on onboarding page but has completed it, redirect to home
      if (user.bio && pathname === "/onboarding") {
        setRedirecting(true)
        router.push("/")
        return
      }

      // If user is on login/signup page but already authenticated, redirect to home
      if ((pathname === "/login" || pathname === "/signup") && user.bio) {
        setRedirecting(true)
        router.push("/")
        return
      }
    } else {
      // If user is not logged in and not on a public route, redirect to login
      if (!isPublicRoute) {
        setRedirecting(true)
        router.push("/login")
        return
      }
    }

    setRedirecting(false)
  }, [user, loading, pathname, router])

  // Show loading screen while auth is being determined or redirecting
  if (loading) {
    return <PageLoading message="Loading your profile..." />
  }

  if (redirecting) {
    return <PageLoading message="Redirecting..." />
  }

  // Show loading if setting up profile
  if (user && !user.bio && pathname !== "/onboarding") {
    return <PageLoading message="Setting up your profile..." />
  }

  return <>{children}</>
}