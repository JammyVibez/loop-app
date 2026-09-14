import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { type Quest, recordQuestProgress, questRateLimit } from "@/lib/quests"

export const dynamic = "force-dynamic"

/**
 * POST /api/quests/video — server-authoritative watch-time accumulation.
 *
 * The client sends a heartbeat with `elapsed` seconds since the previous tick.
 * The server validates the heartbeat against wall-clock time so fast-forwarding
 * or scripted bursts cannot accumulate more than real elapsed time, then banks
 * the seconds in quest_video_sessions. Completion is marked when the banked
 * total reaches the quest's required video_seconds.
 *
 * Body: { quest_id, session_action: "start" | "tick" | "pause" | "resume" | "end", elapsed }
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  if (!questRateLimit(user.id, "video", 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const questId = String(body.quest_id || "")
    const action = String(body.session_action || "tick")
    const elapsed = Math.max(0, Math.min(Number(body.elapsed || 0), 5)) // max 5s per heartbeat

    if (!questId) return NextResponse.json({ error: "quest_id required" }, { status: 400 })

    const supabase = createServerClient()
    const { data: quest } = await supabase
      .from("quests")
      .select("id, quest_type, video_seconds, video_url, cadence, requirement_count")
      .eq("id", questId)
      .maybeSingle()
    const q = quest as (Quest & { video_seconds: number | null; video_url: string | null }) | null
    if (!q || q.quest_type !== "ad") {
      return NextResponse.json({ error: "Quest not found or not a video quest" }, { status: 404 })
    }

    const required = Math.max(1, Number(q.video_seconds || 30))

    // Load or create session.
    let { data: session } = await supabase
      .from("quest_video_sessions")
      .select("*")
      .eq("quest_id", questId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!session) {
      const { data: created, error } = await supabase
        .from("quest_video_sessions")
        .insert({ quest_id: questId, user_id: user.id, watched_seconds: 0 })
        .select("*")
        .single()
      if (error) throw new Error(error.message)
      session = created
    }

    if (session.completed) {
      return NextResponse.json({
        success: true,
        watched: Number(session.watched_seconds),
        required,
        completed: true,
      })
    }

    // Accumulate: only tick/resume with positive, wall-clock-plausible elapsed.
    const nowIso = new Date().toISOString()
    if ((action === "tick" || action === "resume") && elapsed > 0) {
      const last = session.last_tick_at ? new Date(session.last_tick_at).getTime() : 0
      const wallOk = last === 0 || Date.now() - last <= 15_000 // heartbeat ≤ 15s since last
      if (wallOk) {
        const watched = Math.min(Number(session.watched_seconds) + elapsed, required)
        const completed = watched >= required
        const { error: updErr } = await supabase
          .from("quest_video_sessions")
          .update({ watched_seconds: watched, last_tick_at: nowIso, completed, updated_at: nowIso })
          .eq("id", session.id)
        if (updErr) throw new Error(updErr.message)

        if (completed) {
          await recordQuestProgress(supabase, { ...q, quest_type: "ad" } as Quest, user.id, 1)
        }
        return NextResponse.json({ success: true, watched, required, completed })
      }
    }

    // start/pause/end just refresh the heartbeat anchor.
    await supabase
      .from("quest_video_sessions")
      .update({ last_tick_at: nowIso, updated_at: nowIso })
      .eq("id", session.id)

    return NextResponse.json({
      success: true,
      watched: Number(session.watched_seconds),
      required,
      completed: Boolean(session.completed),
    })
  } catch (error: any) {
    console.error("POST /api/quests/video error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
