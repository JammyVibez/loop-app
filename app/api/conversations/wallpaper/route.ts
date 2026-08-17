import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const WALLPAPER_LIMITS = {
  preset: (v: unknown) => typeof v === "string" && v.length <= 40,
  image_url: (v: unknown) => typeof v === "string" && v.length <= 500,
  overlay: (v: unknown) => v === null || (typeof v === "number" && v >= 0 && v <= 0.7),
}

function sanitizeWallpaper(input: any) {
  const wallpaper: Record<string, unknown> = {}
  if (input?.preset && WALLPAPER_LIMITS.preset(input.preset)) wallpaper.preset = input.preset
  if (input?.image_url && WALLPAPER_LIMITS.image_url(input.image_url)) wallpaper.image_url = input.image_url
  if (input?.overlay !== undefined) {
    const overlay = input.overlay === null ? null : Number(input.overlay)
    if (overlay === null || (typeof overlay === "number" && !Number.isNaN(overlay) && overlay >= 0 && overlay <= 0.7)) {
      wallpaper.overlay = overlay
    }
  }
  return wallpaper
}

/** GET /api/conversations/wallpaper?conversation_id=… → the user's wallpaper for that chat */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const conversationId = request.nextUrl.searchParams.get("conversation_id")
    if (!conversationId) return NextResponse.json({ error: "conversation_id is required" }, { status: 400 })

    const supabase = createServerClient()

    // Only the user's own row — never someone else's wallpaper.
    const { data } = await supabase
      .from("conversation_settings")
      .select("wallpaper")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle()

    return NextResponse.json({ wallpaper: data?.wallpaper || {} })
  } catch (error: any) {
    console.error("conversation wallpaper GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** PUT /api/conversations/wallpaper — body { conversation_id, wallpaper } */
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const conversationId = String(body.conversation_id || "")
    if (!conversationId) return NextResponse.json({ error: "conversation_id is required" }, { status: 400 })

    const wallpaper = sanitizeWallpaper(body.wallpaper)

    const supabase = createServerClient()

    // Verify the user is a participant of this conversation before touching settings.
    const { data: member } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!member) return NextResponse.json({ error: "You're not a member of this conversation" }, { status: 403 })

    const { error } = await supabase
      .from("conversation_settings")
      .upsert(
        { conversation_id: conversationId, user_id: user.id, wallpaper, updated_at: new Date().toISOString() },
        { onConflict: "conversation_id,user_id" },
      )

    if (error) {
      console.error("conversation wallpaper upsert error:", error)
      return NextResponse.json({ error: "Failed to save wallpaper" }, { status: 500 })
    }

    return NextResponse.json({ success: true, wallpaper })
  } catch (error: any) {
    console.error("conversation wallpaper PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}