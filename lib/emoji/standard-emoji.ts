/** Lazily-loaded full standard emoji library (see scripts/generate-standard-emoji.mjs). */

export type StandardEmoji = [emoji: string, name: string]

export type StandardEmojiGroup = {
  id: string
  label: string
  emojis: StandardEmoji[]
}

let cache: StandardEmojiGroup[] | null = null
let inflight: Promise<StandardEmojiGroup[]> | null = null

/**
 * Fetches the ~1900-emoji library once per session. Kept out of the JS bundle
 * so opening the picker is the only time it costs anything.
 */
export function loadStandardEmoji(): Promise<StandardEmojiGroup[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch("/emojis/standard-emoji.json", { cache: "force-cache" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const groups = Array.isArray(data?.groups) ? (data.groups as StandardEmojiGroup[]) : []
        cache = groups
        return groups
      })
      .catch(() => [])
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function getCachedStandardEmoji(): StandardEmojiGroup[] | null {
  return cache
}

const SEARCH_LIMIT = 160

/** Case-insensitive name search across every group. */
export function searchStandardEmoji(groups: StandardEmojiGroup[], query: string): StandardEmoji[] {
  const term = query.trim().toLowerCase()
  if (!term) return []
  const results: StandardEmoji[] = []
  for (const group of groups) {
    for (const entry of group.emojis) {
      if (entry[1].includes(term)) {
        results.push(entry)
        if (results.length >= SEARCH_LIMIT) return results
      }
    }
  }
  return results
}
