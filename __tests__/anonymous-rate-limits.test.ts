/**
 * IP-based API rate limiting.
 *
 * The middleware used to apply one per-IP bucket to every `/api/*` call,
 * signed in or not. A page refresh fires a burst of API calls, so a signed-in
 * user could exhaust that shared bucket mid-hydration — and because the
 * session lookup was one of those calls, the app came back showing them as
 * logged out. These tests pin down the fixed policy: anonymous traffic is
 * throttled, signed-in traffic is not.
 */

import { describe, expect, it } from "vitest"
import {
  RATE_LIMIT_DEFAULTS,
  normalizeRateLimitSettings,
} from "@/lib/rate-limit-settings"
import { planApiRateLimit } from "@/lib/middleware-rate-limit"
import { hasSessionCookie } from "@/lib/guest"

const settings = { ...RATE_LIMIT_DEFAULTS }

function plan(pathname: string, hasSession = false, overrides = {}) {
  return planApiRateLimit({
    pathname,
    ip: "203.0.113.7",
    hasSession,
    settings: { ...settings, ...overrides },
  })
}

describe("planApiRateLimit", () => {
  it("does not throttle signed-in API traffic at all", () => {
    expect(plan("/api/auth/get-session", true)).toBeNull()
    expect(plan("/api/auth/me", true)).toBeNull()
    expect(plan("/api/notifications", true)).toBeNull()
    expect(plan("/api/loops", true)).toBeNull()
  })

  it("throttles anonymous API traffic per IP", () => {
    const anon = plan("/api/auth/get-session")
    expect(anon).not.toBeNull()
    expect(anon!.key).toBe("anon:203.0.113.7")
    expect(anon!.max).toBe(RATE_LIMIT_DEFAULTS.anonymous_api_max)
  })

  it("keys anonymous buckets per IP so callers never share one", () => {
    const other = planApiRateLimit({
      pathname: "/api/auth/get-session",
      ip: "198.51.100.4",
      hasSession: false,
      settings,
    })
    expect(other!.key).toBe("anon:198.51.100.4")
  })

  it("drops anonymous and upload limits when an admin disables them", () => {
    expect(plan("/api/auth/get-session", false, { enabled: false })).toBeNull()
    expect(plan("/api/upload/image", false, { enabled: false })).toBeNull()
  })

  it("keeps a brute-force floor on auth endpoints even when disabled", () => {
    const login = plan("/api/auth/login", false, { enabled: false })
    expect(login).not.toBeNull()
    expect(login!.max).toBe(RATE_LIMIT_DEFAULTS.login_ip_max)
    expect(plan("/api/auth/signup", false, { enabled: false })).not.toBeNull()
  })

  it("honours admin-tuned auth and anonymous limits", () => {
    expect(plan("/api/auth/login", false, { login_ip_max: 3 })!.max).toBe(3)
    expect(plan("/api/auth/signup", false, { signup_ip_max: 2 })!.max).toBe(2)
    expect(plan("/api/loops", false, { anonymous_api_max: 15 })!.max).toBe(15)
  })

  it("still rate limits password reset by IP", () => {
    const reset = plan("/api/auth/forgot-password", false, { enabled: false })
    expect(reset!.max).toBe(3)
    expect(reset!.key).toBe("pwreset:203.0.113.7")
  })

  it("applies the upload limit regardless of sign-in state", () => {
    expect(plan("/api/upload/avatar", true)!.key).toBe("upload:203.0.113.7")
  })
})

describe("hasSessionCookie", () => {
  it("recognises better-auth and supabase session cookies", () => {
    expect(hasSessionCookie(["better-auth.session_token"])).toBe(true)
    expect(hasSessionCookie(["__Secure-better-auth.session_token"])).toBe(true)
    expect(hasSessionCookie(["sb-cgtjjowhlyyrfljarfgd-auth-token"])).toBe(true)
  })

  it("ignores visitors with no session cookie", () => {
    expect(hasSessionCookie([])).toBe(false)
    expect(hasSessionCookie(["theme", "loop_locale", "_ga"])).toBe(false)
  })
})

describe("anonymous_api_max setting", () => {
  it("defaults to a sane value", () => {
    expect(RATE_LIMIT_DEFAULTS.anonymous_api_max).toBeGreaterThan(0)
  })

  it("clamps admins away from zero or absurd values", () => {
    expect(normalizeRateLimitSettings({ anonymous_api_max: 0 }).anonymous_api_max).toBe(5)
    expect(normalizeRateLimitSettings({ anonymous_api_max: 99999 }).anonymous_api_max).toBe(1000)
    expect(normalizeRateLimitSettings({ anonymous_api_max: "abc" }).anonymous_api_max).toBe(
      RATE_LIMIT_DEFAULTS.anonymous_api_max,
    )
  })

  it("survives a settings row written before this key existed", () => {
    // Legacy rows in admin_settings simply lack the new key.
    const legacy = normalizeRateLimitSettings({ enabled: true, post_max: 20 })
    expect(legacy.anonymous_api_max).toBe(RATE_LIMIT_DEFAULTS.anonymous_api_max)
  })
})
