import {
  RATE_LIMIT_DEFAULTS,
  normalizeRateLimitSettings,
  type RateLimitSettings,
} from "./rate-limit-settings"

/**
 * Rate-limiting policy for the edge middleware.
 *
 * Two different throttles exist in this app and they must not overlap:
 *
 *  - **Per account** — `enforceUserRateLimit()` in `lib/rate-limit-settings.ts`
 *    keys on the user id for posts/comments/likes/uploads/messages.
 *  - **Per IP** — this module, for callers who have no account yet.
 *
 * Because the per-IP bucket used to apply to *everyone*, a signed-in user
 * refreshing a page fired a burst of API calls (session, profile, feed,
 * notifications) that could exhaust the shared bucket — and since the session
 * lookup was one of those calls, the app would come back with "logged out"
 * and a rate-limit popup. Anonymous visitors are the ones who actually need an
 * IP throttle, so that is now the only traffic that gets one.
 */

export const INTERNAL_RATE_LIMIT_PATH = "/api/internal/rate-limit"

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000

export interface ApiRateLimitPlan {
  /** Bucket key — includes the caller's IP so buckets never share. */
  key: string
  max: number
  windowMs: number
  /** Shown to the caller when the bucket is exhausted. */
  message: string
}

export interface PlanApiRateLimitInput {
  pathname: string
  ip: string
  hasSession: boolean
  settings: RateLimitSettings
}

/**
 * Which IP-based limit (if any) applies to this request.
 *
 * Returns `null` when the request should not be IP-throttled at all. Auth
 * endpoints keep a hard floor even when admins disable rate limiting, because
 * that is brute-force protection rather than traffic shaping.
 */
export function planApiRateLimit({
  pathname,
  ip,
  hasSession,
  settings,
}: PlanApiRateLimitInput): ApiRateLimitPlan | null {
  // Password reset: very strict, always on.
  if (pathname.includes("/auth/forgot-password") || pathname.includes("/auth/reset-password")) {
    return {
      key: `pwreset:${ip}`,
      max: 3,
      windowMs: HOUR_MS,
      message: "Too many reset attempts. Try again later.",
    }
  }

  if (pathname.startsWith("/api/auth/login")) {
    return {
      key: `auth:${ip}`,
      max: settings.login_ip_max,
      windowMs: MINUTE_MS,
      message: "Too many sign-in attempts. Try again in a minute.",
    }
  }

  if (pathname.startsWith("/api/auth/signup")) {
    return {
      key: `auth:${ip}`,
      max: settings.signup_ip_max,
      windowMs: MINUTE_MS,
      message: "Too many sign-up attempts. Try again in a minute.",
    }
  }

  // Everything below is traffic shaping, so the admin master switch applies.
  if (!settings.enabled) return null

  if (pathname.includes("/upload")) {
    return {
      key: `upload:${ip}`,
      max: settings.upload_max,
      windowMs: MINUTE_MS,
      message: "Upload limit exceeded. Try again in a minute.",
    }
  }

  // Signed-in callers are throttled per account, never per shared IP.
  if (hasSession) return null

  return {
    key: `anon:${ip}`,
    max: settings.anonymous_api_max,
    windowMs: MINUTE_MS,
    message: "Too many requests. Sign in for unlimited browsing.",
  }
}

// ─── Edge config cache ──────────────────────────────────────────────
//
// Middleware runs on the edge runtime and cannot reach Postgres, so it reads
// the admin policy from a small internal JSON endpoint and caches it in
// module scope. Any failure falls back to the shipped defaults (fail-open),
// which keeps the app serving even if the endpoint is unreachable.

let cachedSettings: RateLimitSettings | null = null
let cachedAt = 0
const CACHE_TTL_MS = 60_000

export function resetEdgeRateLimitCache() {
  cachedSettings = null
  cachedAt = 0
}

export async function loadEdgeRateLimitSettings(origin: string): Promise<RateLimitSettings> {
  const now = Date.now()
  if (cachedSettings && now - cachedAt < CACHE_TTL_MS) return cachedSettings

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1500)
    const res = await fetch(`${origin}${INTERNAL_RATE_LIMIT_PATH}`, {
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timer)
    if (res.ok) {
      cachedSettings = normalizeRateLimitSettings(await res.json())
      cachedAt = Date.now()
      return cachedSettings
    }
  } catch {
    /* unreachable / slow — serve the defaults below */
  }

  return cachedSettings ?? { ...RATE_LIMIT_DEFAULTS }
}
