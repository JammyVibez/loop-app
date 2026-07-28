import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      profile_theme,
      onboarding_completed,
      display_name,
      website,
      location,
      phone,
      privacy_settings,
      notification_settings,
    } = body

    const payload = compactPayload({
      bio,
      interests,
      avatar_url: avatar_url === undefined ? undefined : avatar_url || null,
      display_name: typeof display_name === "string" ? display_name.trim() : undefined,
      website: website === undefined ? undefined : website || null,
      location: location === undefined ? undefined : location || null,
      phone: phone === undefined ? undefined : phone || null,
      privacy_settings,
      notification_settings,
      onboarding_completed: typeof onboarding_completed === "boolean" ? onboarding_completed : undefined,
      updated_at: new Date().toISOString(),
      ...(profile_theme !== undefined ? { theme_preferences: profile_theme } : {}),
    })

    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("*")
      .maybeSingle()

    for (const optionalColumn of ["theme_preferences", "interests", "phone", "privacy_settings", "notification_settings"]) {
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
              loop_coins: 500,
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
