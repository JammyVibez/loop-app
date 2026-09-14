import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { type Quest, windowKeyFor, questRateLimit } from "@/lib/quests"

export const dynamic = "force-dynamic"

/**
 * POST /api/quests/start — user accepts a quest.
 * Creates the per-window progress row and increments the start counter.
 * Idempotent: starting twice is a no-op.
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  if (!questRateLimit(user.id, "start", 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const questId = String(body.quest_id || "")
    if (!questId) return NextResponse.json({ error: "quest_id required" }, { status: 400 })

    const supabase = createServerClient()
    const { data: quest } = await supabase.from("quests").select("*").eq("id", questId).maybeSingle()
    const q = quest as Quest | null
    if (!q || (!q.is_active && q.status !== "active")) {
      return NextResponse.json({ error: "Quest not available" }, { status: 404 })
    }

    const wk = windowKeyFor(q.cadence)
    const { data: existing } = await supabase
      .from("quest_progress")
      .select("id, progress_count")
      .eq("quest_id", questId)
      .eq("user_id", user.id)
      .eq("window_key", wk)
      .maybeSingle()

    if (!existing) {
      const { error } = await supabase.from("quest_progress").insert({
        quest_id: questId,
        user_id: user.id,
        window_key: wk,
        progress_count: 0,
      })
      if (error && error.code !== "23505") throw new Error(error.message) // unique = concurrent start
    }

    // Analytics counter.
    const { data: cur } = await supabase.from("quests").select("total_starts").eq("id", questId).maybeSingle()
    await supabase
      .from("quests")
      .update({ total_starts: Number((cur as any)?.total_starts || 0) + 1 })
      .eq("id", questId)

    return NextResponse.json({ success: true, started: true })
  } catch (error: any) {
    console.error("POST /api/quests/start error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
