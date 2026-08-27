import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

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
  if (category === "coins" || item.item_type === "gift_currency") return "coins"
  if (category === "premium") return "premium"
  if (category === "theme") return "theme"
  if (category === "animation") return "animation"
  if (category === "effect") return "effect"
  if (category === "badge" || item.item_type?.includes("badge") || item.item_type === "gift_item") return "badge"
  return "special"
}

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: items, error } = await supabase
      .from("shop_items")
      .select("*")
      .eq("is_active", true)
      .order("price_coins", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const gifts = (items || [])
      .filter(isGiftable)
      .filter((item) => Number(item.price_coins || 0) > 0)
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description || item.item_data?.description || "A thoughtful Loop gift",
        type: mapGiftType(item),
        category: item.category,
        item_type: item.item_type,
        cost: Number(item.price_coins || 0),
        price_coins: Number(item.price_coins || 0),
        rarity: item.rarity || item.item_data?.rarity || "common",
        icon_url: item.icon_url || item.preview_url || null,
        preview: item.preview_url || item.icon_url || null,
        duration: item.item_data?.duration || null,
        item_data: item.item_data || {},
        effects: {
          animation: item.item_data?.animation || item.preview_data?.animation || "sparkle",
          particles: true,
        },
      }))

    // Fallback catalog if shop has no giftable rows
    if (!gifts.length) {
      return NextResponse.json({
        success: true,
        data: {
          gifts: [
            {
              id: "fallback-coins-100",
              name: "100 Loop Coins",
              description: "A small token of appreciation",
              type: "coins",
              cost: 100,
              price_coins: 100,
              rarity: "common",
              item_data: { coins_amount: 100, is_giftable: true },
            },
          ],
        },
      })
    }

    return NextResponse.json({ success: true, data: { gifts }, gifts })
  } catch (error) {
    console.error("Get gifts error:", error)
    return NextResponse.json({ error: "Failed to fetch gifts" }, { status: 500 })
  }
}
