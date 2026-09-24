"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { AdCard, type AdData } from "@/components/ads/ad-card"

/**
 * A self-contained sponsored slot for any page surface.
 *
 * Flow mirrors the home feed: GET /api/ads/feed?surface=… tells us whether
 * THIS viewer is eligible (Pro/Sponsor users are excluded server-side, and
 * admins can switch any surface off in ad_settings). Only when eligible do we
 * ask for a creative, and the creative request carries the surface too so the
 * server can re-check. No ad = nothing renders — no skeleton flash.
 */
export function AdSlot({ surface, className }: { surface: string; className?: string }) {
  const { user } = useAuth()
  const [ad, setAd] = useState<AdData | null>(null)
  const sessionIdRef = useRef<string>("")

  if (!sessionIdRef.current && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    sessionIdRef.current = crypto.randomUUID()
  }

  // Re-runs when the surface changes or the session flips (guest → signed in,
  // sign-out, account switch), because eligibility depends on the viewer.
  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    }

    let cancelled = false
    setAd(null)

    ;(async () => {
      try {
        const eligibilityRes = await fetch(`/api/ads/feed?surface=${encodeURIComponent(surface)}`, {
          cache: "no-store",
        })
        const eligibility = await eligibilityRes.json().catch(() => ({ eligible: false }))
        if (cancelled || !eligibility?.eligible) return

        const adsRes = await fetch("/api/ads/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 1, surface }),
          cache: "no-store",
        })
        const adsData = await adsRes.json().catch(() => ({ ads: [] }))
        if (cancelled) return
        setAd(adsData?.ads?.[0] || null)
      } catch {
        if (!cancelled) setAd(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [surface, user?.id])

  if (!ad) return null

  return (
    <div className={className}>
      <AdCard ad={ad} sessionId={sessionIdRef.current} />
    </div>
  )
}
