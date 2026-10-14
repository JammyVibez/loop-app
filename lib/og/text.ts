/** Pure text helpers for the OG engine (unit-tested). */

export function truncate(value: unknown, max: number): string {
  const clean = cleanText(value)
  if (clean.length <= max) return clean
  const cut = clean.slice(0, Math.max(1, max - 1))
  const lastSpace = cut.lastIndexOf(" ")
  const body = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return body.trimEnd() + "…"
}

/**
 * Parse a stat handed over as a string. Callers format with toLocaleString()
 * ("1,234") and share sheets may pass "1.2k", so honour separators and k/M.
 */
export function parseStat(raw: unknown): number {
  const s = String(raw ?? "").trim().replace(/,/g, "")
  const m = /^(\d+(?:\.\d+)?)\s*([kKmM])?$/.exec(s)
  if (!m) return 0
  const n = Number(m[1])
  if (!Number.isFinite(n)) return 0
  const suffix = (m[2] || "").toLowerCase()
  return suffix === "m" ? Math.round(n * 1_000_000) : suffix === "k" ? Math.round(n * 1_000) : Math.round(n)
}

/** 1234 -> "1.2k" for compact stat readouts. */
export function formatCount(n: number): string {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return String(v)
}

/** Two-letter monogram for avatar fallbacks. */
export function initials(name: unknown): string {
  const parts = cleanText(name).split(" ").filter(Boolean)
  if (!parts.length) return "L"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
}

/** Keep only hex colours from a badge gradient, max two stops. */
export function parseColors(a: unknown, b: unknown): string[] | undefined {
  const list = [a, b]
    .filter((v): v is string => Boolean(v && /^#?[0-9a-fA-F]{3,8}$/.test(String(v))))
    .map((c) => (c.startsWith("#") ? c : `#${c}`))
  return list.length ? list.slice(0, 2) : undefined
}

export function parseBool(raw: unknown): boolean {
  return raw === "true" || raw === "1"
}

/** Label a count correctly ("1 follower" / "57 followers"). */
export function pluralLabel(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/** Strip control characters and emoji — satori has no colour-emoji font, so
 * any emoji in a title/body would render as a tofu box. */
export function cleanText(value: unknown): string {
  return String(value ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
