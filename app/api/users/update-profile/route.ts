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
    
    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await request.json()
    const { bio, interests, avatar_url, profile_theme, onboarding_completed } = body

    const payload = compactPayload({
      bio,
      interests,
      avatar_url: avatar_url || null,
      onboarding_completed: typeof onboarding_completed === "boolean" ? onboarding_completed : undefined,
      updated_at: new Date().toISOString(),
      ...(profile_theme !== undefined ? { theme_data: profile_theme } : {}),
    })

    // Update profile
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("*")
      .maybeSingle()

    // Some DB versions may not have newer onboarding columns yet; retry without them.
    // Never drop onboarding_completed during retries.
    for (const optionalColumn of ["theme_data", "interests"]) {
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

    // No row updated (missing profile) — upsert a minimal profile with the changes.
    if (!profileError && !profile) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle()

      if (!existing) {
        const username =
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          `user_${user.id.slice(0, 8)}`
        const displayName =
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
              privacy_settings: { profile_visibility: "public", message_privacy: "everyone" },
              notification_settings: { email: true, push: true, in_app: true },
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
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
    }

    // Hard-guarantee onboarding completion even if a partial/compat update missed it.
    if (onboarding_completed === true && profile && profile.onboarding_completed !== true) {
      const { data: forced, error: forceError } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select("*")
        .maybeSingle()

      if (forceError) {
        console.error("Failed to force onboarding_completed:", forceError)
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
