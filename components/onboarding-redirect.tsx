"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { PageLoading } from "@/components/loading-states"
import { isAuthRequiredPath, isGuestPublicPath } from "@/lib/guest"

export function OnboardingRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [redirecting, setRedirecting] = useState(false)
  const [forceReady, setForceReady] = useState(false)

  const isPublicRoute = isGuestPublicPath(pathname || "/")

  useEffect(() => {
    const timer = setTimeout(() => setForceReady(true), 7000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (loading) return

    if (user) {
      const isAuthEntry =
        pathname === "/login" ||
        pathname === "/signup" ||
        pathname === "/verify-email" ||
        pathname === "/email-confirmed"
      const missingIdentity = !user.username?.trim()
      const incomplete = user.onboarding_completed === false

      if (pathname === "/verify-email" || pathname === "/email-confirmed") {
        setRedirecting(true)
        router.replace(incomplete ? "/onboarding" : "/")
        return
      }

      if (incomplete && missingIdentity && pathname !== "/onboarding") {
        setRedirecting(true)
        router.replace("/onboarding")
        return
      }

      if (incomplete && isAuthEntry) {
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
    } else if (isAuthRequiredPath(pathname || "/")) {
      // Guests may browse public paths (and unknown routes render their own
      // 404); only interactive/account routes send guests to login
      setRedirecting(true)
      const redirect = encodeURIComponent(pathname || "/")
      router.replace(`/login?redirect=${redirect}`)
      return
    }

    setRedirecting(false)
  }, [user, loading, pathname, router, isPublicRoute])

  // Public routes must render immediately so crawlers/SSR see real content
  // (title/h1) instead of an auth loading shell.
  if (loading && !forceReady && !isPublicRoute) {
    return <PageLoading message="Loading your profile..." />
  }

  if (loading && forceReady && !user && !isPublicRoute) {
    return <PageLoading message="Restoring your session..." />
  }

  if (redirecting) {
    return <PageLoading message="Redirecting..." />
  }

  return <>{children}</>
}
