/** Inline bio/community token: [[c:uuid|Display Name]] */
export const CIRCLE_BIO_TOKEN_RE = /\[\[c:([0-9a-f-]{36})\|([^\]]{1,80})\]\]/gi

export type CircleBioToken = {
  id: string
  name: string
}

export function serializeCircleBioToken(circle: { id: string; name: string }): string {
  const safeName = String(circle.name || "Community").replace(/[\[\]]/g, "").slice(0, 80)
  return `[[c:${circle.id}|${safeName}]]`
}

/** Replace tokens with readable names for plain-text surfaces (share, OG, search snippets). */
export function stripCircleBioTokens(text: string | null | undefined): string {
  if (!text) return ""
  return String(text)
    .replace(CIRCLE_BIO_TOKEN_RE, (_match, _id, name) => String(name || "").trim())
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function extractCircleBioTokens(text: string | null | undefined): CircleBioToken[] {
  if (!text) return []
  const seen = new Set<string>()
  const out: CircleBioToken[] = []
  const re = new RegExp(CIRCLE_BIO_TOKEN_RE.source, "gi")
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const id = match[1]
    const name = String(match[2] || "").trim()
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    out.push({ id, name: name.slice(0, 80) })
  }
  return out
}
