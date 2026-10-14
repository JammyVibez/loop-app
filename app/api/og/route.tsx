import { ImageResponse } from "next/og"
import { renderOgImage } from "@/lib/og/render"
import { FallbackTemplate } from "@/lib/og/templates"
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE } from "@/lib/og/params"
import { CANVAS, accentFor } from "@/lib/og/theme"

/**
 * Open Graph image endpoint — every share preview on the platform points here.
 *
 * The path and every query parameter are unchanged (`type`, `title`,
 * `description`, `avatar`, `name`, `username`, `body`, `date`, `stat`,
 * `verified`, `premium`, `badge_color*`, `category`, `is_private`, …), so
 * existing links keep resolving. `type` now selects one of the dedicated
 * templates in lib/og/templates.tsx instead of a single generic layout.
 */
export const runtime = "edge"

/**
 * Rendered cards are content-addressed by their query string, so the edge can
 * hold them for a day and serve stale while a new one is generated. Without
 * this a busy share spike re-renders the same PNG for every crawler hit.
 */
const CACHE_CONTROL = "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800"

export async function GET(request: Request) {
  const url = new URL(request.url)

  try {
    const { element } = await renderOgImage(url.searchParams, url.origin)
    return new ImageResponse(element, { ...CANVAS, headers: { "cache-control": CACHE_CONTROL } })
  } catch (error) {
    // Never hand a crawler a broken image: fall back to the plain branded
    // card, which needs no data at all.
    console.error("OG image render failed:", error)
    return new ImageResponse(
      (
        <FallbackTemplate
          p={{ accent: accentFor("fallback"), title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, category: "Loop" }}
        />
      ),
      { ...CANVAS, headers: { "cache-control": "public, max-age=60" } },
    )
  }
}
