"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageLoading } from "@/components/loading-states"

/** Email confirmation success page paused — go straight to onboarding. */
export default function EmailConfirmedRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/onboarding")
  }, [router])
  return <PageLoading message="Continuing to setup…" />
}
