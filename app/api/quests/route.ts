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
import { questLevelFromXp, type QuestStatus } from "@/lib/quests-v2"

export const dynamic = "force-dynamic"

/**
 * GET /api/quests — the v2 quest board.
 * Returns active quests visible to this user with live progress, derived
 * state, quest XP level, and streak. Sections are grouped client-side.
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

  try {
    const supabase = createServerClient()

    const [{ data: profile }, { data: questRows }, caps] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, is_premium, premium_expires_at, is_organization, level, xp_points, created_at, loop_coins")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("quests")
        .select("*")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }),
      getQuestCaps(supabase),
    ])

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

    // Fallback for legacy rows created before v2 status column.
    let visibleRows = (questRows || []) as Quest[]
    if (visibleRows.length === 0) {
      const { data: legacy } = await supabase.from("quests").select("*").eq("is_active", true)
      visibleRows = (legacy || []) as Quest[]
    }

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

    // Filter by visibility + date window + user-hide preferences.
    const now = new Date()
    const [{ data: prefs }, { data: questXpRow }, { data: streakRow }] = await Promise.all([
      supabase
        .from("quest_preferences")
        .select("quest_id, hide_category")
        .eq("user_id", user.id),
      supabase.from("quest_xp").select("xp").eq("user_id", user.id).maybeSingle(),
      supabase.from("quest_streaks").select("current_streak, best_streak, last_day").eq("user_id", user.id).maybeSingle(),
    ])

    const hiddenQuestIds = new Set((prefs || []).map((p: any) => p.quest_id).filter(Boolean))
    const hiddenCategories = new Set((prefs || []).map((p: any) => p.hide_category).filter(Boolean))

    const visible = visibleRows.filter((q) => {
      if (hiddenQuestIds.has(q.id)) return false
      if (q.category && hiddenCategories.has(q.category)) return false
      if (!questVisibleTo(q, viewer)) return false
      if (q.cadence === "seasonal" || q.ends_at || q.starts_at) {
        if (q.starts_at && new Date(q.starts_at) > now) return false
        if (q.ends_at && new Date(q.ends_at) < now) return false
      }
      return true
    })

    // Load this user's progress rows for all current window keys.
    const questIds = visible.map((q) => q.id)
    const progressByQuest: Record<string, QuestProgressRow> = {}
    if (questIds.length > 0) {
      const { data: progressRows } = await supabase
        .from("quest_progress")
        .select("quest_id, progress_count, completed_at, claimed_at, window_key")
        .eq("user_id", user.id)
        .in("quest_id", questIds)

      for (const row of (progressRows as QuestProgressRow[]) || []) {
        const quest = visible.find((q) => q.id === row.quest_id)
        if (quest && row.window_key === windowKeyFor(quest.cadence)) {
          progressByQuest[row.quest_id] = row
        }
      }
    }

    // Mission step progress.
    const missionStepsByQuest: Record<string, number[]> = {}
    if (questIds.length > 0) {
      const { data: stepRows } = await supabase
        .from("quest_mission_steps")
        .select("quest_id, step_index, completed_at")
        .eq("user_id", user.id)
        .in("quest_id", questIds)
      for (const row of stepRows || []) {
        if (row.completed_at) {
          ;(missionStepsByQuest[row.quest_id] ??= [])[row.step_index] = 1
        }
      }
    }

    // Attach reward item preview + progress + state to each quest.
    const rewardItemIds = visible
      .map((q) => q.reward_item_id)
      .filter((id: number | null): id is number => id != null)
    const itemMap: Record<number, { name: string; preview_data: any; rarity: string }> = {}
    if (rewardItemIds.length > 0) {
      const { data: items } = await supabase
        .from("shop_items")
        .select("id, name, preview_data, rarity")
        .in("id", rewardItemIds)
      for (const it of items || []) itemMap[it.id] = it
    }

    const quests = visible.map((q) => {
      const p = progressByQuest[q.id]
      const required = Math.max(1, Number(q.requirement_count || 1))
      const progressCount = Math.min(Number(p?.progress_count || 0), required)
      const missionConfig = Array.isArray(q.mission_config) ? q.mission_config : []
      const doneSteps = (missionStepsByQuest[q.id] || []).filter(Boolean).length

      // Derive state.
      let state: string
      if (p?.claimed_at) state = "claimed"
      else if (p?.completed_at) state = q.auto_claim ? "claimed" : "claimable"
      else if (q.quest_kind === "mission") {
        state = doneSteps >= missionConfig.length && missionConfig.length > 0 ? "claimable" : doneSteps > 0 ? "in_progress" : "available"
      } else if (progressCount >= required) state = "claimable"
      else if (progressCount > 0) state = "in_progress"
      else state = "available"

      return {
        ...q,
        state,
        // Accepting a quest creates its progress row with a count of 0, so the
        // row's existence — not the count — is what proves it was accepted.
        // Without this the card offered "Accept quest" again after every reload.
        accepted: Boolean(p) || doneSteps > 0,
        progress: {
          count: progressCount,
          required,
          percent: Math.min(100, Math.round((progressCount / required) * 100)),
          completed: Boolean(p?.completed_at),
          claimed: Boolean(p?.claimed_at),
          reset_label: windowResetLabel(q.cadence),
        },
        mission_progress: q.quest_kind === "mission"
          ? { done: doneSteps, total: missionConfig.length }
          : null,
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

    const questXp = Number(questXpRow?.xp || 0)
    return NextResponse.json({
      success: true,
      quests,
      quest_xp: {
        xp: questXp,
        ...questLevelFromXp(questXp),
      },
      streak: {
        current: Number(streakRow?.current_streak || 0),
        best: Number(streakRow?.best_streak || 0),
        last_day: streakRow?.last_day || null,
      },
      coins: Number(profile.loop_coins || 0),
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
