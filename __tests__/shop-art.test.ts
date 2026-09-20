/**
 * Shop art matching.
 *
 * The storefront shows an item's uploaded art when there is any, and otherwise
 * picks an animation from what the item is *called*. That fallback is what the
 * shelves are judged on — an item named "24K Rose Garden" showing a gift box is
 * the bug this file exists to prevent.
 */

import { describe, expect, it } from "vitest"
import { artForItem, itemIllustration } from "@/components/shop/shop-art"
import { ITEM_LOTTIE } from "@/lib/lottie/item-animations"

/** Animation names the factories give their documents. */
function nameOf(art: object | null): string | null {
  return art ? ((art as { nm?: string }).nm ?? null) : null
}

describe("shop item illustrations", () => {
  it("matches an illustration per item name", () => {
    expect(nameOf(itemIllustration({ name: "24K Rose Garden" }))).toBe("Rose")
    expect(nameOf(itemIllustration({ name: "Supar Car" }))).toBe("Car")
    expect(nameOf(itemIllustration({ name: "Golden Crown" }))).toBe("Crown")
    expect(nameOf(itemIllustration({ name: "Diamond Ring" }))).toBe("Diamond")
    expect(nameOf(itemIllustration({ name: "Rocket Boost" }))).toBe("Rocket")
    expect(nameOf(itemIllustration({ name: "Bouquet of Tulips" }))).toBe("Rose")
  })

  it("takes the name over the blurb", () => {
    // A name is what the buyer reads, so it wins even when the description
    // names a different thing entirely.
    const art = itemIllustration({ name: "Rose Garden", description: "a crown of stars" })
    expect(nameOf(art)).toBe("Rose")
  })

  it("falls back to the description when the name says nothing", () => {
    expect(nameOf(itemIllustration({ name: "Mystery Crate", description: "a burning flame" }))).toBe("Flame")
  })

  it("returns nothing for an item with no illustration to offer", () => {
    expect(itemIllustration({ name: "Obsidian Velvet", category: "theme" })).toBeNull()
  })

  it("falls back to a category animation, never to nothing", () => {
    expect(artForItem({ name: "Obsidian Velvet", category: "theme" })).toBeTruthy()
    expect(artForItem({ name: "500 Coins", category: "coins" })).toBeTruthy()
    expect(nameOf(artForItem({ name: "Mystery Box", category: "badge" }))).toBe("Loop sparkles")
  })

  it("covers every illustration it can produce", () => {
    // Every keyword entry must resolve to an animation that is itself tested
    // against the Lottie engine.
    for (const [key, factory] of Object.entries(ITEM_LOTTIE)) {
      expect(typeof factory).toBe("function")
      expect(nameOf(factory())).toBeTruthy()
      expect(key.length).toBeGreaterThan(1)
    }
  })
})
