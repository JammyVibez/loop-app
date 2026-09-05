import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

/**
 * Who sees ads is decided HERE, server-side, never by hiding cards in the
 * client. Pro users and Sponsors are always excluded; everyone else
 * (free users and Organization accounts) is eligible. Guests are eligible
 * like any standard visitor — there's no profile to check, so there's no
 * entitlement to honor either.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()

    // Which surface is asking? Defaults to the home feed; the Developer Hub
    // passes ?surface=developers so ads show there too (unless Pro/Sponsor).
    const { searchParams } = new URL(request.url)
    const surface = searchParams.get("surface") || "home"

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

    // Master switch — checked before the DB round trip.
    const { data: settings } = await supabase.from("ad_settings").select("*").eq("id", "default").maybeSingle()
    const enabled = Boolean(settings?.enabled)
    const surfaces = settings?.surfaces || {}
    // Surfaces are opt-OUT: when ad_settings has no key for a surface it is
    // on by default (admins can disable any surface explicitly). Home remains
    // the canonical default for anything legacy that didn't pass a surface.
    const surfaceOn = surface === "home" ? surfaces.home !== false : surfaces[surface] !== false

    return NextResponse.json({
      success: true,
      eligible: enabled && eligible && surfaceOn,
      enabled,
      surface,
      viewer: viewer ? { id: viewer.id } : null,
    })
  } catch (error: any) {
    console.error("ads feed GET:", error)
    return NextResponse.json({ success: true, eligible: false, error: "ad system unavailable" }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))

    // Session-scoped batch of ads the client will place in the feed.
    const count = Math.min(5, Math.max(1, Number(body.count || 1)))
    const { data: settings } = await supabase.from("ad_settings").select("*").eq("id", "default").maybeSingle()
    if (!settings?.enabled) {
      return NextResponse.json({ success: true, ads: [] })
    }

    const { data: ads } = await supabase
      .from("ads")
      .select("id, sponsor_name, headline, description, media_url, media_type, link_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(count)

    return NextResponse.json({ success: true, ads: ads || [] })
  } catch (error: any) {
    console.error("ads POST:", error)
    return NextResponse.json({ success: true, ads: [] })
  }
}
