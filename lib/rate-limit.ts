/**
 * Rate limiting middleware using a sliding window algorithm.
 * Uses in-memory Map (resets on server restart, which is fine for Vercel/serverless).
 * For distributed systems, swap with Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) {
        store.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
  /** Optional: custom key generator (default: IP-based) */
  keyGenerator?: (request: Request) => string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

/**
 * Check rate limit for a given key
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    }
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp
  return "unknown"
}

/**
 * Apply rate limit headers to a Response
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
  const headers = new Headers(response.headers)
  headers.set("X-RateLimit-Remaining", String(result.remaining))
  headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)))
  if (result.retryAfter) {
    headers.set("Retry-After", String(result.retryAfter))
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

// ─── Preset Configurations ─────────────────────────────────────────

export const RATE_LIMITS = {
  /** General API: 60 req/min */
  api: { maxRequests: 60, windowMs: 60_000 },
  /** Auth endpoints: 10 req/min */
  auth: { maxRequests: 10, windowMs: 60_000 },
  /** Login: 5 attempts per 15 min */
  login: { maxRequests: 5, windowMs: 15 * 60_000 },
  /** Signup: 3 per hour */
  signup: { maxRequests: 3, windowMs: 60 * 60_000 },
  /** Password reset: 3 per hour */
  passwordReset: { maxRequests: 3, windowMs: 60 * 60_000 },
  /** File upload: 10 per minute */
  upload: { maxRequests: 10, windowMs: 60_000 },
  /** Post creation: 20 per minute */
  post: { maxRequests: 20, windowMs: 60_000 },
  /** Comment creation: 30 per minute */
  comment: { maxRequests: 30, windowMs: 60_000 },
  /** Search: 30 per minute */
  search: { maxRequests: 30, windowMs: 60_000 },
  /** Gift sending: 10 per minute */
  gift: { maxRequests: 10, windowMs: 60_000 },
  /** Coin transactions: 5 per minute */
  coins: { maxRequests: 5, windowMs: 60_000 },
  /** Admin: 100 per minute */
  admin: { maxRequests: 100, windowMs: 60_000 },
  /** Messaging: 60 per minute */
  messages: { maxRequests: 60, windowMs: 60_000 },
  /** Profile update: 10 per minute */
  profile: { maxRequests: 10, windowMs: 60_000 },
} as const

/**
 * Helper: create a rate-limited handler wrapper
 */
export function withRateLimit(
  handler: (request: Request, context?: any) => Promise<Response>,
  limitConfig: RateLimitConfig,
  keyPrefix: string = "api"
) {
  return async (request: Request, context?: any): Promise<Response> => {
    const ip = getClientIp(request)
    const key = `${keyPrefix}:${ip}`

    const result = checkRateLimit(key, limitConfig)

    if (!result.allowed) {
      const response = new Response(
        JSON.stringify({
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }
      )
      return addRateLimitHeaders(response, result)
    }

    const response = await handler(request, context)
    return addRateLimitHeaders(response, result)
  }
}
