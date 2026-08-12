import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Hardened free-coin faucet defaults.
 * Purchases (Stripe / priced coin packs / Pro activation spend) stay intact.
 */
export const ECONOMY_DEFAULTS = {
  daily_claim_enabled: true,
  weekly_claim_enabled: true,
  /** Free daily claim (was 40) */
  daily_amount: 12,
  /** Pro daily claim (was 60) — still a Pro perk, not a free faucet */
  daily_pro_amount: 25,
  /** Weekly claim (was 500) */
  weekly_amount: 50,
  /** New profile seed (was 500) */
  signup_bonus: 50,
  /** One-time onboarding (was client-controlled 100) */
  onboarding_bonus: 25,
  /** Tiny streak bonus after 7 consecutive daily claims (capped) */
  streak_bonus_enabled: true,
  streak_bonus_days: 7,
  streak_bonus_amount: 5,
} as const

export type EconomySettings = {
  daily_claim_enabled: boolean
  weekly_claim_enabled: boolean
  daily_amount: number
  daily_pro_amount: number
  weekly_amount: number
  signup_bonus: number
  onboarding_bonus: number
  streak_bonus_enabled: boolean
  streak_bonus_days: number
  streak_bonus_amount: number
}

const SETTING_KEY = "economy"

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function normalizeEconomySettings(raw: unknown): EconomySettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    daily_claim_enabled: src.daily_claim_enabled !== false,
    weekly_claim_enabled: src.weekly_claim_enabled !== false,
    daily_amount: clampInt(src.daily_amount, ECONOMY_DEFAULTS.daily_amount, 0, 200),
    daily_pro_amount: clampInt(src.daily_pro_amount, ECONOMY_DEFAULTS.daily_pro_amount, 0, 500),
    weekly_amount: clampInt(src.weekly_amount, ECONOMY_DEFAULTS.weekly_amount, 0, 2000),
    signup_bonus: clampInt(src.signup_bonus, ECONOMY_DEFAULTS.signup_bonus, 0, 500),
    onboarding_bonus: clampInt(src.onboarding_bonus, ECONOMY_DEFAULTS.onboarding_bonus, 0, 200),
    streak_bonus_enabled: src.streak_bonus_enabled !== false,
    streak_bonus_days: clampInt(src.streak_bonus_days, ECONOMY_DEFAULTS.streak_bonus_days, 2, 30),
    streak_bonus_amount: clampInt(src.streak_bonus_amount, ECONOMY_DEFAULTS.streak_bonus_amount, 0, 50),
  }
}

export async function getEconomySettings(supabase: SupabaseClient): Promise<EconomySettings> {
  try {
    const { data, error } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", SETTING_KEY)
      .maybeSingle()

    if (error || !data?.setting_value) return { ...ECONOMY_DEFAULTS }
    return normalizeEconomySettings(data.setting_value)
  } catch {
    return { ...ECONOMY_DEFAULTS }
  }
}

export async function saveEconomySettings(
  supabase: SupabaseClient,
  next: Partial<EconomySettings>,
  updatedBy?: string | null,
) {
  const current = await getEconomySettings(supabase)
  const merged = normalizeEconomySettings({ ...current, ...next })

  const payload = {
    setting_key: SETTING_KEY,
    setting_value: merged,
    updated_at: new Date().toISOString(),
    ...(updatedBy ? { updated_by: updatedBy } : {}),
  }

  const { data: existing } = await supabase
    .from("admin_settings")
    .select("id")
    .eq("setting_key", SETTING_KEY)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from("admin_settings")
      .update({
        setting_value: merged,
        updated_at: payload.updated_at,
        ...(updatedBy ? { updated_by: updatedBy } : {}),
      })
      .eq("setting_key", SETTING_KEY)
    if (error) throw error
  } else {
    const { error } = await supabase.from("admin_settings").insert(payload)
    if (error) throw error
  }

  return merged
}

export function getOrgCoinMultiplier(profile: any): number {
  if (!profile || !profile.is_organization) return 1.0
  const mult = Number(profile.organization_config?.coin_rate_multiplier)
  return Number.isFinite(mult) && mult > 0 ? mult : 1.5
}

export { SETTING_KEY as ECONOMY_SETTING_KEY }
