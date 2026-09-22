import type { SupabaseClient } from "@supabase/supabase-js"
import { checkRateLimit } from "./rate-limit"

/**
 * Admin-controlled rate limiting policy.
 *
 * One master switch (`enabled`) plus per-action maximums admins can raise or
 * lower from the admin panel — no code deploys needed to tune throttling
 * during traffic spikes or abuse waves. Persisted in the `admin_settings`
 * table under the `rate_limits` key, and cached in-process for ~15s so hot
 * write endpoints don't pay a DB round-trip per request.
 */
export const RATE_LIMIT_DEFAULTS = {
  /** Master switch — when off, non-auth action limits are not enforced. */
  enabled: true,
  /** Login attempts per IP per minute (burst guard). */
  login_ip_max: 10,
  /** Failed login attempts per account before lockout. */
  login_fail_max: 5,
  /** Lockout base after repeated failures (minutes; escalates per tier). */
  login_lockout_base_min: 5,
  /** Signup attempts per IP per minute. */
  signup_ip_max: 5,
  /** Signup attempts per email per hour. */
  signup_email_max: 3,
  /** Loop creations per user per minute. */
  post_max: 12,
  /** Comments per user per minute. */
  comment_max: 20,
  /** Reactions/likes per user per minute. */
  interaction_max: 40,
  /** Media uploads per user per minute. */
  upload_max: 10,
  /** Messages per user per minute. */
  message_max: 60,
  /**
   * API requests per IP per minute for signed-OUT visitors only. Signed-in
   * callers are throttled per account by `enforceUserRateLimit`, so they never
   * share this bucket — a shared office/NAT IP can no longer throttle (or log
   * out) a signed-in user browsing normally.
   */
  anonymous_api_max: 60,
} as const

export type RateLimitSettings = {
  enabled: boolean
  login_ip_max: number
  login_fail_max: number
  login_lockout_base_min: number
  signup_ip_max: number
  signup_email_max: number
  post_max: number
  comment_max: number
  interaction_max: number
  upload_max: number
  message_max: number
  anonymous_api_max: number
}

const SETTING_KEY = "rate_limits"

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function normalizeRateLimitSettings(raw: unknown): RateLimitSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    enabled: src.enabled !== false,
    login_ip_max: clampInt(src.login_ip_max, RATE_LIMIT_DEFAULTS.login_ip_max, 2, 60),
    login_fail_max: clampInt(src.login_fail_max, RATE_LIMIT_DEFAULTS.login_fail_max, 2, 20),
    login_lockout_base_min: clampInt(src.login_lockout_base_min, RATE_LIMIT_DEFAULTS.login_lockout_base_min, 1, 60),
    signup_ip_max: clampInt(src.signup_ip_max, RATE_LIMIT_DEFAULTS.signup_ip_max, 1, 20),
    signup_email_max: clampInt(src.signup_email_max, RATE_LIMIT_DEFAULTS.signup_email_max, 1, 10),
    post_max: clampInt(src.post_max, RATE_LIMIT_DEFAULTS.post_max, 1, 200),
    comment_max: clampInt(src.comment_max, RATE_LIMIT_DEFAULTS.comment_max, 1, 300),
    interaction_max: clampInt(src.interaction_max, RATE_LIMIT_DEFAULTS.interaction_max, 1, 500),
    upload_max: clampInt(src.upload_max, RATE_LIMIT_DEFAULTS.upload_max, 1, 100),
    message_max: clampInt(src.message_max, RATE_LIMIT_DEFAULTS.message_max, 1, 600),
    anonymous_api_max: clampInt(src.anonymous_api_max, RATE_LIMIT_DEFAULTS.anonymous_api_max, 5, 1000),
  }
}

let cachedSettings: RateLimitSettings | null = null
let cachedAt = 0
const CACHE_TTL_MS = 15_000

async function loadSettings(supabase: SupabaseClient): Promise<RateLimitSettings> {
  try {
    const { data, error } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", SETTING_KEY)
      .maybeSingle()
    if (error || !data?.setting_value) return { ...RATE_LIMIT_DEFAULTS }
    return normalizeRateLimitSettings(data.setting_value)
  } catch {
    return { ...RATE_LIMIT_DEFAULTS }
  }
}

/** Cached read for hot request paths (create/comment/etc.). */
export async function getRateLimitSettings(supabase: SupabaseClient): Promise<RateLimitSettings> {
  const now = Date.now()
  if (cachedSettings && now - cachedAt < CACHE_TTL_MS) return cachedSettings
  cachedSettings = await loadSettings(supabase)
  cachedAt = Date.now()
  return cachedSettings
}

/** Force a fresh read (used right after an admin saves new values). */
export async function refreshRateLimitSettings(supabase: SupabaseClient): Promise<RateLimitSettings> {
  cachedSettings = await loadSettings(supabase)
  cachedAt = Date.now()
  return cachedSettings
}

export async function saveRateLimitSettings(
  supabase: SupabaseClient,
  next: Partial<RateLimitSettings>,
): Promise<RateLimitSettings> {
  const merged = normalizeRateLimitSettings({
    ...(await loadSettings(supabase)),
    ...next,
  })
  const { error } = await supabase.from("admin_settings").upsert(
    { setting_key: SETTING_KEY, setting_value: merged, updated_at: new Date().toISOString() },
    { onConflict: "setting_key" },
  )
  if (error) throw error
  cachedSettings = merged
  cachedAt = Date.now()
  return merged
}

/**
 * Guard a per-user write action (post / comment / like / upload / message)
 * against the admin policy. Honours the master switch — when rate limiting
 * is disabled this is a no-op, which is what lets staff test without hitting
 * throttles. Always passes when the policy can't be read (fail-open for
 * non-auth actions; the auth routes enforce their own hard floor).
 */
export async function enforceUserRateLimit(
  supabase: SupabaseClient,
  action: "post" | "comment" | "interaction" | "upload" | "message",
  userId: string,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  try {
    const policy = await getRateLimitSettings(supabase)
    if (!policy.enabled) return { ok: true }
    const maxKey = `${action}_max` as keyof RateLimitSettings
    const result = checkRateLimit(`${action}:${userId}`, {
      maxRequests: policy[maxKey] as number,
      windowMs: 60_000,
    })
    if (result.allowed) return { ok: true }
    return { ok: false, retryAfter: result.retryAfter || 60 }
  } catch {
    return { ok: true }
  }
}

/** Human label + window (seconds) per action key, shared with the admin UI. */
export const RATE_LIMIT_ACTIONS: { key: keyof RateLimitSettings; label: string; window: string }[] = [
  { key: "post_max", label: "Post creation", window: "per minute" },
  { key: "comment_max", label: "Comments", window: "per minute" },
  { key: "interaction_max", label: "Likes / reactions", window: "per minute" },
  { key: "upload_max", label: "Media uploads", window: "per minute" },
  { key: "message_max", label: "Messages", window: "per minute" },
  { key: "login_ip_max", label: "Login attempts / IP", window: "per minute" },
  { key: "login_fail_max", label: "Failed logins before lockout", window: "per account" },
  { key: "signup_ip_max", label: "Signups / IP", window: "per minute" },
  { key: "signup_email_max", label: "Signups / email", window: "per hour" },
  { key: "anonymous_api_max", label: "Signed-out API requests / IP", window: "per minute" },
]
