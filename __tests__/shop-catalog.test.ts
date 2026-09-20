/**
 * The shop's shelves are derived from the live catalogue, where the two
 * category columns overlap on purpose: themes are stored as
 * `theme / profile_theme`, a coin pack as `coins / currency`, an animated gift
 * as `badge / gift_item`. A keyword match files those on two shelves at once —
 * which is exactly what these tests pin down.
 */

import { describe, expect, it } from "vitest"
import {
  coinPrice,
  matchesQuery,
  rarityRank,
  shopBucket,
  sortShopItems,
  type ShopCatalogItem,
} from "@/lib/shop-catalog"

function item(overrides: Partial<ShopCatalogItem> = {}): ShopCatalogItem {
  return {
    id: overrides.id || "item-1",
    name: "Sunset Blaze Theme",
    description: "A warm palette",
    price: 700,
    price_coins: 700,
    price_usd: 0,
    category: "theme",
    item_type: "profile_theme",
    rarity: "rare",
    premium_only: false,
    item_data: {},
    ...overrides,
  }
}

describe("shop shelves", () => {
  // One row per distinct (category, item_type) pair in the live catalogue.
  const LIVE_ROWS: Array<[string, string, string]> = [
    ["theme", "profile_theme", "theme"],
    ["theme", "theme", "theme"],
    ["animation", "avatar_effect", "effect"],
    ["animation", "gift_animation", "effect"],
    ["animation", "cursor_effect", "effect"],
    ["effect", "aura_effect", "effect"],
    ["effect", "particle_effect", "effect"],
    ["card_effect", "post_card_effect", "effect"],
    ["card_effect", "card_border", "effect"],
    ["badge", "gift_item", "identity"],
    ["badge", "achievement_badge", "identity"],
    ["font", "font_family", "identity"],
    ["avatar", "accessory", "identity"],
    ["premium", "subscription", "identity"],
    ["coins", "currency", "coins"],
    ["coins", "gift_currency", "coins"],
  ]

  it.each(LIVE_ROWS)("files %s / %s on the %s shelf", (category, item_type, expected) => {
    expect(shopBucket({ category, item_type } as ShopCatalogItem)).toBe(expected)
  })

  it("never files a theme on the identity shelf, despite the `profile_theme` type", () => {
    const theme = item({ category: "theme", item_type: "profile_theme" })
    expect(shopBucket(theme)).toBe("theme")
    expect(shopBucket(theme)).not.toBe("identity")
  })

  it("never files an animated gift under the shelf its category name suggests", () => {
    // `badge / gift_item` is a sendable animation, not something you wear.
    expect(shopBucket(item({ category: "badge", item_type: "gift_item" }))).toBe("identity")
    expect(shopBucket(item({ category: "animation", item_type: "gift_animation" }))).toBe("effect")
  })

  it("keeps an unknown category reachable instead of dropping it", () => {
    expect(shopBucket(item({ category: "something_new", item_type: "mystery" }))).toBe("other")
    expect(shopBucket(item({ category: "", item_type: "" }))).toBe("other")
    expect(shopBucket(item({ category: "THEME", item_type: "PROFILE_THEME" }))).toBe("theme")
  })
})

describe("shop prices", () => {
  it("prefers price_coins and falls back to the legacy price column", () => {
    expect(coinPrice({ price: 100, price_coins: 700 })).toBe(700)
    expect(coinPrice({ price: 100, price_coins: null })).toBe(100)
    expect(coinPrice({ price: 100 })).toBe(100)
    expect(coinPrice({ price: 0, price_coins: 0 })).toBe(0)
  })

  it("treats a missing or malformed price as free rather than NaN", () => {
    expect(coinPrice({ price: undefined as unknown as number, price_coins: undefined })).toBe(0)
    expect(
      coinPrice({ price: "oops" as unknown as number, price_coins: "nope" as unknown as number }),
    ).toBe(0)
  })
})

describe("shop sorting", () => {
  const cheap = item({ id: "cheap", name: "Cheap", rarity: "common", price_coins: 100, purchase_count: 5 })
  const mid = item({ id: "mid", name: "Mid", rarity: "rare", price_coins: 500, purchase_count: 99 })
  const dear = item({ id: "dear", name: "Dear", rarity: "legendary", price_coins: 900, purchase_count: 1 })

  it("does not rearrange the caller's array", () => {
    const original = [dear, cheap, mid]
    const sorted = sortShopItems([dear, cheap, mid], "cheap")
    expect(original.map((i) => i.id)).toEqual(["dear", "cheap", "mid"])
    expect(sorted.map((i) => i.id)).toEqual(["cheap", "mid", "dear"])
  })

  it("orders by coins, both ways", () => {
    expect(sortShopItems([mid, dear, cheap], "cheap").map((i) => i.id)).toEqual(["cheap", "mid", "dear"])
    expect(sortShopItems([mid, dear, cheap], "expensive").map((i) => i.id)).toEqual(["dear", "mid", "cheap"])
  })

  it("puts the rarest first when featured", () => {
    expect(sortShopItems([cheap, dear, mid], "featured").map((i) => i.id)).toEqual(["dear", "mid", "cheap"])
  })

  it("ranks unknown rarities last rather than throwing", () => {
    const odd = item({ id: "odd", rarity: "mythic", price_coins: 5000 })
    expect(rarityRank("mythic")).toBe(0)
    expect(sortShopItems([odd, cheap], "featured").map((i) => i.id)).toEqual(["cheap", "odd"])
  })

  it("orders newest first, with undated rows last", () => {
    const old = item({ id: "old", created_at: "2025-01-01T00:00:00Z" })
    const recent = item({ id: "recent", created_at: "2026-08-01T00:00:00Z" })
    const undated = item({ id: "undated", created_at: undefined })
    expect(sortShopItems([old, undated, recent], "new").map((i) => i.id)).toEqual([
      "recent",
      "old",
      "undated",
    ])
  })
})

describe("shop search", () => {
  it("matches names, descriptions, category and item type, case-insensitively", () => {
    const row = item({ name: "Aurora Card Effect", description: "Ribbon of light", category: "card_effect", item_type: "post_card_effect" })
    expect(matchesQuery(row, "aurora")).toBe(true)
    expect(matchesQuery(row, "RIBBON")).toBe(true)
    expect(matchesQuery(row, "post_card")).toBe(true)
    expect(matchesQuery(row, "   ")).toBe(true)
    expect(matchesQuery(row, "teleporter")).toBe(false)
  })
})
