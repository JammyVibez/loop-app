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

  const publicRoutes = ["/", "/login", "/signup", "/landing", "/terms", "/privacy", "/reset-password", "/verify-email", "/onboarding"]
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  useEffect(() => {
    if (loading) return

    if (user) {
      if (!user.onboarding_completed && pathname !== "/onboarding") {
        setRedirecting(true)
        router.push("/onboarding")
        return
      }

      if (user.onboarding_completed && pathname === "/onboarding") {
        setRedirecting(true)
        router.push("/")
        return
      }

      if ((pathname === "/login" || pathname === "/signup") && user.onboarding_completed) {
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

  if (loading) {
    return <PageLoading message="Loading your profile..." />
  }

  if (redirecting) {
    return <PageLoading message="Redirecting..." />
  }

  if (user && !user.bio && pathname !== "/onboarding") {
    return <PageLoading message="Setting up your profile..." />
  }

  return <>{children}</>
}