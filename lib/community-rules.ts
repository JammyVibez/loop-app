/**
 * House rules are stored in a shape that drifted over time: some communities
 * saved `{ rules: ["…"] }`, others a bare array, others a single newline-joined
 * string. The forum should render every one of them, so this normalises all
 * known shapes to a plain, de-duplicated list of strings.
 */
export function normalizeRules(raw: unknown, limit = 20): string[] {
  const collect = (value: unknown, depth = 0): string[] => {
    if (depth > 2 || value == null) return []
    if (typeof value === "string") {
      const text = value.trim()
      if (!text) return []
      return text.includes("\n")
        ? text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        : [text]
    }
    if (Array.isArray(value)) {
      return value.flatMap((entry) => {
        if (typeof entry === "string") return entry.trim() ? [entry.trim()] : []
        if (entry && typeof entry === "object") {
          const text = (entry as any).text || (entry as any).title || (entry as any).rule
          return typeof text === "string" && text.trim() ? [text.trim()] : []
        }
        return []
      })
    }
    if (typeof value === "object") {
      const nested = (value as any).rules ?? (value as any).items ?? (value as any).list
      return collect(nested, depth + 1)
    }
    return []
  }

  return Array.from(new Set(collect(raw))).slice(0, limit)
}
