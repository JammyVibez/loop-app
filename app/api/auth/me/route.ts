import { type NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()
    const selects = [
      "id, email, username, display_name, avatar_url, video_avatar_url, banner_url, video_cover_url, bio, tagged_circles, loop_coins, is_premium, premium_expires_at, is_verified, is_admin, theme_data, theme_preferences, active_theme, active_cosmetics, cosmetics, level, xp_points, available_earnings, interests, onboarding_completed, location, website, phone, privacy_settings, notification_settings",
      "id, email, username, display_name, avatar_url, video_avatar_url, banner_url, video_cover_url, bio, tagged_circles, loop_coins, is_premium, premium_expires_at, is_verified, is_admin, theme_data, theme_preferences, cosmetics, interests, onboarding_completed, location, website, phone, privacy_settings, notification_settings",
      "id, email, username, display_name, avatar_url, video_avatar_url, banner_url, video_cover_url, bio, loop_coins, is_premium, premium_expires_at, is_verified, is_admin, theme_data, theme_preferences, cosmetics, interests, onboarding_completed, location, website, phone, privacy_settings, notification_settings",
      "id, email, username, display_name, avatar_url, video_avatar_url, banner_url, bio, loop_coins, is_premium, premium_expires_at, is_verified, is_admin, interests, onboarding_completed, location, website",
    ]

    let profile: any = null
    let lastError: any = null
    for (const select of selects) {
      const { data, error } = await supabase.from("profiles").select(select).eq("id", user.id).maybeSingle()
      if (!error && data) {
        profile = data
        break
      }
      lastError = error
    }

    if (!profile) {
      // Never forward raw Postgres/PostgREST error text (e.g. "Invalid JWT
      // structure" from a misconfigured SUPABASE_SERVICE_ROLE_KEY) to the
      // client — log it server-side and return a safe generic message.
      if (lastError) console.error("auth/me profile lookup failed:", lastError)
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, profile })
  } catch (error: any) {
    console.error("auth/me error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
