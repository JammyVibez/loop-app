import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import {
  type Quest,
  type QuestProgressRow,
  windowKeyFor,
  windowResetLabel,
  questVisibleTo,
  getQuestCaps,
} from "@/lib/quests"

export const dynamic = "force-dynamic"

/**
 * GET /api/quests — the user's quest board.
 * Returns quests visible to this user with live progress, grouped client-side
 * by cadence. Also returns daily caps + earned-today for the "daily limit" UI.
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

  try {
    const supabase = createServerClient()

    const [{ data: profile }, { data: questRows }, caps] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, is_premium, premium_expires_at, is_organization, level, xp_points, created_at")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("quests")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      getQuestCaps(supabase),
    ])

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

    const premiumActive =
      Boolean(profile.is_premium) &&
      (!profile.premium_expires_at || new Date(profile.premium_expires_at) > new Date())

    const viewer = {
      isPremium: premiumActive,
      isOrganization: Boolean(profile.is_organization),
      level: Number(profile.level || 1),
      accountAgeDays: profile.created_at
        ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
        : 999,
    }

    // Filter by visibility + seasonal date window.
    const now = new Date()
    const visible = (questRows || []).filter((q: Quest) => {
      if (!questVisibleTo(q, viewer)) return false
      if (q.cadence === "seasonal") {
        if (q.starts_at && new Date(q.starts_at) > now) return false
        if (q.ends_at && new Date(q.ends_at) < now) return false
      }
      return true
    })

    // Load this user's progress rows for all current window keys.
    const questIds = visible.map((q: Quest) => q.id)
    const progressByQuest: Record<string, QuestProgressRow> = {}
    if (questIds.length > 0) {
      const { data: progressRows } = await supabase
        .from("quest_progress")
        .select("quest_id, progress_count, completed_at, claimed_at, window_key")
        .eq("user_id", user.id)
        .in("quest_id", questIds)

      for (const row of (progressRows as QuestProgressRow[]) || []) {
        const quest = visible.find((q: Quest) => q.id === row.quest_id)
        if (quest && row.window_key === windowKeyFor(quest.cadence)) {
          progressByQuest[row.quest_id] = row
        }
      }
    }

    // Attach reward item preview + progress to each quest.
    const rewardItemIds = visible
      .map((q: Quest) => q.reward_item_id)
      .filter((id: number | null): id is number => id != null)
    const itemMap: Record<number, { name: string; preview_data: any; rarity: string }> = {}
    if (rewardItemIds.length > 0) {
      const { data: items } = await supabase
        .from("shop_items")
        .select("id, name, preview_data, rarity")
        .in("id", rewardItemIds)
      for (const it of items || []) itemMap[it.id] = it
    }

    const quests = visible.map((q: Quest) => {
      const p = progressByQuest[q.id]
      const required = Math.max(1, Number(q.requirement_count || 1))
      const progressCount = Math.min(Number(p?.progress_count || 0), required)
      return {
        ...q,
        progress: {
          count: progressCount,
          required,
          percent: Math.min(100, Math.round((progressCount / required) * 100)),
          completed: Boolean(p?.completed_at),
          claimed: Boolean(p?.claimed_at),
          reset_label: windowResetLabel(q.cadence),
        },
        reward_item_preview: q.reward_item_id ? itemMap[q.reward_item_id] || null : null,
      }
    })

    // Daily cap status for the header meter.
    const todayKey = windowKeyFor("daily")
    const { data: todayClaims } = await supabase
      .from("quest_claims")
      .select("coins_awarded, xp_awarded")
      .eq("user_id", user.id)
      .eq("window_key", todayKey)
    const earnedToday = (todayClaims || []).reduce(
      (acc: { coins: number; xp: number }, c: any) => ({
        coins: acc.coins + Number(c.coins_awarded || 0),
        xp: acc.xp + Number(c.xp_awarded || 0),
      }),
      { coins: 0, xp: 0 },
    )

    return NextResponse.json({
      success: true,
      quests,
      caps: {
        daily_coin_cap: caps.dailyCoinCap,
        daily_xp_cap: caps.dailyXpCap,
        earned_today_coins: earnedToday.coins,
        earned_today_xp: earnedToday.xp,
      },
    })
  } catch (error: any) {
    console.error("GET /api/quests error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
