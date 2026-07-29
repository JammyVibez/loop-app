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
  const [forceReady, setForceReady] = useState(false)

  // Profiles are public (API supports username lookup). Keep them browsable during auth hydrate.
  const publicRoutes = [
    "/",
    "/login",
    "/signup",
    "/landing",
    "/terms",
    "/privacy",
    "/reset-password",
    "/verify-email",
    "/email-confirmed",
    "/explore",
    "/trending",
    "/profile",
    "/invite",
    "/offline",
    "/loop",
    "/marketplace",
  ]
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  // Never leave the whole app stuck on "Loading your profile..."
  useEffect(() => {
    const timer = setTimeout(() => setForceReady(true), 7000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Wait for a real auth decision. forceReady alone must NOT mean "logged out".
    if (loading) return

    if (user) {
      // Only force onboarding for brand-new accounts with no username yet,
      // and only when arriving from auth pages. Incomplete onboarding must
      // never trap users away from circles, settings, marketplace, admin, etc.
      const isAuthEntry =
        pathname === "/login" ||
        pathname === "/signup" ||
        pathname === "/verify-email" ||
        pathname === "/email-confirmed"
      const missingIdentity = !user.username?.trim()
      const incomplete = user.onboarding_completed === false

      // Stay on the email-confirmed success page so the user can continue deliberately
      if (pathname === "/email-confirmed" && incomplete) {
        setRedirecting(false)
        return
      }

      if (incomplete && missingIdentity && pathname !== "/onboarding" && pathname !== "/email-confirmed") {
        setRedirecting(true)
        router.replace("/onboarding")
        return
      }

      if (incomplete && isAuthEntry && pathname !== "/email-confirmed") {
        setRedirecting(true)
        router.replace("/onboarding")
        return
      }

      if (user.onboarding_completed === true && (pathname === "/onboarding" || pathname === "/email-confirmed")) {
        setRedirecting(true)
        router.replace("/")
        return
      }

      if ((pathname === "/login" || pathname === "/signup") && user.onboarding_completed === true) {
        setRedirecting(true)
        router.replace("/")
        return
      }
    } else if (!isPublicRoute && pathname !== "/onboarding") {
      setRedirecting(true)
      router.replace("/login")
      return
    }

    setRedirecting(false)
  }, [user, loading, pathname, router, isPublicRoute])

  if (loading && !forceReady) {
    return <PageLoading message="Loading your profile..." />
  }

  // Auth still resolving after timeout — keep waiting on private routes instead of logging out.
  if (loading && forceReady && !user && !isPublicRoute) {
    return <PageLoading message="Restoring your session..." />
  }

  if (redirecting) {
    return <PageLoading message="Redirecting..." />
  }

  return <>{children}</>
}
