import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import {
  CANONICAL_GIFTS,
  GIFT_TYPE_PALETTE,
  giftDurationLabel,
  giftPanelTabForUse,
  giftTypeForTab,
  type CanonicalGift,
} from "@/lib/gifts/catalog"

export const dynamic = "force-dynamic"

function isGiftable(item: any) {
  if (!item?.is_active) return false
  if (item.item_data?.is_giftable === true) return true
  if (String(item.item_type || "").startsWith("gift_")) return true
  if (item.category === "premium" && Number(item.price_coins || 0) > 0) return true
  return false
}

function mapGiftType(item: any): string {
  const category = String(item.category || "").toLowerCase()
  const itemType = String(item.item_type || "").toLowerCase()
  if (category === "coins" || itemType === "gift_currency") return "coins"
  if (category === "premium") return "premium"
  if (category === "theme") return "theme"
  if (category === "animation") return "animation"
  if (category === "effect") return "effect"
  if (category === "badge" || itemType.includes("badge") || itemType === "gift_item") return "badge"
  return "badge"
}

function canonicalGiftPayload(gift: CanonicalGift) {
  const seconds = giftDurationLabel(gift.durationMs)
  return {
    id: gift.id,
    canonical_id: gift.id,
    name: gift.name,
    description: gift.description,
    type: gift.type,
    tab: giftPanelTabForUse(gift.use),
    use: gift.use,
    use_type: gift.use,
    use_label: gift.useLabel,
    effect: gift.effect,
    coin_value: gift.coinValue,
    coin_conversion: gift.coinValue,
    effect_hours: gift.effectHours || null,
    boost_amount: gift.boostAmount || null,
    category: gift.type,
    item_type:
      gift.type === "badge" ? "gift_item" : gift.type === "effect" ? "gift_effect" : "gift_animation",
    cost: gift.price,
    price_coins: gift.price,
    rarity: gift.rarity,
    icon_url: null,
    preview: null,
    duration: seconds,
    duration_ms: gift.durationMs,
    art: gift.art,
    celebration: gift.celebration,
    palette: gift.palette,
    is_canonical: true,
    item_data: {
      is_giftable: true,
      gift_art: gift.art,
      celebration: gift.celebration,
      palette: gift.palette,
      rarity: gift.rarity,
      duration_ms: gift.durationMs,
      use_type: gift.use,
      use_label: gift.useLabel,
      effect: gift.effect,
      coin_conversion: gift.coinValue,
      effect_hours: gift.effectHours || null,
      boost_amount: gift.boostAmount || null,
      gift_animation: { type: "fullscreen", duration_ms: gift.durationMs },
    },
    effects: {
      animation: gift.celebration,
      art: gift.art,
      palette: gift.palette,
      duration_ms: gift.durationMs,
      particles: true,
      sound: gift.sound || null,
    },
  }
}

/** Stable ordering: the ten signature gifts first, then the shop catalog. */
export async function GET() {
  const canonicalNames = new Set(CANONICAL_GIFTS.map((gift) => gift.name.toLowerCase()))
  const canonical = CANONICAL_GIFTS.map(canonicalGiftPayload)

  try {
    const supabase = createServerClient()
    const { data: items, error } = await supabase
      .from("shop_items")
      .select("*")
      .eq("is_active", true)
      .order("price_coins", { ascending: true })

    if (error) throw error

    const shopGifts = (items || [])
      .filter(isGiftable)
      .filter((item) => Number(item.price_coins || 0) > 0)
      .filter((item) => !canonicalNames.has(String(item.name || "").toLowerCase()))
      .map((item) => {
        const type = mapGiftType(item)
        const itemData = item.item_data || {}
        const useType = String(itemData?.use_type || itemData?.use || "").toLowerCase()
        const use = useType || (type === "coins" ? "currency" : type === "premium" ? "premium" : type === "effect" ? "utility" : type === "animation" ? "interactive" : "standard")
        const tab = useType ? giftPanelTabForUse(useType) : giftTypeForTab(type)
        const durationMs =
          Number(itemData?.gift_animation?.duration_ms) || Number(itemData?.duration_ms) || 0
        const price = Number(item.price_coins || 0)
        const coinValue =
          type === "coins"
            ? 0
            : Math.max(
                0,
                Math.floor(
                  Number(itemData?.coin_conversion ?? itemData?.coin_value) || price * 0.8,
                ),
              )
        return {
          id: item.id,
          canonical_id: null,
          name: item.name,
          description: item.description || itemData?.description || "A thoughtful Loop gift",
          type,
          tab,
          use,
          use_type: use,
          use_label:
            itemData?.use_label ||
            (type === "coins"
              ? "Coins"
              : type === "premium"
                ? "Premium access"
                : use === "utility"
                  ? "Profile utility"
                  : use === "interactive"
                    ? "Reaction unlock"
                    : "Collectible"),
          effect:
            itemData?.effect ||
            (type === "coins"
              ? "Delivers Loop Coins directly to your balance."
              : "Adds this gift to your collection when accepted."),
          coin_value: coinValue,
          coin_conversion: coinValue,
          effect_hours: Number(itemData?.effect_hours || 0) || null,
          boost_amount: Number(itemData?.boost_amount || 0) || null,
          category: item.category,
          item_type: item.item_type,
          cost: price,
          price_coins: price,
          rarity: item.rarity || itemData?.rarity || "common",
          icon_url: item.icon_url || item.preview_url || null,
          preview: item.preview_url || item.icon_url || null,
          duration: durationMs ? giftDurationLabel(durationMs) : itemData?.duration || null,
          duration_ms: durationMs || null,
          art: itemData?.gift_art || null,
          celebration: itemData?.celebration || null,
          palette: itemData?.palette || GIFT_TYPE_PALETTE[tab],
          is_canonical: false,
          effects: {
            animation: itemData?.animation || item.preview_data?.animation || "sparkle",
            art: itemData?.gift_art || null,
            palette: itemData?.palette || GIFT_TYPE_PALETTE[tab],
            duration_ms: durationMs || null,
            particles: true,
          },
          item_data: {
            ...itemData,
            use_type: use,
            use_label: itemData?.use_label || null,
            effect: itemData?.effect || null,
            coin_conversion: coinValue,
          },
        }
      })

    return NextResponse.json({
      success: true,
      data: { gifts: [...canonical, ...shopGifts] },
      gifts: [...canonical, ...shopGifts],
    })
  } catch (error) {
    // The canonical ten must remain sendable even if the shop table is down.
    console.error("Get gifts error:", error)
    return NextResponse.json({ success: true, data: { gifts: canonical }, gifts: canonical })
  }
}
