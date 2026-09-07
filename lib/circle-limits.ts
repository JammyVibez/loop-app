/** Free users can own/create a small number of communities; Pro gets a higher cap. */
export const FREE_CIRCLE_CREATE_LIMIT = 2
export const PRO_CIRCLE_CREATE_LIMIT = 15

/** Community posts can carry up to this many media items per plan tier. */
export const FREE_MEDIA_PER_POST = 2
export const VERIFIED_MEDIA_PER_POST = 4
export const PRO_MEDIA_PER_POST = 10

export function getCircleCreateLimit(isPremium: boolean): number {
  return isPremium ? PRO_CIRCLE_CREATE_LIMIT : FREE_CIRCLE_CREATE_LIMIT
}

/** Alias kept for feature-code that reads "community" instead of "circle". */
export function getCommunityLimit(isPremium: boolean): number {
  return getCircleCreateLimit(isPremium)
}

/**
 * Server-authoritative media cap for a community post/submission.
 * Free: 2 · Verified: 4 · Pro: 10. Reads the real account state from the
 * database (is_premium) — never trust a client-sent Pro flag.
 */
export function getMediaLimit(isPremium?: boolean | null, isVerified?: boolean | null): number {
  if (isPremium) return PRO_MEDIA_PER_POST
  if (isVerified) return VERIFIED_MEDIA_PER_POST
  return FREE_MEDIA_PER_POST
}

export function canUploadMoreMedia(profile: { is_premium?: boolean | null; is_verified?: boolean | null }, currentCount: number): boolean {
  return currentCount < getMediaLimit(profile.is_premium, profile.is_verified)
}

export function circleCreateLimitMessage(isPremium: boolean, currentCount: number): string {
  const limit = getCircleCreateLimit(isPremium)
  if (isPremium) {
    return `Pro members can create up to ${limit} communities (${currentCount}/${limit} used).`
  }
  return `Free accounts can create up to ${limit} communities (${currentCount}/${limit} used). Upgrade to Pro for up to ${PRO_CIRCLE_CREATE_LIMIT}.`
}

export type TaggedCircle = {
  id: string
  name: string
  avatar_url?: string | null
}

export const MAX_BIO_COMMUNITY_TAGS = 5

/** Inline bio token: [[c:uuid|Display Name]] */
export const CIRCLE_BIO_TOKEN_RE = /\[\[c:([a-zA-Z0-9_-]{1,64})(?:\|([^\]]{1,80}))?\]\]/gi

export function serializeCircleBioToken(circle: TaggedCircle): string {
  const safeName = String(circle.name || "Community").replace(/[\[\]|]/g, "").slice(0, 80)
  return `[[c:${circle.id}|${safeName}]]`
}

export function sanitizeTaggedCircles(input: unknown): TaggedCircle[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: TaggedCircle[] = []
  for (const item of input) {
    if (!item || typeof item !== "object") continue
    const id = String((item as any).id || "").trim()
    const name = String((item as any).name || "").trim()
    if (!id || !name || seen.has(id)) continue
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue
    seen.add(id)
    out.push({
      id,
      name: name.slice(0, 80),
      avatar_url: (item as any).avatar_url ? String((item as any).avatar_url) : null,
    })
    if (out.length >= MAX_BIO_COMMUNITY_TAGS) break
  }
  return out
}
