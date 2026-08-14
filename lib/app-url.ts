import type { NextRequest } from "next/server"
import { headers } from "next/headers"

const PRODUCTION_APP_URL = "https://loopapp.me"

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, "")
}

function isLocalhostUrl(url: string) {
  try {
    const { hostname } = new URL(url)
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0"
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url)
  }
}

/**
 * Async helper for server components / metadata to get the true absolute base URL of the request.
 */
export async function getAbsoluteAppUrl(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit && !isLocalhostUrl(explicit)) {
    return stripTrailingSlash(explicit)
  }

  try {
    const headersList = await headers()
    const host = headersList.get("x-forwarded-host") || headersList.get("host")
    const proto = headersList.get("x-forwarded-proto") || "https"
    if (host && !isLocalhostUrl(host)) {
      return stripTrailingSlash(`${proto}://${host}`)
    }
  } catch {
    // headers() unavailable in some contexts
  }

  if (process.env.VERCEL_URL) {
    return stripTrailingSlash(`https://${process.env.VERCEL_URL}`)
  }

  return PRODUCTION_APP_URL
}

/**
 * Canonical public app URL for auth redirects and emails.
 * Never returns localhost when running on Vercel/production, even if
 * NEXT_PUBLIC_APP_URL is still set to a local value.
 */
export function getAppUrl(request?: NextRequest | Request): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const onVercel = Boolean(process.env.VERCEL)
  const isProd = process.env.NODE_ENV === "production" || onVercel

  if (explicit && !(isProd && isLocalhostUrl(explicit))) {
    return stripTrailingSlash(explicit)
  }

  // Prefer the stable production host over preview deployment URLs for auth emails.
  if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
    if (productionHost) {
      return stripTrailingSlash(
        productionHost.startsWith("http") ? productionHost : `https://${productionHost}`,
      )
    }
    return PRODUCTION_APP_URL
  }

  if (process.env.VERCEL_URL) {
    return stripTrailingSlash(`https://${process.env.VERCEL_URL}`)
  }

  if (request) {
    try {
      const origin = "nextUrl" in request && request.nextUrl
        ? request.nextUrl.origin
        : new URL(request.url).origin
      if (!(isProd && isLocalhostUrl(origin))) {
        return stripTrailingSlash(origin)
      }
    } catch {
      // fall through
    }
  }

  if (isProd) {
    return PRODUCTION_APP_URL
  }

  return stripTrailingSlash(explicit || "http://localhost:3000")
}
