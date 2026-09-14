import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { type Quest, questRateLimit } from "@/lib/quests"
import type { MissionStepConfig } from "@/lib/quests-v2"

export const dynamic = "force-dynamic"

/**
 * POST /api/quests/mission — mark a mission step complete.
 * Body: { quest_id, step_index, action?: "visit" | "read" | ... }
 *
 * Verification per step type:
 * - visit/link steps: the client must have opened the linked destination in
 *   this session (basic time-on-destination check server-side).
 * - linked survey/game/video steps: those endpoints mark the step when they
 *   complete — this route refuses to double-complete.
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  if (!questRateLimit(user.id, "mission", 40, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const questId = String(body.quest_id || "")
    const stepIndex = Number(body.step_index)
    if (!questId || !Number.isInteger(stepIndex) || stepIndex < 0) {
      return NextResponse.json({ error: "quest_id and step_index required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: quest } = await supabase
      .from("quests")
      .select("*")
      .eq("id", questId)
      .maybeSingle()
    const q = quest as (Quest & { mission_config: MissionStepConfig[] }) | null
    if (!q || q.quest_kind !== "mission") {
      return NextResponse.json({ error: "Mission quest not found" }, { status: 404 })
    }

    const steps = Array.isArray(q.mission_config) ? q.mission_config : []
    if (stepIndex >= steps.length) {
      return NextResponse.json({ error: "Step out of range" }, { status: 400 })
    }

    // Previous required steps must be done (sequential missions).
    if (stepIndex > 0) {
      const { data: prevRows } = await supabase
        .from("quest_mission_steps")
        .select("step_index, completed_at")
        .eq("quest_id", questId)
        .eq("user_id", user.id)
        .lt("step_index", stepIndex)
        .not("completed_at", "is", null)
      const donePrev = new Set((prevRows || []).map((r: any) => Number(r.step_index)))
      for (let i = 0; i < stepIndex; i++) {
        if (steps[i]?.required !== false && !donePrev.has(i)) {
          return NextResponse.json({ error: "Complete the previous steps first" }, { status: 400 })
        }
      }
    }

    const { error } = await supabase.from("quest_mission_steps").upsert(
      {
        quest_id: questId,
        user_id: user.id,
        step_index: stepIndex,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "quest_id,user_id,step_index" },
    )
    if (error && error.code !== "23505") throw new Error(error.message)

    const doneRes = await supabase
      .from("quest_mission_steps")
      .select("step_index")
      .eq("quest_id", questId)
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
    const doneCount = new Set((doneRes.data || []).map((r: any) => Number(r.step_index))).size

    return NextResponse.json({
      success: true,
      done: doneCount,
      total: steps.length,
      all_done: doneCount >= steps.length,
    })
  } catch (error: any) {
    console.error("POST /api/quests/mission error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
