import type { SupabaseClient } from "@supabase/supabase-js"

/** Level = floor(sqrt(XP / 100)), minimum 1 */
export function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)))
}

export function xpForNextLevel(level: number) {
  return Math.pow(Math.max(1, level) + 1, 2) * 100
}

export const XP_REWARDS = {
  daily_checkin: 15,
  create_loop: 25,
  create_branch: 15,
  like_given: 2,
  like_received: 5,
  gift_sent: 10,
  gift_received: 20,
  weekly_bonus: 50,
} as const

export type XpAction = keyof typeof XP_REWARDS

export type AwardXpResult = {
  xp_points: number
  level: number
  leveled_up: boolean
  xp_gained: number
}

/**
 * Award XP and recalculate level in application code.
 * Tries RPC first; falls back to direct profile update.
 */
export async function awardXp(
  supabase: SupabaseClient,
  userId: string,
  action: XpAction | number,
  reason?: string,
): Promise<AwardXpResult | null> {
  const xpAmount = typeof action === "number" ? action : XP_REWARDS[action]
  if (!userId || !xpAmount || xpAmount <= 0) return null

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("award_user_xp", {
      target_user_id: userId,
      xp_amount: xpAmount,
      reason: reason || (typeof action === "string" ? action : "Activity reward"),
    })

    if (!rpcError && rpcData != null) {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
      if (row && (row.new_xp != null || row.xp_points != null)) {
        return {
          xp_points: Number(row.new_xp ?? row.xp_points),
          level: Number(row.new_level ?? row.level ?? levelFromXp(Number(row.new_xp ?? row.xp_points))),
          leveled_up: Boolean(row.leveled_up),
          xp_gained: xpAmount,
        }
      }
    }
  } catch {
    /* fall through */
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("xp_points, level")
    .eq("id", userId)
    .maybeSingle()

  const currentXp = Number(profile?.xp_points || 0)
  const oldLevel = Number(profile?.level || 1)
  const nextXp = currentXp + xpAmount
  const nextLevel = levelFromXp(nextXp)
  const leveledUp = nextLevel > oldLevel

  const { error } = await supabase
    .from("profiles")
    .update({
      xp_points: nextXp,
      level: nextLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) {
    console.error("awardXp failed:", error.message)
    return null
  }

  if (leveledUp) {
    try {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "system",
        title: "Level Up!",
        message: `Congratulations! You reached level ${nextLevel}!`,
        data: { old_level: oldLevel, new_level: nextLevel, xp_points: nextXp },
      })
    } catch {
      /* optional */
    }
  }

  return {
    xp_points: nextXp,
    level: nextLevel,
    leveled_up: leveledUp,
    xp_gained: xpAmount,
  }
}
