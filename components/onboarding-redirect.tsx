"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { PageLoading } from "@/components/loading-states";

export function OnboardingRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [redirecting, setRedirecting] = useState(false)

  const publicRoutes = ["/", "/login", "/signup", "/landing", "/terms", "/privacy", "/reset-password", "/verify-email"]
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  useEffect(() => {
    if (loading) return

    if (user) {
      // Strict false check: undefined during optimistic updates should not loop.
      if (user.onboarding_completed === false && pathname !== "/onboarding") {
        setRedirecting(true)
        router.replace("/onboarding")
        return
      }

      if (user.onboarding_completed === true && pathname === "/onboarding") {
        setRedirecting(true)
        router.replace("/")
        return
      }

      if ((pathname === "/login" || pathname === "/signup") && user.onboarding_completed === true) {
        setRedirecting(true)
        router.replace("/")
        return
      }
    } else {
      // If user is not logged in and not on a public route, redirect to login
      if (!isPublicRoute) {
        setRedirecting(true)
        router.replace("/login")
        return
      }
    }

    setRedirecting(false)
  }, [user, loading, pathname, router, isPublicRoute])

  if (loading) {
    return <PageLoading message="Loading your profile..." />
  }

  if (redirecting) {
    return <PageLoading message="Redirecting..." />
  }

  return <>{children}</>
}