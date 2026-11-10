import { describe, expect, it } from "vitest"
import {
  giftSenderLabel,
  mergeReceivingGifts,
  normalizeReceivingGift,
  type ReceivingGift,
} from "@/lib/gifts/receiving"
import { isPendingGift } from "@/lib/gifts/delivery"

function gift(id: string, overrides: Record<string, unknown> = {}): ReceivingGift {
  return {
    id,
    name: "Pixel Heart",
    type: "badge",
    rarity: "common",
    anonymous: false,
    sender: { id: "sender-1", username: "mira", display_name: "Mira" },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("receiving gift queue", () => {
  it("normalizes a broadcast without inventing a sender", () => {
    const parsed = normalizeReceivingGift({
      id: "gift-1",
      gift_name: "Pixel Heart",
      gift_type: "badge",
      rarity: "rare",
      art: "pixel-heart",
      is_anonymous: true,
      sender: null,
      created_at: "2026-01-01T00:00:00.000Z",
    })

    expect(parsed).toMatchObject({
      id: "gift-1",
      name: "Pixel Heart",
      anonymous: true,
      sender: null,
    })
    expect(giftSenderLabel(parsed!)).toBe("A secret admirer")
  })

  it("keeps a non-anonymous sender and hides their own echo", () => {
    const parsed = normalizeReceivingGift(
      {
        id: "gift-2",
        gift_name: "Cute Cat",
        sender: { id: "sender-2", username: "sol", display_name: "Sol" },
      },
      "viewer-1",
    )
    expect(parsed?.sender).toMatchObject({ id: "sender-2", display_name: "Sol" })

    expect(
      normalizeReceivingGift(
        {
          id: "gift-3",
          gift_name: "Cute Cat",
          sender: { id: "viewer-1", username: "me" },
        },
        "viewer-1",
      ),
    ).toBeNull()
  })

  it("deduplicates reconnect fetches and preserves arrival order", () => {
    const first = gift("gift-a", { createdAt: "2026-01-01T00:00:02.000Z" })
    const second = gift("gift-b", {
      createdAt: "2026-01-01T00:00:01.000Z",
      name: "Golden Trophy",
    })

    const queue = mergeReceivingGifts([first], [second, first, null])
    expect(queue.map((item) => item.id)).toEqual(["gift-a", "gift-b"])
    expect(mergeReceivingGifts(queue, [second])).toBe(queue)
  })

  it("does not re-add a gift the viewer dismissed this session", () => {
    const ignored = new Set(["gift-a"])
    const queue = mergeReceivingGifts([], [gift("gift-a"), gift("gift-b")], ignored)
    expect(queue.map((item) => item.id)).toEqual(["gift-b"])
  })

  it("only treats marked gifts as pending acceptance", () => {
    expect(isPendingGift({ gift_value: { delivery_pending: true } })).toBe(true)
    expect(isPendingGift({ gift_value: { delivery_pending: false } })).toBe(false)
    // Legacy gifts were delivered inline and must not be claimed twice.
    expect(isPendingGift({ gift_value: { art: "pixel-heart" } })).toBe(false)
  })
})
