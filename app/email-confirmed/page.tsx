"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"

/**
 * Shown after the user confirms their email via the Supabase link.
 * Auth session is already set by /api/auth/callback before arriving here.
 */
export default function EmailConfirmedPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loading) return
    setReady(true)
    // Already finished onboarding — skip to home
    if (user?.onboarding_completed === true) {
      router.replace("/")
    }
  }, [loading, user?.onboarding_completed, router])

  const continueToOnboarding = () => {
    router.push("/onboarding")
  }

  if (!ready || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_-10%,rgba(56,189,248,0.18),transparent_55%),radial-gradient(700px_400px_at_90%_10%,rgba(251,191,36,0.14),transparent_50%)]"
      />

      <Card className="relative z-10 w-full max-w-md border-border/70 shadow-lg">
        <CardContent className="space-y-6 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-8 ring-emerald-500/10">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>

          <div className="space-y-2">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Email confirmed
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">You&apos;re verified</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              {user?.email
                ? `${user.email} is confirmed. Next, set up your Loop profile.`
                : "Your email is confirmed. Next, set up your Loop profile."}
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <Button
              size="lg"
              className="w-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 text-white hover:from-sky-500 hover:to-cyan-400"
              onClick={continueToOnboarding}
            >
              Continue to onboarding
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              Takes about a minute — username, interests, and your first vibe.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Wrong account?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
              Sign in again
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
