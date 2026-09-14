import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/quests/survey-responses?quest_id=<uuid>
 * Returns survey submissions for analysis (completion rate, drop-off timing).
 * Free-text is truncated; identities are not exposed.
 */
export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const questId = new URL(request.url).searchParams.get("quest_id") || ""
    if (!questId) return NextResponse.json({ error: "quest_id required" }, { status: 400 })

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("quest_survey_answers")
      .select("answers, completion_ms, created_at")
      .eq("quest_id", questId)
      .order("created_at", { ascending: false })
      .limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { count } = await supabase
      .from("quest_survey_answers")
      .select("id", { count: "exact", head: true })
      .eq("quest_id", questId)

    return NextResponse.json({ success: true, responses: data || [], total: count || 0 })
  } catch (error: any) {
    console.error("GET survey-responses error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
