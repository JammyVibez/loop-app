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

export const COIN = coinAnimation()
export const COIN_GOLD = coinAnimation(paletteForRarity("legendary"))
export const LOADER = loaderAnimation()
export const EMPTY_BOX = emptyBoxAnimation()
export const LOCK = lockAnimation()
export const SPARKLES = sparkleAnimation()
export const GIFT = giftAnimation()

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
