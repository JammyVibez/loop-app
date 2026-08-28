/**
 * Security headers configuration for the app.
 * Applied via middleware and vercel.json.
 */

export const SECURITY_HEADERS = {
  // Prevent clickjacking
  "X-Frame-Options": "DENY",

  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Control feature permissions
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",

  // Prevent XSS (legacy browsers)
  "X-XSS-Protection": "1; mode=block",

  // HSTS — force HTTPS for 1 year, include subdomains, allow preload list
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",

  // Prevent search engines from indexing login/admin pages
  "X-Robots-Tag": "noindex, nofollow",
}

/**
 * Content Security Policy — restrictive policy that blocks inline scripts,
 * eval(), and only allows trusted origins.
 */
export const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Scripts: self + inline (needed for Next.js hydration) + trusted CDNs
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live https://js.stripe.com https://checkout.stripe.com https://fonts.googleapis.com",
  // Styles: self + inline (needed for Tailwind/CSS-in-JS) + Google Fonts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
  // Images: self + data URIs + common CDNs
  "img-src 'self' data: blob: https://*.supabase.co https://res.cloudinary.com https://*.cloudinary.com https://images.unsplash.com https://*.vercel.app https://*.run.app",
  // Fonts: self + Google Fonts
  "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
  // Media: self + Supabase storage
  "media-src 'self' blob: https://*.supabase.co https://res.cloudinary.com https://*.cloudinary.com",
  // Connect: self + Supabase + Stripe + analytics
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://vercel.live",
  // Frames: only Stripe checkout
  "frame-src https://js.stripe.com https://checkout.stripe.com https://vercel.live",
  // Workers: self
  "worker-src 'self' blob:",
  // No base tag hijacking
  "base-uri 'self'",
  // No form action to external sites
  "form-action 'self'",
  // Upgrade insecure requests
  "upgrade-insecure-requests",
].join("; ")

/**
 * Get CSP header value
 */
export function getCspHeader(): string {
  return CSP_DIRECTIVES
}

/**
 * Apply all security headers to a Response
 */
export function applySecurityHeaders(
  response: Response,
  options: { includeCsp?: boolean; isApi?: boolean } = {}
): Response {
  const { includeCsp = true, isApi = false } = options
  const headers = new Headers(response.headers)

  // Always apply these headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    // Don't apply X-Robots-Tag to API routes
    if (isApi && key === "X-Robots-Tag") continue
    headers.set(key, value)
  }

  // Apply CSP for page routes (not API routes which return JSON)
  if (includeCsp && !isApi) {
    headers.set("Content-Security-Policy", getCspHeader())
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
