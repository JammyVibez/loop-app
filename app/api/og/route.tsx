import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import { OgImage, loadOgFonts } from "@/lib/og-image"

export const runtime = "edge"

// In-memory cache for generated OG images (keyed by full URL).
// Combined with CDN-level s-maxage this keeps repeated shares fast.
const ogCache = new Map<string, { buf: ArrayBuffer; ts: number }>()
const OG_CACHE_TTL_MS = 1000 * 60 * 30 // 30 minutes
const OG_CACHE_MAX = 200

const CACHE_HEADERS = {
  "content-type": "image/png",
  "cache-control":
    "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
}

/**
 * Dynamic Open Graph image.
 *
 * Referenced from app/layout.tsx and page-level generateMetadata in
 * /loop/[id], /profile/[username], /circles/[id]:
 *   /api/og?type=home|loop|profile|circle|developer|reel|live&title=...&description=...
 *   &username=...&avatar=...&verified=true&stat=...&stat_label=...
 *
 * Renders the shared 3D "orbital loop" design as a 1200×630 PNG.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Check in-memory cache first
    const cacheKey = request.url
    const cached = ogCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < OG_CACHE_TTL_MS) {
      return new Response(cached.buf, { headers: CACHE_HEADERS })
    }

    const type = searchParams.get("type") || "home"
    const title = searchParams.get("title") || undefined
    const description = searchParams.get("description") || undefined
    const username = searchParams.get("username") || undefined
    const verified = searchParams.get("verified") === "true"
    const stat = searchParams.get("stat") || undefined
    const statLabel = searchParams.get("stat_label") || undefined
    let avatar = searchParams.get("avatar") || undefined

    if (avatar && !avatar.startsWith("http://") && !avatar.startsWith("https://")) {
      avatar = undefined
    }

    const fonts = await loadOgFonts()

    const imageResponse = new ImageResponse(
      (
        <OgImage
          type={type}
          title={title}
          description={description}
          username={username}
          avatar={avatar}
          verified={verified}
          stat={stat}
          statLabel={statLabel}
        />
      ),
      {
        width: 1200,
        height: 630,
        fonts,
      }
    )

    const buf = await imageResponse.arrayBuffer()

    // Store in LRU-style cache
    ogCache.set(cacheKey, { buf, ts: Date.now() })
    if (ogCache.size > OG_CACHE_MAX) {
      const oldestKey = ogCache.keys().next().value
      if (oldestKey) ogCache.delete(oldestKey)
    }

    return new Response(buf, { headers: CACHE_HEADERS })
  } catch (error) {
    console.error("OG image generation failed:", error)
    return new Response("OG image generation failed", { status: 500 })
  }
}