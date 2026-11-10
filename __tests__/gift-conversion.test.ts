import { describe, expect, it } from "vitest"
import {
  CANONICAL_GIFTS,
  giftPanelTabForUse,
  type GiftUse,
} from "@/lib/gifts/catalog"
import { giftCoinValue, giftConvertedAt, giftIsConvertible } from "@/lib/gifts/conversion"

describe("gift conversion catalog", () => {
  it("defines a use, effect, and coin value for every gift", () => {
    expect(CANONICAL_GIFTS.length).toBeGreaterThanOrEqual(20)
    for (const gift of CANONICAL_GIFTS) {
      expect(gift.use).toBeTruthy()
      expect(gift.useLabel.length).toBeGreaterThan(2)
      expect(gift.effect.length).toBeGreaterThan(10)
      expect(gift.coinValue).toBeGreaterThan(0)
      expect(gift.coinValue).toBeLessThanOrEqual(gift.price)
      expect(giftPanelTabForUse(gift.use)).toBeTruthy()
    }
  })

  it("covers every requested gift category", () => {
    const uses = new Set<GiftUse>(CANONICAL_GIFTS.map((gift) => gift.use))
    for (const use of [
      "standard",
      "boost",
      "support",
      "interactive",
      "exclusive",
      "utility",
    ] as GiftUse[]) {
      expect(uses.has(use)).toBe(true)
    }
  })

  it("uses a server-stored conversion value and falls back to the catalogue", () => {
    expect(
      giftCoinValue({
        gift_name: "Pixel Heart",
        gift_value: { coin_conversion: 200 },
      }),
    ).toBe(200)
    expect(giftCoinValue({ gift_name: "Pixel Heart", gift_value: {} })).toBe(200)
  })

  it("never converts a coin gift twice and respects a recorded conversion", () => {
    expect(giftCoinValue({ gift_type: "coins", gift_value: { coins_amount: 500 } })).toBe(0)
    expect(
      giftIsConvertible({
        status: "claimed",
        gift_name: "Pixel Heart",
        gift_value: { coin_conversion: 200, converted_at: "2026-01-01T00:00:00.000Z" },
      }),
    ).toBe(false)
    expect(giftConvertedAt({ gift_value: { converted_at: "2026-01-01T00:00:00.000Z" } })).toBe(
      "2026-01-01T00:00:00.000Z",
    )
  })

  it("only converts accepted gifts", () => {
    expect(
      giftIsConvertible({
        status: "sent",
        gift_name: "Pixel Heart",
        gift_value: { coin_conversion: 200 },
      }),
    ).toBe(false)
    expect(
      giftIsConvertible({
        status: "claimed",
        gift_name: "Pixel Heart",
        gift_value: { coin_conversion: 200 },
      }),
    ).toBe(true)
  })
})
