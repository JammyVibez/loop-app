import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// GET /api/lounge - Pro-only: returns the admin-configured Discord invite
// widget settings. Kept behind auth + is_premium so the invite link isn't
// exposed to non-Pro users via a direct API call.
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium, is_admin")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.is_premium && !profile?.is_admin) {
      return NextResponse.json({ error: "Pro membership required" }, { status: 403 })
    }

    const { data: setting } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "pro_lounge")
      .maybeSingle()

    const value = (setting?.setting_value as { discord_invite_url?: string; enabled?: boolean }) || {}

    return NextResponse.json({
      success: true,
      discord: {
        enabled: Boolean(value.enabled && value.discord_invite_url),
        invite_url: value.discord_invite_url || null,
      },
    })
  } catch (error) {
    console.error("Error fetching lounge settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
