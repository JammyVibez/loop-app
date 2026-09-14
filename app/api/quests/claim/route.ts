import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { type Quest, windowKeyFor, creditQuestRewards, questRateLimit } from "@/lib/quests"
import { nextStreak } from "@/lib/quests-v2"

export const dynamic = "force-dynamic"

const QUEST_XP_PER_CLAIM = 25

/**
 * POST /api/quests/claim — claim a completed quest's rewards.
 * Completion is re-verified server-side; crediting is idempotent per
 * quest+user+window. Also advances the daily streak and awards Quest XP.
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  if (!questRateLimit(user.id, "claim", 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const questId = String(body.quest_id || "")
    if (!questId) return NextResponse.json({ error: "quest_id required" }, { status: 400 })

    const supabase = createServerClient()
    const { data: quest } = await supabase.from("quests").select("*").eq("id", questId).maybeSingle()
    const q = quest as Quest | null
    if (!q) return NextResponse.json({ error: "Quest not found" }, { status: 404 })

    // Verify completion server-side before crediting anything.
    const wk = windowKeyFor(q.cadence)
    const { data: progress } = await supabase
      .from("quest_progress")
      .select("progress_count, completed_at")
      .eq("quest_id", questId)
      .eq("user_id", user.id)
      .eq("window_key", wk)
      .maybeSingle()

    let verified = Boolean(progress?.completed_at)

    // Missions: all configured steps completed?
    if (!verified && q.quest_kind === "mission") {
      const steps = Array.isArray(q.mission_config) ? q.mission_config : []
      if (steps.length > 0) {
        const { data: doneRows } = await supabase
          .from("quest_mission_steps")
          .select("step_index")
          .eq("quest_id", questId)
          .eq("user_id", user.id)
          .not("completed_at", "is", null)
        const done = new Set((doneRows || []).map((r: any) => Number(r.step_index)))
        verified = steps.every((_: unknown, i: number) => done.has(i))
      }
    }

    if (!verified) {
      return NextResponse.json({ error: "Quest not completed yet" }, { status: 400 })
    }

    // Credit rewards (idempotent; caps applied).
    const result = await creditQuestRewards(supabase, q, user.id, "user")
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Claim failed" }, { status: 400 })
    }

    // Award Quest XP (separate from app XP).
    let questXpTotal: number | null = null
    const { data: prevXp } = await supabase
      .from("quest_xp")
      .select("xp")
      .eq("user_id", user.id)
      .maybeSingle()
    questXpTotal = Number(prevXp?.xp || 0) + QUEST_XP_PER_CLAIM
    await supabase.from("quest_xp").upsert({
      user_id: user.id,
      xp: questXpTotal,
      updated_at: new Date().toISOString(),
    })

    // Advance streak when claiming any daily-window quest today.
    let streak: { current: number; increased: boolean } | null = null
    if (q.cadence === "daily") {
      const { data: prev } = await supabase
        .from("quest_streaks")
        .select("current_streak, best_streak, last_day")
        .eq("user_id", user.id)
        .maybeSingle()
      const next = nextStreak({
        current_streak: Number(prev?.current_streak || 0),
        best_streak: Number(prev?.best_streak || 0),
        last_day: prev?.last_day ?? null,
      })
      await supabase.from("quest_streaks").upsert({
        user_id: user.id,
        current_streak: next.current_streak,
        best_streak: next.best_streak,
        last_day: next.last_day,
        updated_at: new Date().toISOString(),
      })
      streak = { current: next.current_streak, increased: next.increased }
    }

    // Collection item grant (limited/seasonal quests with a collection_tag).
    let collectionAwarded: string | null = null
    if (q.collection_tag) {
      const { data: col } = await supabase
        .from("quest_collections")
        .select("id, name")
        .eq("tag", q.collection_tag)
        .maybeSingle()
      if (col) {
        const { error: colErr } = await supabase
          .from("quest_collection_items")
          .insert({ collection_id: col.id, user_id: user.id, quest_id: q.id })
        if (!colErr || colErr.code === "23505") collectionAwarded = col.name
      }
    }

    // Notification: reward added.
    try {
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "quest_reward",
        title: "Reward added",
        message: `Your reward for "${q.title}" is in your wallet.`,
        data: { quest_id: q.id, coins: result.coins, xp: result.xp },
      })
    } catch { /* non-blocking */ }

    return NextResponse.json({
      success: true,
      coins: result.coins,
      xp: result.xp,
      item: result.item,
      new_balance: result.newBalance,
      quest_xp: questXpTotal,
      leveled_up: result.leveledUp,
      streak,
      collection: collectionAwarded,
      capped: result.coins < Number(q.reward_coins || 0),
    })
  } catch (error: any) {
    console.error("POST /api/quests/claim error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
