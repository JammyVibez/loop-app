import manifest from "./animated-emoji-assets.json"

/**
 * Telegram-style animated emoji.
 *
 * Assets are mirrored into `public/emojis/animated` by
 * `scripts/mirror-animated-emojis.mjs` and named by codepoint (`U+1F600.webp`),
 * which keeps the Unicode → file mapping canonical. Every entry also carries
 * the public CDN URL so a missing local file can still render.
 */

export type AnimatedEmojiAsset = {
  /** Local file under /emojis/animated, when mirrored. */
  file?: string
  /** CLDR group name, used to build picker categories. */
  group?: string
  /** Local Lottie JSON under /emojis/lottie, for large renders. */
  lottie?: string
  /** Human name, also used for search. */
  name: string
  /** Public fallback URL (upstream collection). */
  cdn: string
}

const assets = (manifest as { emojis?: Record<string, AnimatedEmojiAsset> }).emojis || {}

export const ANIMATED_EMOJI_ASSETS: Record<string, AnimatedEmojiAsset> = assets

export function getAnimatedEmoji(emoji: string | null | undefined): AnimatedEmojiAsset | null {
  if (!emoji) return null
  return assets[emoji] || null
}

export function isAnimatedEmoji(emoji: string | null | undefined): boolean {
  return Boolean(emoji && assets[emoji])
}

export function localEmojiSrc(asset: AnimatedEmojiAsset): string | null {
  return asset.file ? `/emojis/animated/${asset.file}` : null
}

export function localLottieSrc(asset: AnimatedEmojiAsset): string | null {
  return asset.lottie ? `/emojis/lottie/${asset.lottie}` : null
}

/** `😀` → `["U+1F600"]`; ZWJ sequences keep each part, selectors are dropped. */
export function emojiToCodePoints(emoji: string): string[] {
  return Array.from(emoji)
    .map((char) => char.codePointAt(0))
    .filter((cp): cp is number => typeof cp === "number" && cp !== 0xfe0f && cp !== 0xfe0e)
    .map((cp) => `U+${cp.toString(16).toUpperCase()}`)
}

/** `😀` → `U+1F600`, matching the mirrored filenames. */
export function emojiCodePointString(emoji: string): string {
  return emojiToCodePoints(emoji).join("_")
}

export type AnimatedEmojiCategory = {
  id: string
  label: string
  emojis: string[]
}

const GROUP_LABELS: Record<string, string> = {
  "Smileys & Emotion": "Smileys",
  "People & Body": "People",
  "Animals & Nature": "Nature",
  "Food & Drink": "Food",
  Activities: "Activity",
  "Travel & Places": "Travel",
  Objects: "Objects",
  Symbols: "Symbols",
  Flags: "Flags",
}

const buckets = new Map<string, string[]>()
for (const [emoji, asset] of Object.entries(assets)) {
  const label = GROUP_LABELS[asset.group || "Symbols"] || "Symbols"
  const list = buckets.get(label) || []
  list.push(emoji)
  buckets.set(label, list)
}

/** Picker categories built from the mirrored manifest, in display order. */
export const ANIMATED_EMOJI_CATEGORIES: AnimatedEmojiCategory[] = Object.values(GROUP_LABELS)
  .map((label) => ({
    id: label.toLowerCase(),
    label,
    emojis: buckets.get(label) || [],
  }))
  .filter((category) => category.emojis.length > 0)

/** Every mirrored emoji, in picker order. */
export const ANIMATED_EMOJI_LIST: string[] = ANIMATED_EMOJI_CATEGORIES.flatMap((category) => category.emojis)

/** Search by display name ("fire") or by the character itself. */
export function searchAnimatedEmoji(query: string): string[] {
  const term = query.trim().toLowerCase()
  if (!term) return ANIMATED_EMOJI_LIST
  return ANIMATED_EMOJI_LIST.filter((emoji) => {
    const asset = assets[emoji]
    return emoji.includes(term) || Boolean(asset?.name.includes(term))
  })
}
