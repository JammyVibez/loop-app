/** Free users can own/create a small number of communities; Pro gets a higher cap. */
export const FREE_CIRCLE_CREATE_LIMIT = 2
export const PRO_CIRCLE_CREATE_LIMIT = 15

export function getCircleCreateLimit(isPremium: boolean): number {
  return isPremium ? PRO_CIRCLE_CREATE_LIMIT : FREE_CIRCLE_CREATE_LIMIT
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
export const CIRCLE_BIO_TOKEN_RE = /\[\[c:([0-9a-f-]{36})\|([^\]]{1,80})\]\]/gi

export function serializeCircleBioToken(circle: TaggedCircle): string {
  const safeName = String(circle.name || "Community").replace(/[\[\]]/g, "").slice(0, 80)
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
