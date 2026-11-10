/**
 * Gift coin-conversion rules.
 *
 * The conversion amount is attached to the gift when it is sent, then read
 * back from the database when the recipient converts it. The client never
 * supplies an amount, so a forged request cannot invent coins. Older gifts
 * fall back to the canonical catalogue by id/name.
 */

import { findCanonicalGift } from "@/lib/gifts/catalog"

type GiftLike = Record<string, any>

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {}
}

export function giftValueOf(gift: GiftLike): Record<string, any> {
  return asRecord(gift?.gift_value)
}

/** Coins already delivered as a coin gift are not convertible a second time. */
export function giftCoinValue(gift: GiftLike): number {
  const value = giftValueOf(gift)
  if (String(gift?.gift_type || value.gift_type || "").toLowerCase() === "coins") return 0

  const stored = Number(
    value.coin_conversion ?? value.coin_value ?? value.conversion_value ?? 0,
  )
  if (Number.isFinite(stored) && stored > 0) return Math.floor(stored)

  const canonical = findCanonicalGift(
    value.canonical_id || gift.canonical_id || gift.gift_name || gift.name,
  )
  return canonical?.coinValue || 0
}

export function giftConvertedAt(gift: GiftLike): string | null {
  const value = giftValueOf(gift)
  const convertedAt = value.converted_at ?? value.convertedAt
  return typeof convertedAt === "string" && convertedAt.trim() ? convertedAt : null
}

export function giftIsConvertible(gift: GiftLike): boolean {
  return (
    String(gift?.status || "").toLowerCase() === "claimed" &&
    !giftConvertedAt(gift) &&
    giftCoinValue(gift) > 0
  )
}

export function giftConversionLabel(gift: GiftLike): string | null {
  if (String(gift?.gift_type || "").toLowerCase() === "coins") return null
  const amount = giftCoinValue(gift)
  return amount > 0 ? `${amount.toLocaleString()} coins` : null
}
