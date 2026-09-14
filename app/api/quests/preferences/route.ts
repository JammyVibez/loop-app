import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { questRateLimit } from "@/lib/quests"

export const dynamic = "force-dynamic"

/**
 * POST /api/quests/preferences — hide a specific quest or a whole category.
 * Body: { quest_id?: string, hide_category?: string }
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  if (!questRateLimit(user.id, "prefs", 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const questId = body.quest_id ? String(body.quest_id) : null
    const category = body.hide_category ? String(body.hide_category) : null
    if (!questId && !category) {
      return NextResponse.json({ error: "quest_id or hide_category required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { error } = await supabase.from("quest_preferences").insert({
      user_id: user.id,
      quest_id: questId,
      hide_category: category,
    })
    if (error && error.code !== "23505") throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("POST /api/quests/preferences error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
