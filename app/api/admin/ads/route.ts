import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { AD_FREQUENCY_DEFAULT, AD_SURFACES, clampFrequency } from "@/lib/ads"

export const dynamic = "force-dynamic"

// Every known placement starts on, matching what the API serves when a
// surface key is absent from ad_settings. Keep this in lockstep with lib/ads.ts
// so the toggles an admin sees are the surfaces the app renders.
const DEFAULT_SURFACES: Record<string, boolean> = Object.fromEntries(
  AD_SURFACES.map((surface) => [surface.key, true]),
)

export async function GET(_request: NextRequest) {
  try {
    const { response } = await requireAdmin(_request)
    if (response) return response
    const supabase = createServerClient()

    const [adsRes, settingsRes] = await Promise.all([
      supabase.from("ads").select("*").order("created_at", { ascending: false }),
      supabase.from("ad_settings").select("*").eq("id", "default").maybeSingle(),
    ])

    if (adsRes.error) return NextResponse.json({ error: adsRes.error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      ads: adsRes.data || [],
      settings: {
        enabled: Boolean(settingsRes.data?.enabled),
        // Fall back to the shared default, not a local one — a stale 50–70 here
        // made the admin panel report a pacing the public feed never used.
        frequency_min: Number(settingsRes.data?.frequency_min ?? AD_FREQUENCY_DEFAULT.min),
        frequency_max: Number(settingsRes.data?.frequency_max ?? AD_FREQUENCY_DEFAULT.max),
        surfaces: settingsRes.data?.surfaces || DEFAULT_SURFACES,
      },
    })
  } catch (error: any) {
    console.error("admin ads GET:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))

    // Settings update path
    if (body.type === "settings" || body.settings) {
      const patch = body.settings || body
      const { data: current } = await supabase.from("ad_settings").select("*").eq("id", "default").maybeSingle()
      const frequency = clampFrequency(
        patch.frequency_min ?? current?.frequency_min ?? AD_FREQUENCY_DEFAULT.min,
        patch.frequency_max ?? current?.frequency_max ?? AD_FREQUENCY_DEFAULT.max,
      )
      const next = {
        enabled: typeof patch.enabled === "boolean" ? patch.enabled : Boolean(current?.enabled),
        frequency_min: frequency.min,
        frequency_max: frequency.max,
        surfaces: patch.surfaces || current?.surfaces || DEFAULT_SURFACES,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from("ad_settings")
        .upsert({ id: "default", ...next }, { onConflict: "id" })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({
        success: true,
        settings: {
          enabled: Boolean(data.enabled),
          frequency_min: Number(data.frequency_min),
          frequency_max: Number(data.frequency_max),
          surfaces: data.surfaces,
        },
      })
    }

    // Ad creation path
    const sponsorName = String(body.sponsor_name || "").trim()
    const headline = String(body.headline || "").trim()
    const linkUrl = String(body.link_url || "").trim()
    if (!sponsorName || !headline || !linkUrl) {
      return NextResponse.json({ error: "sponsor_name, headline, and link_url are required" }, { status: 400 })
    }

    const { data: ad, error } = await supabase
      .from("ads")
      .insert({
        sponsor_name: sponsorName,
        headline,
        description: String(body.description || "").trim() || null,
        media_url: String(body.media_url || "").trim() || null,
        media_type: body.media_url ? String(body.media_type || "image") : null,
        link_url: linkUrl,
        is_active: body.is_active !== false,
        impressions: 0,
        clicks: 0,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, ad, message: `Ad created for ${ad.sponsor_name}`, admin_id: user.id })
  } catch (error: any) {
    console.error("admin ads POST:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
