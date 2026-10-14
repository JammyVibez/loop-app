/**
 * One place that turns page data into Next metadata.
 *
 * Every page used to hand-roll its openGraph/twitter block, which is how the
 * community-post route ended up with no og:image at all. `buildOgMetadata`
 * keeps title, description, canonical URL, og:image, og:type and the Twitter
 * card in sync — and makes the image URL and the metadata impossible to drift
 * apart.
 */

import type { Metadata } from "next"

export type OgImageParams = Record<string, string | number | boolean | undefined | null>

/** `/api/og?...` with empty/false values dropped. */
export function ogImageUrl(baseUrl: string, params: OgImageParams): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === false || value === "") continue
    search.set(key, String(value))
  }
  return `${baseUrl}/api/og?${search.toString()}`
}

/** Encode a person for `people` / `side1` / `side2`: "Name|avatarUrl". */
export function personParam(name?: string | null, avatar?: string | null): string | undefined {
  const cleanName = String(name || "").trim()
  const cleanAvatar = String(avatar || "").trim()
  if (!cleanName && !cleanAvatar) return undefined
  return `${cleanName}|${cleanAvatar}`
}

export interface OgMetadataInput {
  baseUrl: string
  /** Canonical path, e.g. `/loop/123`. */
  path: string
  /** Template key understood by /api/og. */
  type: string
  title: string
  description: string
  params?: OgImageParams
  ogType?: "website" | "article" | "profile" | "video.other"
  twitterCard?: "summary" | "summary_large_image"
  robots?: Metadata["robots"]
  siteName?: string
}

export const SUMMARY_CARD = { width: 1200, height: 630, type: "image/png" } as const

export function buildOgMetadata(input: OgMetadataInput): Metadata {
  const image = ogImageUrl(input.baseUrl, {
    type: input.type,
    title: input.title,
    description: input.description,
    ...(input.params || {}),
  })
  const url = `${input.baseUrl}${input.path}`

  return {
    title: input.title,
    description: input.description,
    metadataBase: new URL(input.baseUrl),
    alternates: { canonical: url },
    ...(input.robots ? { robots: input.robots } : {}),
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: input.siteName || "Loop",
      type: input.ogType || "website",
      images: [{ url: image, ...SUMMARY_CARD, alt: input.title }],
    },
    twitter: {
      card: input.twitterCard || "summary_large_image",
      title: input.title,
      description: input.description,
      images: [{ url: image, width: SUMMARY_CARD.width, height: SUMMARY_CARD.height, alt: input.title }],
    },
  }
}
