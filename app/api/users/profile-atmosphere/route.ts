import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { normalizeProfilePostView, safeThemeAssetUrl } from "@/lib/profile-theme"

/**
 * Owner-only profile atmosphere: the background picture, the soundtrack and
 * the default post presentation visitors see.
 *
 * Everything lives inside `profiles.theme_preferences` alongside the shop
 * theme payload, so equipping a theme and editing these settings share one
 * row — the merge here preserves whatever else that object holds (chat
 * wallpaper, appearance hints) instead of replacing it.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid atmosphere update." }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: current, error: readError } = await supabase
      .from("profiles")
      .select("theme_preferences")
      .eq("id", user.id)
      .maybeSingle()

    if (readError) {
      return NextResponse.json({ error: "Could not load your profile settings." }, { status: 500 })
    }

    const existing =
      current?.theme_preferences && typeof current.theme_preferences === "object" && !Array.isArray(current.theme_preferences)
        ? ({ ...(current.theme_preferences as Record<string, unknown>) } as Record<string, unknown>)
        : {}

    const patch: Record<string, unknown> = {}

    const readUrl = (key: string) => {
      if (!Object.prototype.hasOwnProperty.call(body, key)) return undefined
      const raw = (body as Record<string, unknown>)[key]
      if (raw === null || raw === "") return ""
      const url = safeThemeAssetUrl(raw)
      if (!url) throw new Error("Use an https link or a Loop-hosted image for that asset.")
      return url
    }

    try {
      const background = readUrl("profile_background")
      if (background !== undefined) patch.profile_background = background || null

      const audio = readUrl("profile_audio")
      if (audio !== undefined) patch.profile_audio = audio || null

      if (Object.prototype.hasOwnProperty.call(body, "profile_audio_title")) {
        const title = typeof body.profile_audio_title === "string" ? body.profile_audio_title.trim().slice(0, 80) : ""
        patch.profile_audio_title = title || null
      }

      if (Object.prototype.hasOwnProperty.call(body, "profile_audio_enabled")) {
        patch.profile_audio_enabled = Boolean(body.profile_audio_enabled)
      }
      if (Object.prototype.hasOwnProperty.call(body, "profile_audio_autoplay")) {
        patch.profile_audio_autoplay = Boolean(body.profile_audio_autoplay)
      }
      if (Object.prototype.hasOwnProperty.call(body, "profile_post_view")) {
        patch.profile_post_view = normalizeProfilePostView(body.profile_post_view)
      }
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid atmosphere settings." },
        { status: 400 },
      )
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    }

    // A soundtrack needs a source before it can be switched on.
    const nextAudio = "profile_audio" in patch ? patch.profile_audio : existing.profile_audio
    if (patch.profile_audio_enabled === true && !safeThemeAssetUrl(nextAudio)) {
      return NextResponse.json(
        { error: "Add a soundtrack first, then switch the profile sound on." },
        { status: 400 },
      )
    }

    const themePreferences = { ...existing, ...patch }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ theme_preferences: themePreferences, updated_at: new Date().toISOString() })
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json({ error: "Could not save your profile atmosphere." }, { status: 500 })
    }

    return NextResponse.json({ success: true, theme_preferences: themePreferences })
  } catch (error) {
    console.error("Profile atmosphere update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
