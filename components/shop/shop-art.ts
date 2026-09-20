/**
 * The shop's animation set.
 *
 * Built once at module scope rather than per render: the player compares the
 * object it is handed by content, but handing it a fresh one on every render
 * still means re-reading it on every render.
 */

import {
  coinAnimation,
  emptyBoxAnimation,
  giftAnimation,
  loaderAnimation,
  lockAnimation,
  paletteForRarity,
  sparkleAnimation,
} from "@/lib/lottie/animations"

import {
  carAnimation,
  crownAnimation,
  diamondAnimation,
  flameAnimation,
  heartAnimation,
  lightningAnimation,
  musicAnimation,
  rocketAnimation,
  shieldAnimation,
  starAnimation,
  wandAnimation,
} from "@/lib/lottie/item-animations"

export const COIN = coinAnimation()
export const COIN_GOLD = coinAnimation(paletteForRarity("legendary"))
export const LOADER = loaderAnimation()
export const EMPTY_BOX = emptyBoxAnimation()
export const LOCK = lockAnimation()
export const SPARKLES = sparkleAnimation()
export const GIFT = giftAnimation()

/* ── Rarity-scoped sparkles (cached) ────────────────────────────────── */
const SPARKLES_BY_RARITY = new Map<string, object>()
export function sparklesFor(rarity?: string | null) {
  const key = (rarity || "common").toLowerCase()
  let art = SPARKLES_BY_RARITY.get(key)
  if (!art) {
    art = sparkleAnimation(paletteForRarity(key))
    SPARKLES_BY_RARITY.set(key, art)
  }
  return art
}

/* ── Item-specific illustrations ───────────────────────────────────────
 *
 * Keyword → animation.  The first match wins, checked in order.  Each
 * entry is [keywords[], factory].
 *
 * The keywords are tested against the lowercased item name, description
 * and category concatenated with spaces, so "supar car" matches "car",
 * "Flame Ring" matches "flame", etc.
 */
type AnimationFactory = (input?: Partial<import("@/lib/lottie/animations").LottiePalette>) => object

const ITEM_KEYWORDS: Array<[string[], AnimationFactory]> = [
  [["car", "vehicle", "automobile", "sports car", "racing", "supar"], carAnimation],
  [["crown", "king", "queen", "royal", "monarch"], crownAnimation],
  [["diamond", "gem", "jewel", "crystal", "jade", "ruby", "sapphire", "emerald"], diamondAnimation],
  [["flame", "fire", "burn", "blaze", "inferno", "ember", "pyro"], flameAnimation],
  [["heart", "love", "valentine", "romance"], heartAnimation],
  [["lightning", "thunder", "bolt", "shock", "volt", "electric", "spark"], lightningAnimation],
  [["music", "audio", "sound", "note", "melody", "rhythm", "beat", "song"], musicAnimation],
  [["rocket", "space", "launch", "speed", "turbo", "fast"], rocketAnimation],
  [["shield", "guard", "protect", "defense", "armour", "armor", "barrier"], shieldAnimation],
  [["star", "celestial", "cosmic", "glow"], starAnimation],
  [["wand", "magic", "spell", "enchant", "sorcery", "mystic", "wizard"], wandAnimation],
]

/**
 * Given a shop item, return the Lottie animation that best matches its
 * name/description/category, or `null` for generic items.
 */
export function itemIllustration(item: {
  name?: string
  description?: string
  category?: string
}): object | null {
  const hay = `${item.name || ""} ${item.description || ""} ${item.category || ""}`.toLowerCase()
  for (const [keywords, factory] of ITEM_KEYWORDS) {
    if (keywords.some((kw) => hay.includes(kw))) {
      return factory()
    }
  }
  return null
}

/**
 * Returns item-specific art when available, otherwise falls back to the
 * appropriate generic animation for the item's category.
 */
export function artForItem(item: {
  name?: string
  description?: string
  category?: string
}): object {
  const specific = itemIllustration(item)
  if (specific) return specific

  const cat = (item.category || "").toLowerCase()
  if (cat.includes("coin")) return COIN
  if (cat.includes("premium") || cat.includes("subscription")) return SPARKLES
  if (cat.includes("gift")) return GIFT
  return SPARKLES
}
