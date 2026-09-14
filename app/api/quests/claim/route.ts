import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { type Quest, windowKeyFor, questRateLimit, creditQuestRewards } from "@/lib/quests"

export const dynamic = "force-dynamic"

/**
 * POST /api/quests/claim — claim a completed quest's reward.
 * Body: { quest_id }
 * Server-side verifies completion before crediting; applies daily caps,
 * rate limits, and idempotency (double-claims are rejected).
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

  if (!questRateLimit(user.id, "claim", 10, 60_000)) {
    return NextResponse.json({ error: "Too many claim attempts — slow down" }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const questId = String(body.quest_id || "")
    if (!questId) return NextResponse.json({ error: "quest_id is required" }, { status: 400 })

    const supabase = createServerClient()

    const { data: quest, error: questError } = await supabase
      .from("quests")
      .select("*")
      .eq("id", questId)
      .eq("is_active", true)
      .maybeSingle()

    if (questError) return NextResponse.json({ error: questError.message }, { status: 500 })
    if (!quest) return NextResponse.json({ error: "Quest not found or inactive" }, { status: 404 })

    const q = quest as Quest
    const wk = windowKeyFor(q.cadence)

    // Seasonal window check.
    const now = new Date()
    if (q.cadence === "seasonal") {
      if (q.starts_at && new Date(q.starts_at) > now)
        return NextResponse.json({ error: "This quest hasn't started yet" }, { status: 400 })
      if (q.ends_at && new Date(q.ends_at) < now)
        return NextResponse.json({ error: "This quest has ended" }, { status: 400 })
    }

    // Verify completion server-side (never trust the client).
    const { data: progress } = await supabase
      .from("quest_progress")
      .select("progress_count, completed_at")
      .eq("quest_id", questId)
      .eq("user_id", user.id)
      .eq("window_key", wk)
      .maybeSingle()

    const required = Math.max(1, Number(q.requirement_count || 1))
    const count = Number(progress?.progress_count || 0)
    if (!progress || count < required) {
      return NextResponse.json(
        { error: "Quest not completed yet", progress: { count, required } },
        { status: 400 },
      )
    }

    // For repeatable quests, allow re-claim after re-completing: a claim exists
    // but progress has advanced past the last claim. Track via claimed ledger count.
    const { data: claimRows } = await supabase
      .from("quest_claims")
      .select("id")
      .eq("quest_id", questId)
      .eq("user_id", user.id)
      .eq("window_key", wk)
    const claimsSoFar = (claimRows || []).length
    const maxCompletions = Math.max(1, Number(q.max_completions_per_user || 1))
    if (claimsSoFar >= maxCompletions) {
      return NextResponse.json({ error: "Already claimed for this period" }, { status: 400 })
    }

    const result = await creditQuestRewards(supabase, q, user.id, "user")
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    // Mark progress claimed.
    await supabase
      .from("quest_progress")
      .update({ claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("quest_id", questId)
      .eq("user_id", user.id)
      .eq("window_key", wk)

    // For repeatable quests past claim #1, reset progress so it can be earned again.
    if (maxCompletions > 1 && claimsSoFar + 1 < maxCompletions) {
      await supabase
        .from("quest_progress")
        .update({ progress_count: 0, completed_at: null, claimed_at: null, updated_at: new Date().toISOString() })
        .eq("quest_id", questId)
        .eq("user_id", user.id)
        .eq("window_key", wk)
    }

    return NextResponse.json({
      success: true,
      reward: {
        coins: result.coins,
        xp: result.xp,
        item_id: result.item?.id ?? null,
        item_qty: result.item?.qty ?? 0,
        label: q.reward_label || null,
      },
      new_balance: result.newBalance ?? null,
      leveled_up: result.leveledUp ?? false,
    })
  } catch (error: any) {
    console.error("POST /api/quests/claim error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
