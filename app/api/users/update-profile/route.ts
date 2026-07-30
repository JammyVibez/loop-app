import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ECONOMY_DEFAULTS } from "@/lib/economy"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function compactPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  )
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await request.json()
    const {
      bio,
      interests,
      avatar_url,
      banner_url,
      profile_theme,
      appearance_mode,
      onboarding_completed,
      display_name,
      website,
      location,
      phone,
      privacy_settings,
      notification_settings,
    } = body

    // Preserve shop theme_preferences — appearance mode lives on theme_data
    let themeDataUpdate: Record<string, unknown> | undefined
    if (appearance_mode && ["light", "dark", "system"].includes(appearance_mode)) {
      const { data: current } = await supabase
        .from("profiles")
        .select("theme_data")
        .eq("id", user.id)
        .maybeSingle()
      const existing =
        current?.theme_data && typeof current.theme_data === "object" ? (current.theme_data as object) : {}
      themeDataUpdate = { ...existing, mode: appearance_mode, updated_at: new Date().toISOString() }
    }

    const payload = compactPayload({
      bio,
      interests,
      avatar_url: avatar_url === undefined ? undefined : avatar_url || null,
      banner_url: banner_url === undefined ? undefined : banner_url || null,
      display_name: typeof display_name === "string" ? display_name.trim() : undefined,
      website: website === undefined ? undefined : website || null,
      location: location === undefined ? undefined : location || null,
      phone: phone === undefined ? undefined : phone || null,
      privacy_settings,
      notification_settings,
      onboarding_completed: typeof onboarding_completed === "boolean" ? onboarding_completed : undefined,
      updated_at: new Date().toISOString(),
      // Only write theme_preferences when explicitly sending a shop theme payload (has colors)
      ...(profile_theme !== undefined && profile_theme?.colors
        ? { theme_preferences: profile_theme }
        : {}),
      ...(themeDataUpdate ? { theme_data: themeDataUpdate } : {}),
    })

    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("*")
      .maybeSingle()

    for (const optionalColumn of ["theme_preferences", "theme_data", "interests", "phone", "privacy_settings", "notification_settings", "banner_url"]) {
      if (profileError?.code === "PGRST204" && optionalColumn in payload) {
        delete payload[optionalColumn]
        ;({ data: profile, error: profileError } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", user.id)
          .select("*")
          .maybeSingle())
      }
    }

    if (!profileError && !profile) {
      const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle()
      if (!existing) {
        const username =
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          `user_${user.id.slice(0, 8)}`
        const displayName =
          (typeof display_name === "string" && display_name.trim()) ||
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          username

        ;({ data: profile, error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              email: user.email,
              username,
              display_name: displayName,
              loop_coins: ECONOMY_DEFAULTS.signup_bonus,
              is_premium: false,
              is_verified: false,
              is_admin: false,
              privacy_settings: privacy_settings || { profile_visibility: "public", message_privacy: "everyone" },
              notification_settings: notification_settings || { email: true, push: true, in_app: true },
              onboarding_completed: false,
              ...payload,
            },
            { onConflict: "id" },
          )
          .select("*")
          .maybeSingle())
      }
    }

    if (profileError) {
      console.error("Profile update error:", profileError)
      return NextResponse.json({ error: profileError.message || "Failed to update profile" }, { status: 500 })
    }

    if (onboarding_completed === true && profile && profile.onboarding_completed !== true) {
      const { data: forced, error: forceError } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select("*")
        .maybeSingle()

      if (forceError) {
        return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 })
      }
      profile = forced || { ...profile, onboarding_completed: true }
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found after update" }, { status: 500 })
    }

    return NextResponse.json({
      message: "Profile updated successfully",
      profile,
    })
  } catch (error) {
    console.error("Update profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
