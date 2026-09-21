"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { CoachMarkTour } from "@/components/tour/coach-mark-tour"
import {
  FEED_TOUR_STEPS,
  hasSeenFeatureTour,
  markFeatureTourSeenLocally,
  persistFeatureTourSeen,
} from "@/lib/feature-tour"

/**
 * One-time coach-mark tour shown on the real feed right after onboarding.
 * Tips anchor to the live UI (see `data-tour` attributes) and only appear
 * once per user — `profiles.has_seen_feature_tour` (mirrored in localStorage).
 */
export function FeedTour() {
  const { user, loading, getAuthHeader } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading || !user) return
    // Only after onboarding — never on top of the profile setup flow.
    if (user.onboarding_completed !== true) return
    if (hasSeenFeatureTour(user as { has_seen_feature_tour?: boolean | null })) return

    // Let the feed paint (and its targets mount) before the first spotlight.
    const timer = setTimeout(() => setOpen(true), 900)
    return () => clearTimeout(timer)
  }, [loading, user?.id, (user as { onboarding_completed?: boolean } | null)?.onboarding_completed])

  const dismiss = useCallback(() => {
    setOpen(false)
    markFeatureTourSeenLocally()
    void persistFeatureTourSeen(true, getAuthHeader())
  }, [getAuthHeader])

  return <CoachMarkTour steps={FEED_TOUR_STEPS} open={open} onFinish={dismiss} onSkip={dismiss} />
}
