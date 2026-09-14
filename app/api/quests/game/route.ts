import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { type Quest, recordQuestProgress, questRateLimit } from "@/lib/quests"

export const dynamic = "force-dynamic"

/**
 * GET /api/quests/game?quest_id=<uuid> — start a game attempt.
 * Memory: returns a server-generated emoji sequence to memorize.
 * Trivia/reaction quests keep using /api/quests/minigame.
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  if (!questRateLimit(user.id, "game", 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const questId = new URL(request.url).searchParams.get("quest_id") || ""
    const supabase = createServerClient()
    const { data: quest } = await supabase
      .from("quests")
      .select("id, quest_type, minigame_kind, game_config")
      .eq("id", questId)
      .maybeSingle()
    const q = quest as (Quest & { game_config: any }) | null
    if (!q || q.quest_type !== "minigame") {
      return NextResponse.json({ error: "Game quest not found" }, { status: 404 })
    }

    const kind = (q.minigame_kind === "reaction" ? "reaction" : q.minigame_kind === "trivia" ? "trivia" : "memory") as
      | "memory"
      | "trivia"
      | "reaction"

    if (kind === "memory") {
      // Server-generated sequence, 6 emojis, hidden after 3s client-side.
      const pool = ["triangle", "circle", "square", "diamond", "star", "hexagon", "cross", "moon"]
      const seq: number[] = []
      for (let i = 0; i < 6; i++) seq.push(Math.floor(Math.random() * pool.length))
      const { error } = await supabase.from("quest_game_attempts").insert({
        quest_id: questId,
        user_id: user.id,
        kind,
        token: seq.join(","),
      })
      if (error) throw new Error(error.message)
      const { data: attempt } = await supabase
        .from("quest_game_attempts")
        .select("id")
        .eq("quest_id", questId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      return NextResponse.json({ success: true, kind, attempt_id: attempt?.id, symbols: pool, sequence: seq })
    }

    if (kind === "reaction") {
      // 5 rounds; client reports reaction times; server clamps + verifies plausibility on POST.
      const { error } = await supabase.from("quest_game_attempts").insert({
        quest_id: questId,
        user_id: user.id,
        kind,
        token: "",
      })
      if (error) throw new Error(error.message)
      const { data: attempt } = await supabase
        .from("quest_game_attempts")
        .select("id")
        .eq("quest_id", questId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      return NextResponse.json({ success: true, kind, attempt_id: attempt?.id, rounds: 5 })
    }

    // Trivia falls back to the minigame endpoint's question bank.
    return NextResponse.json({ success: true, kind: "trivia", redirect: "/api/quests/minigame" })
  } catch (error: any) {
    console.error("GET /api/quests/game error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/quests/game — submit a game result against the server attempt.
 * Memory: { attempt_id, solution } — order must match the generated sequence.
 * Reaction: { attempt_id, times } — 5 plausible reaction times (200ms–2000ms).
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  if (!questRateLimit(user.id, "game", 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const attemptId = String(body.attempt_id || "")
    if (!attemptId) return NextResponse.json({ error: "attempt_id required" }, { status: 400 })

    const supabase = createServerClient()
    const { data: attempt } = await supabase
      .from("quest_game_attempts")
      .select("*")
      .eq("id", attemptId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    if (attempt.completed_at) return NextResponse.json({ error: "Attempt already submitted" }, { status: 400 })

    const { data: quest } = await supabase
      .from("quests")
      .select("*")
      .eq("id", attempt.quest_id)
      .maybeSingle()
    const q = quest as Quest | null
    if (!q) return NextResponse.json({ error: "Quest not found" }, { status: 404 })

    let passed = false
    let score = 0

    if (attempt.kind === "memory") {
      const solution = String(body.solution || "")
      passed = solution === String(attempt.token)
      score = passed ? 100 : 0
    } else if (attempt.kind === "reaction") {
      const times = Array.isArray(body.times) ? body.times.map((t: unknown) => Number(t)) : []
      if (times.length !== 5 || times.some((t: number) => !Number.isFinite(t) || t < 120 || t > 3000)) {
        return NextResponse.json({ error: "Invalid reaction times" }, { status: 400 })
      }
      const avg = times.reduce((a: number, b: number) => a + b, 0) / times.length
      score = Math.max(0, Math.min(100, Math.round(2000 - avg)))
      const minScore = Number((q as any).game_config?.min_score || 0)
      passed = avg <= 600 // solid human performance
      if (minScore > 0) passed = score >= minScore
    }

    await supabase
      .from("quest_game_attempts")
      .update({ completed_at: new Date().toISOString(), passed, score })
      .eq("id", attemptId)

    if (passed) {
      await recordQuestProgress(supabase, q, user.id, 1)
    }

    return NextResponse.json({ success: true, passed, score })
  } catch (error: any) {
    console.error("POST /api/quests/game error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
