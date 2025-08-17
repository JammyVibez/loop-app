
"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"

interface OnboardingRedirectProps {
  children: React.ReactNode
}

export function OnboardingRedirect({ children }: OnboardingRedirectProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return

    // Skip redirect for auth pages and onboarding
    const authPages = ['/login', '/signup', '/onboarding', '/verify-email', '/landing']
    const isAuthPage = authPages.some(page => pathname.startsWith(page))
    
    if (isAuthPage) return

    // Redirect to onboarding if user exists but hasn't completed onboarding
    if (user && !user.onboarding_completed) {
      router.push('/onboarding')
      return
    }

    // Redirect to login if no user and not on auth page
    if (!user && !isAuthPage) {
      router.push('/login')
      return
    }
  }, [user, loading, pathname, router])

  return <>{children}</>
}
