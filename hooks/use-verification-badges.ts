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

/** DB writers may store `colors` as a JSON string — normalize to string[]. */
function normalizeBadge(b: any): VerificationBadge {
  let colors: unknown = b.colors
  if (typeof colors === "string") {
    try {
      colors = JSON.parse(colors)
    } catch {
      colors = b.colors
    }
  }
  const arr = Array.isArray(colors)
    ? colors.map((c: unknown) => String(c).trim()).filter(Boolean)
    : typeof colors === "string" && colors.trim()
      ? [colors.trim()]
      : []
  return { ...b, colors: arr }
}

async function loadBadges(): Promise<Record<string, VerificationBadge>> {
  if (cached) return cached
  if (!inflight) {
    inflight = fetch("/api/verification-badges", { cache: "no-store" })
      .then((res) => res.json().catch(() => ({ badges: [] })))
      .then((data) => {
        const map: Record<string, VerificationBadge> = {}
        for (const b of data.badges || []) map[b.id] = normalizeBadge(b)
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
