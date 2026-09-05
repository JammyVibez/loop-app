"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { AdCard, type AdData } from "@/components/ads/ad-card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * A self-contained sponsored slot for any page surface.
 *
 * Flow mirrors the home feed: GET /api/ads/feed?surface=... tells us
 * whether THIS viewer is eligible (Pro/Sponsor users are excluded
 * server-side, and admins can switch any surface off in ad_settings).
 * Only when eligible do we ask for an ad. No ad = nothing renders.
 */
export function AdSlot({ surface, className }: { surface: string; className?: string }) {
  const { user } = useAuth()
  const [ad, setAd] = useState<AdData | null>(null)
  const [visible, setVisible] = useState(false)
  const initRef = useRef(false)
  const sessionIdRef = useRef<string>("")

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    sessionIdRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    let cancelled = false
    ;(async () => {
      try {
        const eligibilityRes = await fetch(`/api/ads/feed?surface=${encodeURIComponent(surface)}`, { cache: "no-store" })
        const eligibility = await eligibilityRes.json()
        if (cancelled || !eligibility?.eligible) return
        setVisible(true)
        const adsRes = await fetch("/api/ads/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 1 }),
          cache: "no-store",
        })
        const adsData = await adsRes.json()
        if (cancelled) return
        const first = adsData?.ads?.[0]
        if (first) setAd(first)
        else setVisible(false)
      } catch {
        setVisible(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface])

  // Re-check eligibility when the session flips (guest → signed in).
  useEffect(() => {
    if (initRef.current) return
    if (user) {
      initRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (!visible) return null
  if (!ad) return <Skeleton className={`h-28 w-full rounded-2xl ${className || ""}`} />

  return (
    <div className={className}>
      <AdCard ad={ad} sessionId={sessionIdRef.current} />
    </div>
  )
}
