import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { CHAT_WALLPAPER_PRESETS, type ChatWallpaper } from "@/lib/chat-wallpapers"

export const dynamic = "force-dynamic"

async function getUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
  if (!token) return null
  const supabase = createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return { supabase, user }
}

/** Chat wallpaper is stored inside profiles.theme_preferences (jsonb) so no
 *  schema migration is needed — merge with the existing theme object. */
export async function GET(request: NextRequest) {
  const ctx = await getUser(request)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { supabase, user } = ctx

  const { data: profile } = await supabase
    .from("profiles")
    .select("theme_preferences")
    .eq("id", user.id)
    .maybeSingle()

  const themePrefs = (profile?.theme_preferences || {}) as Record<string, unknown>
  const wallpaper = (themePrefs.chat_wallpaper || {}) as ChatWallpaper
  return NextResponse.json({ success: true, wallpaper })
}

export async function PUT(request: NextRequest) {
  const ctx = await getUser(request)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { supabase, user } = ctx

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const preset = typeof body.preset === "string" ? body.preset : null
  const imageUrl = typeof body.image_url === "string" ? body.image_url.slice(0, 2000) : null
  const overlay = typeof body.overlay === "number" ? Math.min(0.7, Math.max(0, body.overlay)) : null

  // Validate preset id against the known list (or allow null = default).
  if (preset && !CHAT_WALLPAPER_PRESETS.some((p) => p.id === preset)) {
    return NextResponse.json({ error: "Unknown wallpaper preset" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("theme_preferences")
    .eq("id", user.id)
    .maybeSingle()

  const themePrefs = (profile?.theme_preferences || {}) as Record<string, unknown>
  const nextWallpaper: ChatWallpaper = {}
  if (preset) nextWallpaper.preset = preset
  if (imageUrl) nextWallpaper.image_url = imageUrl
  if (overlay !== null) nextWallpaper.overlay = overlay
  if (!preset && !imageUrl) {
    // Explicit reset to the default chat background.
    nextWallpaper.preset = null
    nextWallpaper.image_url = null
    nextWallpaper.overlay = null
  }

  const { error } = await supabase
    .from("profiles")
    .update({ theme_preferences: { ...themePrefs, chat_wallpaper: nextWallpaper } })
    .eq("id", user.id)

  if (error) {
    console.error("wallpaper update error:", error)
    return NextResponse.json({ error: "Could not save wallpaper" }, { status: 500 })
  }

  return NextResponse.json({ success: true, wallpaper: nextWallpaper })
}
