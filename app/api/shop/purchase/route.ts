import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

function itemPriceCoins(item: any) {
  return Number(item.price_coins ?? item.price ?? 0) || 0
}

function resolveItemType(item: any) {
  return String(item.item_type || item.category || "item")
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const itemId = body.item_id || body.itemId
    // Always prefer coins for non-coin-pack items; coin packs can use coins too for demo reliability
    let paymentMethod = body.payment_method || "coins"
    const supabase = createServerClient()

    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "") ?? null
    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 })
    }

    if (!itemId) {
      return NextResponse.json({ success: false, error: "item_id is required" }, { status: 400 })
    }

    const { data: item, error: itemError } = await supabase.from("shop_items").select("*").eq("id", itemId).maybeSingle()
    if (itemError || !item) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 })
    }

    const itemType = resolveItemType(item)
    const priceCoins = itemPriceCoins(item)

    const { data: existingItem } = await supabase
      .from("user_inventory")
      .select("id")
      .eq("user_id", user.id)
      .eq("item_id", itemId)
      .eq("item_type", itemType)
      .maybeSingle()

    // Coin packs are consumable — allow repurchase; other items are unique
    const isCoinPack = item.category === "coins"
    if (existingItem && !isCoinPack) {
      return NextResponse.json({ success: false, error: "Item already owned" }, { status: 400 })
    }

    // Force coin checkout for themes/effects/badges so purchases work without Stripe Elements
    if (!isCoinPack) paymentMethod = "coins"
    if (isCoinPack && paymentMethod === "stripe" && !item.price_usd) paymentMethod = "coins"

    if (paymentMethod === "coins") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("loop_coins, is_premium")
        .eq("id", user.id)
        .maybeSingle()

      if (profileError || !profile) {
        return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 })
      }

      if (item.premium_only && !profile.is_premium) {
        return NextResponse.json({ success: false, error: "Premium membership required" }, { status: 403 })
      }

      if (Number(profile.loop_coins || 0) < priceCoins) {
        return NextResponse.json({ success: false, error: "Insufficient coins" }, { status: 400 })
      }

      let nextCoins = Number(profile.loop_coins || 0) - priceCoins

      // Coin packs credit coins_amount / coin_amount after deducting price
      if (isCoinPack) {
        const data = item.item_data || item.metadata || {}
        const packAmount = Number(data.coins_amount ?? data.coin_amount ?? data.amount ?? 0)
        const bonus = Number(data.bonus ?? data.bonus_coins ?? 0)
        nextCoins += packAmount + bonus
      }

      const { error: deductError } = await supabase
        .from("profiles")
        .update({ loop_coins: nextCoins, updated_at: new Date().toISOString() })
        .eq("id", user.id)

      if (deductError) {
        return NextResponse.json({ success: false, error: "Failed to deduct coins" }, { status: 500 })
      }

      if (!isCoinPack) {
        const inventoryPayload = {
          user_id: user.id,
          item_id: itemId,
          item_type: itemType,
          is_active: false,
          acquired_at: new Date().toISOString(),
        }
        const { error: inventoryError } = await supabase.from("user_inventory").insert(inventoryPayload)
        if (inventoryError) {
          // Refund coins on inventory failure
          await supabase.from("profiles").update({ loop_coins: profile.loop_coins }).eq("id", user.id)
          console.error("Inventory insert failed:", inventoryError)
          return NextResponse.json(
            { success: false, error: inventoryError.message || "Failed to add to inventory" },
            { status: 500 },
          )
        }
      }

      if (item.category === "premium" || itemType.includes("premium")) {
        const duration = item.item_data?.duration || item.metadata?.duration || "1 month"
        const premiumUntil = new Date()
        if (String(duration).includes("year")) premiumUntil.setFullYear(premiumUntil.getFullYear() + 1)
        else premiumUntil.setMonth(premiumUntil.getMonth() + 1)

        await supabase
          .from("profiles")
          .update({
            is_premium: true,
            premium_expires_at: premiumUntil.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id)
      }

      try {
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "system",
          title: "Purchase successful",
          message: `You purchased ${item.name}`,
          data: { item_id: itemId, item_name: item.name },
        })
      } catch {
        /* optional */
      }

      await supabase
        .from("shop_items")
        .update({ purchase_count: Number(item.purchase_count || 0) + 1 })
        .eq("id", itemId)

      return NextResponse.json({
        success: true,
        loop_coins: nextCoins,
        item: { id: item.id, name: item.name, category: item.category, item_type: itemType },
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: "Card checkout is not available yet. Buy with Loop Coins instead.",
      },
      { status: 400 },
    )
  } catch (error) {
    console.error("Purchase error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
