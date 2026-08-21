import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { ECONOMY_DEFAULTS } from "@/lib/economy"
import { sanitizeTaggedCircles } from "@/lib/circle-limits"
import { getUserFromRequest } from "@/lib/server-auth"
import { isProUser } from "@/lib/pro-features"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

function compactPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  )
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Animated GIF avatars/covers are a Pro-only perk. Enforce server-side so
    // non-Pro users can't set (or keep) a GIF by calling the API directly.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("is_premium, premium_expires_at")
      .eq("id", user.id)
      .maybeSingle()
    const viewerIsPro = isProUser(profileRow as any)
    const looksLikeGif = (url?: unknown) =>
      typeof url === "string" && /\.gif(\?|#|$)/i.test(url.trim())
    const avatarIsGif = looksLikeGif(body.avatar_url)
    const bannerIsGif = looksLikeGif(body.banner_url)
    if ((avatarIsGif || bannerIsGif) && !viewerIsPro) {
      return NextResponse.json(
        {
          error: "Animated GIF profile pictures and covers are a Pro perk — upgrade to Pro to use them.",
          pro_required: true,
          gif_field: avatarIsGif ? "avatar_url, video_avatar_url" : "banner_url",
        },
        { status: 403 },
      )
    }

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
      tagged_circles,
      username: newUsername,
    } = body

    // --- Username change: uniqueness + 2-week cooldown ---
    let validatedUsername: string | undefined
    if (typeof newUsername === "string" && newUsername.trim()) {
      const sanitized = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")
      if (sanitized.length < 3) {
        return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 })
      }
      if (sanitized.length > 20) {
        return NextResponse.json({ error: "Username must be 20 characters or fewer." }, { status: 400 })
      }

      // Fetch current profile to check cooldown + detect actual change
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("username, username_change_at")
        .eq("id", user.id)
        .maybeSingle()

      if (currentProfile && sanitized !== currentProfile.username) {
        // Check cooldown: last change must be ≥ 14 days ago
        if (currentProfile.username_change_at) {
          const lastChange = new Date(currentProfile.username_change_at).getTime()
          const cooldownMs = 14 * 24 * 60 * 60 * 1000
          const remainingMs = cooldownMs - (Date.now() - lastChange)
          if (remainingMs > 0) {
            const daysLeft = Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
            return NextResponse.json(
              { error: `You can change your username again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`, cooldown_days: daysLeft },
              { status: 429 },
            )
          }
        }

        // Check uniqueness
        const { data: taken } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", sanitized)
          .neq("id", user.id)
          .maybeSingle()
        if (taken) {
          return NextResponse.json({ error: "That username is already taken. Please choose another." }, { status: 409 })
        }

        validatedUsername = sanitized
      } else if (currentProfile && sanitized === currentProfile.username) {
        // No actual change — skip
      }
    }

    let sanitizedTags: ReturnType<typeof sanitizeTaggedCircles> | undefined
    if (tagged_circles !== undefined) {
      sanitizedTags = sanitizeTaggedCircles(tagged_circles)
      // Only allow tagging communities the user belongs to (or owns)
      if (sanitizedTags.length > 0) {
        const ids = sanitizedTags.map((t) => t.id)
        const { data: memberships } = await supabase
          .from("circle_members")
          .select("circle_id, status")
          .eq("user_id", user.id)
          .in("circle_id", ids)
        const allowed = new Set(
          (memberships || [])
            .filter((m) => ["active", "approved"].includes(String(m.status || "active").toLowerCase()) || !m.status)
            .map((m) => m.circle_id),
        )
        // Also allow if they own the circle without a membership row
        const { data: owned } = await supabase
          .from("circles")
          .select("id, name, avatar_url")
          .or(`owner_id.eq.${user.id},creator_id.eq.${user.id}`)
          .in("id", ids)
        ;(owned || []).forEach((c) => allowed.add(c.id))

        const { data: circleRows } = await supabase
          .from("circles")
          .select("id, name, avatar_url, is_active")
          .in("id", ids)
          .eq("is_active", true)

        const byId = new Map((circleRows || []).map((c) => [c.id, c]))
        sanitizedTags = sanitizedTags
          .filter((t) => allowed.has(t.id) && byId.has(t.id))
          .map((t) => ({
            id: t.id,
            name: byId.get(t.id)?.name || t.name,
            avatar_url: byId.get(t.id)?.avatar_url || t.avatar_url || null,
          }))
      }
    }

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
      tagged_circles: sanitizedTags,
      onboarding_completed: typeof onboarding_completed === "boolean" ? onboarding_completed : undefined,
      ...(validatedUsername ? { username: validatedUsername, username_change_at: new Date().toISOString() } : {}),
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

    for (const optionalColumn of ["theme_preferences", "theme_data", "interests", "phone", "privacy_settings", "notification_settings", "banner_url", "tagged_circles"]) {
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
          user.name ||
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
