import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { AD_FREQUENCY_DEFAULT, AD_SURFACES, clampFrequency, isSurfaceEnabled } from "@/lib/ads"

export const dynamic = "force-dynamic"

/** Who sees ads is decided server-side, never by hiding cards in the client. */
async function resolveEligibility(surface: string) {
  const supabase = createServerClient()
  const { data: settings } = await supabase.from("ad_settings").select("*").eq("id", "default").maybeSingle()
  const enabled = Boolean(settings?.enabled)
  const surfaceOn = isSurfaceEnabled(settings?.surfaces as Record<string, unknown> | undefined, surface)
  const frequency = clampFrequency(
    settings?.frequency_min ?? AD_FREQUENCY_DEFAULT.min,
    settings?.frequency_max ?? AD_FREQUENCY_DEFAULT.max,
  )
  return {
    supabase,
    enabled,
    surfaceOn,
    surfaces: settings?.surfaces as Record<string, unknown> | undefined,
    frequencyMin: frequency.min,
    frequencyMax: frequency.max,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surface = searchParams.get("surface") || "home"
    const { supabase, enabled, surfaceOn, frequencyMin, frequencyMax } = await resolveEligibility(surface)

    // Pro users and Sponsors are always excluded; everyone else (free users,
    // Organization accounts and signed-out visitors) is eligible.
    let eligible = true
    let viewer = null
    const user = await getUserFromRequest(request)
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, is_premium, is_sponsor")
        .eq("id", user.id)
        .maybeSingle()
      viewer = user
      if (profile?.is_premium || profile?.is_sponsor) eligible = false
    }

    return NextResponse.json({
      success: true,
      eligible: enabled && eligible && surfaceOn,
      enabled,
      surface,
      surfaceEnabled: surfaceOn,
      surfaces: AD_SURFACES.map((item) => item.key),
      // Pacing hint for the feed: how many organic posts sit between ads.
      frequencyMin,
      frequencyMax,
      viewer: viewer ? { id: viewer.id } : null,
    })
  } catch (error: any) {
    console.error("ads feed GET:", error)
    return NextResponse.json({ success: true, eligible: false, error: "ad system unavailable" }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const surface = String(body.surface || "home")
    const requested = Math.min(5, Math.max(1, Number(body.count || 1)))
    const { supabase, enabled, surfaceOn } = await resolveEligibility(surface)

    if (!enabled || !surfaceOn) {
      return NextResponse.json({ success: true, ads: [], reason: !enabled ? "ads_disabled" : "surface_disabled" })
    }

    // Eligibility is enforced here as well as in the GET — otherwise a direct
    // POST would hand creatives to a Pro/Sponsor account that GET filters out.
    const user = await getUserFromRequest(request)
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_premium, is_sponsor")
        .eq("id", user.id)
        .maybeSingle()
      if (profile?.is_premium || profile?.is_sponsor) {
        return NextResponse.json({ success: true, ads: [], reason: "not_eligible" })
      }
    }

    const { data: ads, error } = await supabase
      .from("ads")
      .select("id, sponsor_name, headline, description, media_url, media_type, link_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      console.error("ads feed POST:", error.message)
      return NextResponse.json({ success: true, ads: [] })
    }

    // Rotate instead of always serving the newest creative, so a rotation of
    // several ads actually rotates.
    const pool = [...(ads || [])]
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }

    return NextResponse.json({ success: true, ads: pool.slice(0, requested) })
  } catch (error: any) {
    console.error("ads feed POST:", error)
    return NextResponse.json({ success: true, ads: [] })
  }
}
