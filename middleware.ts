import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { hasSessionCookie, isAuthRequiredPath } from "@/lib/guest"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { INTERNAL_RATE_LIMIT_PATH, loadEdgeRateLimitSettings, planApiRateLimit } from "@/lib/middleware-rate-limit"
import { securityHeadersFor } from "@/lib/security-headers"

const alwaysPublic = new Set([
  "/",
  "/landing",
  "/login",
  "/signup",
  "/verify-email",
  "/email-confirmed",
  "/reset-password",
  "/ratelimit",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/callback",
])

// ─── Security Headers ──────────────────────────────────────────────
//
// The policy itself lives in lib/security-headers.ts. It has to be able to
// differ per route — /preview/{id} is embedded in third-party pages, everything
// else refuses to be framed — and it used to be written twice, once here and
// once in next.config.mjs with different values, where only this copy reached
// the browser. One source, applied to every response this middleware returns.

// ─── Input Validation ──────────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  /<script\b/i,
  /javascript:/i,
  /vbscript:/i,
  /on\w+\s*=/i,
  /union\s+select/i,
  /;\s*drop\s+table/i,
  /'\s*or\s+1\s*=\s*1/i,
]

function containsDangerousInput(url: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(url))
}

// ─── Middleware ─────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // NOTE: no www → apex 301 here. That redirect previously broke domain
  // access (it leaked the preview port into the target). Canonicalization
  // is handled safely via the <link rel="canonical"> tag in app/layout.tsx,
  // which tells search engines the canonical URL without redirecting users.

  const ip = getClientIp(request)
  const isApi = pathname.startsWith("/api/")

  // ── 1. Block dangerous input in URLs (skip for API routes — they return JSON, not HTML) ──
  if (!isApi && (containsDangerousInput(pathname) || containsDangerousInput(request.nextUrl.search))) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  // ── 2. Rate limiting (IP-based, anonymous traffic only) ──
  //
  // Signed-in callers are throttled per account further down the stack
  // (enforceUserRateLimit), so they deliberately get no per-IP bucket: a
  // shared office/NAT IP hitting a page refresh used to exhaust the bucket
  // mid-hydration and come back looking signed out.
  //
  // INTERNAL_RATE_LIMIT_PATH is exempt — middleware fetches it to learn the
  // admin policy, and throttling (or recursing into) that read would deadlock
  // the limiter.
  if (isApi && pathname !== INTERNAL_RATE_LIMIT_PATH) {
    const sessionCookieNames = request.cookies.getAll().map((cookie) => cookie.name)
    const hasSession = hasSessionCookie(sessionCookieNames)
    const settings = await loadEdgeRateLimitSettings(request.nextUrl.origin)

    const plan = planApiRateLimit({ pathname, ip, hasSession, settings })
    if (plan) {
      const { allowed, retryAfter } = checkRateLimit(plan.key, {
        maxRequests: plan.max,
        windowMs: plan.windowMs,
      })
      if (!allowed) {
        const retrySeconds = retryAfter || Math.ceil(plan.windowMs / 1000)
        return new NextResponse(JSON.stringify({ error: plan.message, retry_after: retrySeconds }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retrySeconds),
          },
        })
      }
    }
  }

  // ── 3. Skip non-page routes for auth checks ──
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/api/")
  ) {
    const response = NextResponse.next()
    const headers = securityHeadersFor(pathname, isApi)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    return response
  }

  // ── 4. Public routes ──
  if (alwaysPublic.has(pathname)) {
    const response = NextResponse.next()
    const headers = securityHeadersFor(pathname, isApi)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    return response
  }

  // ── 5. Auth-required routes ──
  if (!isAuthRequiredPath(pathname)) {
    const response = NextResponse.next()
    const headers = securityHeadersFor(pathname, isApi)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    return response
  }

  // ── 6. Check session cookie ──
  const hasSession = hasSessionCookie(request.cookies.getAll().map((cookie) => cookie.name))

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    const response = NextResponse.redirect(loginUrl)
    const headers = securityHeadersFor(pathname, isApi)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    return response
  }

  // ── 7. Apply security headers ──
  const response = NextResponse.next()
  const headers = securityHeadersFor(pathname, isApi)
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }
  return response
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"],
}
