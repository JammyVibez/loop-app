/**
 * Security header policy — the single source of truth.
 *
 * This used to be defined twice: `next.config.mjs` sent one
 * Content-Security-Policy and `middleware.ts` sent a different one with
 * different `frame-ancestors`/`X-Frame-Options` values. Only the middleware
 * copy ever reached the browser (verified against production), so the config
 * copy was silently dead — which is how `/preview/{id}` stayed un-embeddable
 * even though the config appeared to allow it, and how the in-app browser was
 * blocked by a `frame-src` allowlist that predates the feature.
 *
 * Two rules matter here and they pull in opposite directions:
 *   - the app must refuse to be framed (clickjacking on /loopadmin, /wallet,
 *     /settings), EXCEPT
 *   - /preview/{id} exists to be embedded in someone else's page — that is the
 *     whole point of the embed snippet developers copy out of their project
 *     card.
 * So framing is decided per path, in one place, and tested.
 *
 * Kept free of React/Next so the policy is unit-testable.
 */

/** Routes that exist to be framed by third-party pages. */
export const EMBEDDABLE_PREFIXES = ["/preview"] as const

/**
 * Embedded content that refuses to be framed can't be helped, but anything
 * that does allow it needs to get past our own `frame-src`. The in-app browser
 * opens arbitrary links from posts, so an allowlist of a few hosts means that
 * feature appears broken for most sites.
 */
const APP_FRAME_SOURCES = ["'self'", "https:"]

const PERMISSIONS_POLICY =
  "camera=(self), microphone=(self), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"

export function isEmbeddablePath(pathname: string): boolean {
  return EMBEDDABLE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * `frame-ancestors` for a path, or `null` to omit the directive entirely.
 *
 * The embed route keeps it open and drops `X-Frame-Options` altogether —
 * sending both, with different meanings, is what made the previous intent
 * impossible to reason about.
 */
export function frameAncestorsFor(pathname: string, isApi: boolean): string | null {
  if (isApi) return null
  return isEmbeddablePath(pathname) ? "*" : "'self'"
}

export function contentSecurityPolicyFor(pathname: string, isApi: boolean): string | null {
  if (isApi) return null

  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live https://js.stripe.com https://checkout.stripe.com https://fonts.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co https://res.cloudinary.com https://*.cloudinary.com https://images.unsplash.com https://*.vercel.app https://*.run.app",
    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
    "media-src 'self' blob: https://*.supabase.co https://res.cloudinary.com https://*.cloudinary.com",
    // LiveKit and 100ms signalling are WebSockets — without the wss:// hosts,
    // calls die with "could not establish signal connection: Failed to fetch".
    // Cloudinary and Tenor are here because uploads/GIF search are called from
    // the browser, and were only allowed by the copy of this policy that never
    // reached production.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://res.cloudinary.com https://api.cloudinary.com https://tenor.googleapis.com https://*.livekit.cloud wss://*.livekit.cloud https://*.livekit.io wss://*.livekit.io https://*.100ms.live wss://*.100ms.live https://api.stripe.com https://*.stripe.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://vercel.live",
    `frame-src ${APP_FRAME_SOURCES.join(" ")}`,
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ]

  const frameAncestors = frameAncestorsFor(pathname, isApi)
  if (frameAncestors) directives.push(`frame-ancestors ${frameAncestors}`)

  return directives.join("; ")
}

/** Full header set for a path. */
export function securityHeadersFor(pathname: string, isApi: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  }

  const csp = contentSecurityPolicyFor(pathname, isApi)
  if (csp) headers["Content-Security-Policy"] = csp

  // No X-Frame-Options on the embed route: the whole point is to be framed, and
  // shipping both headers with opposite meanings is exactly the ambiguity this
  // module exists to remove.
  if (!isEmbeddablePath(pathname)) {
    headers["X-Frame-Options"] = isApi ? "DENY" : "SAMEORIGIN"
  }

  return headers
}
