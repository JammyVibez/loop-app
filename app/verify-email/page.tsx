"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageLoading } from "@/components/loading-states"

/** Email verification paused — send everyone to onboarding / home. */
export default function EmailVerificationRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/onboarding")
  }, [router])
  return <PageLoading message="Continuing to setup…" />
}
