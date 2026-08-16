"use client"

import { useEffect, useState } from "react"

export interface VerificationBadge {
  id: string
  name: string
  label?: string | null
  icon?: string | null
  colors: string[]
  description?: string | null
}

let cached: Record<string, VerificationBadge> | null = null
let inflight: Promise<Record<string, VerificationBadge>> | null = null

async function loadBadges(): Promise<Record<string, VerificationBadge>> {
  if (cached) return cached
  if (!inflight) {
    inflight = fetch("/api/verification-badges", { cache: "no-store" })
      .then((res) => res.json().catch(() => ({ badges: [] })))
      .then((data) => {
        const map: Record<string, VerificationBadge> = {}
        for (const b of data.badges || []) map[b.id] = b
        cached = map
        return map
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/**
 * Loads the active verification-badge catalog once and returns a lookup map
 * (id -> badge). Re-renders are cheap: the fetch is cached for the session.
 */
export function useVerificationBadges() {
  const [badges, setBadges] = useState<Record<string, VerificationBadge>>(cached || {})

  useEffect(() => {
    let mounted = true
    void loadBadges().then((map) => {
      if (mounted) setBadges(map)
    })
    return () => {
      mounted = false
    }
  }, [])

  return badges
}
