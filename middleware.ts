import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { isAuthRequiredPath } from "@/lib/guest"

const alwaysPublic = new Set([
  "/",
  "/landing",
  "/login",
  "/signup",
  "/verify-email",
  "/email-confirmed",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/callback",
])

// ─── Rate Limiting (in-memory, per-instance) ───────────────────────

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) rateLimitStore.delete(key)
  }
}, 300_000)

function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count }
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

// ─── Security Headers ──────────────────────────────────────────────

function getSecurityHeaders(isApi: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  }

  // CSP for page routes only (not API)
  if (!isApi) {
    headers["Content-Security-Policy"] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live https://js.stripe.com https://checkout.stripe.com https://fonts.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://res.cloudinary.com https://*.cloudinary.com https://images.unsplash.com https://*.vercel.app https://*.run.app",
      "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
      "media-src 'self' blob: https://*.supabase.co https://res.cloudinary.com https://*.cloudinary.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://vercel.live",
      "frame-src https://js.stripe.com https://checkout.stripe.com https://vercel.live",
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ")
  }

  return headers
}

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 0. Canonical domain: www.loopapp.me → loopapp.me (301) ──────────────
  // Keeps Google from treating www and apex as duplicate sites; every page
  // ends up with one canonical URL.
  //
  // Safety: only fire on a bare www host with NO explicit port. Sandbox /
  // preview traffic reaches us with a port in the Host header (e.g.
  // www.loopapp.me:10000) — redirecting there would leak the preview URL
  // into the address bar, so those requests pass through untouched. The
  // redirect target is always built without a port.
  const host = (request.headers.get("host") || "").toLowerCase()
  const hostname = host.split(":")[0]
  const hasExplicitPort = host.includes(":")
  if (hostname.startsWith("www.") && !hasExplicitPort) {
    const canonical = request.nextUrl.clone()
    canonical.hostname = hostname.replace(/^www\./, "")
    canonical.port = ""
    return NextResponse.redirect(canonical, 301)
  }

  const ip = getClientIp(request)
  const isApi = pathname.startsWith("/api/")

  // ── 1. Block dangerous input in URLs (skip for API routes — they return JSON, not HTML) ──
  if (!isApi && (containsDangerousInput(pathname) || containsDangerousInput(request.nextUrl.search))) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  // ── 2. Rate limiting ──
  if (isApi) {
    // Auth endpoints: stricter rate limit
    if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/signup")) {
      const key = `auth:${ip}`
      const { allowed } = checkRateLimit(key, 10, 60_000) // 10/min
      if (!allowed) {
        return new NextResponse(
          JSON.stringify({ error: "Too many requests. Try again later." }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        )
      }
    }

    // Password reset: very strict
    if (pathname.includes("/auth/forgot-password") || pathname.includes("/auth/reset-password")) {
      const key = `pwreset:${ip}`
      const { allowed } = checkRateLimit(key, 3, 3_600_000) // 3/hour
      if (!allowed) {
        return new NextResponse(
          JSON.stringify({ error: "Too many reset attempts. Try again later." }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        )
      }
    }

    // General API: 100/min per IP
    const generalKey = `api:${ip}`
    const { allowed } = checkRateLimit(generalKey, 100, 60_000)
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    }

    // File uploads: 10/min per IP
    if (pathname.includes("/upload")) {
      const uploadKey = `upload:${ip}`
      const { allowed } = checkRateLimit(uploadKey, 10, 60_000)
      if (!allowed) {
        return new NextResponse(
          JSON.stringify({ error: "Upload limit exceeded" }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        )
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
    const headers = getSecurityHeaders(isApi)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    return response
  }

  // ── 4. Public routes ──
  if (alwaysPublic.has(pathname)) {
    const response = NextResponse.next()
    const headers = getSecurityHeaders(false)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    return response
  }

  // ── 5. Auth-required routes ──
  if (!isAuthRequiredPath(pathname)) {
    const response = NextResponse.next()
    const headers = getSecurityHeaders(false)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    return response
  }

  // ── 6. Check session cookie ──
  const hasSession = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.endsWith("better-auth.session_token") ||
        cookie.name.includes("better-auth") ||
        cookie.name.includes("supabase") ||
        cookie.name.startsWith("sb-")
    )

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    const response = NextResponse.redirect(loginUrl)
    const headers = getSecurityHeaders(false)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    return response
  }

  // ── 7. Apply security headers ──
  const response = NextResponse.next()
  const headers = getSecurityHeaders(false)
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }
  return response
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"],
}
