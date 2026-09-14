import type { SupabaseClient } from "@supabase/supabase-js"
import { awardXp } from "@/lib/xp"
import { checkRateLimit } from "@/lib/rate-limit"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface Quest {
  id: string
  title: string
  description: string | null
  icon: string | null
  accent: string | null
  quest_type: "ad" | "survey" | "minigame" | "native"
  minigame_kind: string | null
  requirement_count: number
  native_action: string | null
  cadence: "daily" | "weekly" | "seasonal"
  starts_at: string | null
  ends_at: string | null
  reward_type: "coins" | "xp" | "item" | "coins_xp"
  reward_coins: number | null
  reward_xp: number | null
  reward_item_id: number | null
  reward_item_qty: number | null
  reward_label: string | null
  visibility: "all" | "pro" | "organization" | "new_users"
  min_level: number | null
  max_level: number | null
  max_completions_per_user: number | null
  is_active: boolean
  sort_order: number | null
  /* v2 columns */
  status?: "draft" | "active" | "paused" | "archived"
  quest_kind?: "simple" | "mission"
  banner_url?: string | null
  thumbnail_url?: string | null
  category?: string | null
  difficulty?: "easy" | "medium" | "hard" | null
  est_minutes?: number | null
  sponsor_name?: string | null
  sponsor_url?: string | null
  cta_text?: string | null
  terms_text?: string | null
  featured?: boolean
  is_sponsored?: boolean
  region_eligibility?: string | null
  auto_claim?: boolean
  mission_config?: unknown[]
  survey_config?: unknown[]
  game_config?: Record<string, unknown>
  video_url?: string | null
  video_seconds?: number | null
  collection_tag?: string | null
  total_views?: number
  total_starts?: number
}

export interface QuestProgressRow {
  quest_id: string
  progress_count: number
  completed_at: string | null
  claimed_at: string | null
  window_key: string
}

export interface QuestCaps {
  dailyCoinCap: number
  dailyXpCap: number
}

/* ------------------------------------------------------------------ */
/* Window keys — daily/weekly reset logic                              */
/* ------------------------------------------------------------------ */

/** Local-date window key: daily resets at UTC midnight, weekly on Mondays (ISO week). */
export function windowKeyFor(cadence: Quest["cadence"], now = new Date()): string {
  if (cadence === "daily") {
    return now.toISOString().slice(0, 10) // YYYY-MM-DD
  }
  if (cadence === "weekly") {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const day = d.getUTCDay() || 7 // Mon=1..Sun=7
    d.setUTCDate(d.getUTCDate() - day + 1) // back to Monday
    const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getUTCDay() + 1) / 7)
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
  }
  return "seasonal"
}

/** Human-readable time until the current window resets. */
export function windowResetLabel(cadence: Quest["cadence"], now = new Date()): string {
  if (cadence === "seasonal") return "Season quest"
  const next = new Date(now)
  if (cadence === "daily") {
    next.setUTCHours(24, 0, 0, 0)
  } else {
    const day = next.getUTCDay() || 7
    next.setUTCDate(next.getUTCDate() - day + 8) // next Monday
    next.setUTCHours(0, 0, 0, 0)
  }
  const ms = next.getTime() - now.getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return cadence === "daily" ? `Resets in ${h}h ${m}m` : `Resets in ${Math.floor(h / 24)}d ${h % 24}h`
}

/* ------------------------------------------------------------------ */
/* Economy caps                                                        */
/* ------------------------------------------------------------------ */

export async function getQuestCaps(supabase: SupabaseClient): Promise<QuestCaps> {
  const DEFAULTS: QuestCaps = { dailyCoinCap: 2000, dailyXpCap: 500 }
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["quest_daily_coin_cap", "quest_daily_xp_cap"])
    const caps = { ...DEFAULTS }
    for (const row of data || []) {
      const v = typeof row.setting_value === "string" ? JSON.parse(row.setting_value) : row.setting_value
      const num = Number((v as any)?.value ?? (v as any))
      if (row.setting_key === "quest_daily_coin_cap" && Number.isFinite(num)) caps.dailyCoinCap = num
      if (row.setting_key === "quest_daily_xp_cap" && Number.isFinite(num)) caps.dailyXpCap = num
    }
    return caps
  } catch {
    return DEFAULTS
  }
}

/** Sum of coins/XP the user earned from quests today (claim ledger). */
async function earnedToday(supabase: SupabaseClient, userId: string): Promise<{ coins: number; xp: number }> {
  const todayKey = windowKeyFor("daily")
  const { data } = await supabase
    .from("quest_claims")
    .select("coins_awarded, xp_awarded")
    .eq("user_id", userId)
    .eq("window_key", todayKey)
  let coins = 0
  let xp = 0
  for (const row of data || []) {
    coins += Number(row.coins_awarded || 0)
    xp += Number(row.xp_awarded || 0)
  }
  return { coins, xp }
}

/** How much of a reward still fits under today's caps. Returns 0 amounts if fully capped. */
export async function capAdjustReward(
  supabase: SupabaseClient,
  userId: string,
  reward: { coins: number; xp: number },
): Promise<{ coins: number; xp: number; capped: boolean }> {
  const caps = await getQuestCaps(supabase)
  const earned = await earnedToday(supabase, userId)
  const coins = Math.max(0, Math.min(reward.coins, caps.dailyCoinCap - earned.coins))
  const xp = Math.max(0, Math.min(reward.xp, caps.dailyXpCap - earned.xp))
  return { coins, xp, capped: coins < reward.coins || xp < reward.xp }
}

/* ------------------------------------------------------------------ */
/* Visibility                                                          */
/* ------------------------------------------------------------------ */

export interface ViewerContext {
  isPremium: boolean
  isOrganization: boolean
  level: number
  accountAgeDays: number
}

export function questVisibleTo(quest: Quest, viewer: ViewerContext): boolean {
  switch (quest.visibility) {
    case "pro":
      return viewer.isPremium
    case "organization":
      return viewer.isOrganization
    case "new_users":
      return viewer.accountAgeDays <= 14
    default:
      break
  }
  const lvl = viewer.level
  if (quest.min_level && lvl < quest.min_level) return false
  if (quest.max_level && lvl > quest.max_level) return false
  return true
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

/** Server-side rate limit for quest actions (claim / track / minigame submit). */
export function questRateLimit(userId: string, bucket: string, max = 20, windowMs = 60_000): boolean {
  const result = checkRateLimit(`quest:${bucket}:${userId}`, { maxRequests: max, windowMs })
  return result.allowed
}

/* ------------------------------------------------------------------ */
/* Progress + rewards                                                  */
/* ------------------------------------------------------------------ */

/**
 * Record one unit of progress for a quest. Returns true when this call
 * completed the quest (for UI burst animations).
 */
export async function recordQuestProgress(
  supabase: SupabaseClient,
  quest: Quest,
  userId: string,
  amount = 1,
): Promise<{ completed: boolean; progress: number; required: number }> {
  const wk = windowKeyFor(quest.cadence)
  const required = Math.max(1, Number(quest.requirement_count || 1))

  // Load-or-create the progress row for this window.
  const { data: existing } = await supabase
    .from("quest_progress")
    .select("id, progress_count, completed_at")
    .eq("quest_id", quest.id)
    .eq("user_id", userId)
    .eq("window_key", wk)
    .maybeSingle()

  if (!existing) {
    const progress = Math.min(amount, required)
    const completed = progress >= required
    await supabase.from("quest_progress").insert({
      quest_id: quest.id,
      user_id: userId,
      window_key: wk,
      progress_count: progress,
      completed_at: completed ? new Date().toISOString() : null,
    })
    return { completed, progress, required }
  }

  if (existing.completed_at) return { completed: true, progress: Number(existing.progress_count), required }
  if (Number(existing.progress_count) >= required) {
    return { completed: true, progress: Number(existing.progress_count), required }
  }

  const progress = Math.min(Number(existing.progress_count) + amount, required)
  const completed = progress >= required
  await supabase
    .from("quest_progress")
    .update({
      progress_count: progress,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)

  return { completed, progress, required }
}

/**
 * Credit a completed quest's rewards — server-side only. Applies daily
 * economy caps, writes the claim ledger, and updates the profile balance.
 */
export async function creditQuestRewards(
  supabase: SupabaseClient,
  quest: Quest,
  userId: string,
  source: "user" | "ad_postback" | "survey_postback" | "minigame" | "admin" = "user",
): Promise<{
  ok: boolean
  error?: string
  coins: number
  xp: number
  item: { id: number; qty: number } | null
  newBalance?: number
  leveledUp?: boolean
}> {
  // Idempotency: check the ledger for this quest+user+window before crediting.
  const wk = windowKeyFor(quest.cadence)
  const { data: existingClaim } = await supabase
    .from("quest_claims")
    .select("id")
    .eq("quest_id", quest.id)
    .eq("user_id", userId)
    .eq("window_key", wk)
    .maybeSingle()

  const allowMultiple = Number(quest.max_completions_per_user || 1) > 1
  if (existingClaim && !allowMultiple) {
    return { ok: false, error: "Reward already claimed", coins: 0, xp: 0, item: null }
  }

  const requestedCoins =
    quest.reward_type === "coins" || quest.reward_type === "coins_xp" ? Number(quest.reward_coins || 0) : 0
  const requestedXp =
    quest.reward_type === "xp" || quest.reward_type === "coins_xp" ? Number(quest.reward_xp || 0) : 0

  // Apply daily caps.
  const adjusted = await capAdjustReward(supabase, userId, { coins: requestedCoins, xp: requestedXp })

  const item =
    (quest.reward_type === "item" || quest.reward_type === "coins_xp") && quest.reward_item_id
      ? { id: Number(quest.reward_item_id), qty: Math.max(1, Number(quest.reward_item_qty || 1)) }
      : null

  // Credit coins.
  let newBalance: number | undefined
  if (adjusted.coins > 0) {
    const { data: profile } = await supabase.from("profiles").select("loop_coins").eq("id", userId).maybeSingle()
    newBalance = Number(profile?.loop_coins || 0) + adjusted.coins
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ loop_coins: newBalance, updated_at: new Date().toISOString() })
      .eq("id", userId)
    if (updErr) return { ok: false, error: updErr.message, coins: 0, xp: 0, item: null }

    await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: adjusted.coins,
      transaction_type: "quest_reward",
      description: `Quest reward: ${quest.title}`,
      reference_id: null,
    })
  }

  // Credit XP (awardXp handles Pro 2x multiplier internally).
  let leveledUp = false
  if (adjusted.xp > 0) {
    const result = await awardXp(supabase, userId, adjusted.xp, `Quest reward: ${quest.title}`)
    leveledUp = Boolean(result?.leveled_up)
  }

  // Credit item to inventory.
  if (item) {
    const { error: invErr } = await supabase.from("user_inventory").insert({
      user_id: userId,
      item_id: item.id,
      item_type: "shop_item",
      is_active: false,
      acquired_at: new Date().toISOString(),
    })
    if (invErr) console.error("Quest item grant failed:", invErr.message)
  }

  // Ledger entry (also powers the daily-cap accounting).
  await supabase.from("quest_claims").insert({
    quest_id: quest.id,
    user_id: userId,
    window_key: wk,
    coins_awarded: adjusted.coins,
    xp_awarded: adjusted.xp,
    item_id: item?.id ?? null,
    item_qty: item?.qty ?? 0,
    source,
  })

  return { ok: true, coins: adjusted.coins, xp: adjusted.xp, item, newBalance, leveledUp }
}

/* ------------------------------------------------------------------ */
/* Eligibility helpers for native action quests                        */
/* ------------------------------------------------------------------ */

export const NATIVE_ACTIONS = [
  "create_loop",
  "create_comment",
  "join_circle",
  "win_duel",
  "send_gift",
  "daily_checkin",
] as const

export type NativeAction = (typeof NATIVE_ACTIONS)[number]

export const NATIVE_ACTION_LABELS: Record<NativeAction, string> = {
  create_loop: "Create a post",
  create_comment: "Comment on a post",
  join_circle: "Join a Circle",
  win_duel: "Win a Duel",
  send_gift: "Send a gift",
  daily_checkin: "Daily check-in",
}
