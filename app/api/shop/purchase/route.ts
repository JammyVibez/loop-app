import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getStripeServer } from "@/lib/stripe-server"
import { getAppUrl } from "@/lib/app-url"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

function itemPriceCoins(item: any) {
  return Number(item.price_coins ?? item.price ?? 0) || 0
}

function resolveItemType(item: any) {
  return String(item.item_type || item.category || "item")
}

function coinPackTotalCoins(item: any) {
  const base = Number(item.item_data?.coins_amount ?? 0) || 0
  const bonus = Number(item.item_data?.bonus ?? 0) || 0
  return base + bonus
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const itemId = body.item_id || body.itemId
    let paymentMethod = body.payment_method || "coins"
    const supabase = createServerClient()


    const user = await getUserFromRequest(request);
    if (!user) {
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
    const priceUsd = Number(item.price_usd || 0)

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

    // Coin packs are always bought with real money via Stripe Checkout. Other
    // items default to Loop Coins, but any item that carries a USD price can
    // also be paid for with a card (Stripe Checkout).
    if (isCoinPack) paymentMethod = "stripe"
    if (!isCoinPack && paymentMethod !== "stripe") paymentMethod = "coins"

    if (isCoinPack && !item.price_usd) {
      return NextResponse.json(
        { success: false, error: "This coin pack isn't configured for purchase yet. Contact support." },
        { status: 400 },
      )
    }

    if (!isCoinPack && paymentMethod === "stripe" && !priceUsd) {
      return NextResponse.json(
        { success: false, error: "This item isn't available for card payment yet. Buy it with Loop Coins." },
        { status: 400 },
      )
    }

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

      const nextCoins = Number(profile.loop_coins || 0) - priceCoins

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

    if (paymentMethod === "stripe") {
      const totalCoins = isCoinPack ? coinPackTotalCoins(item) : 0

      if (priceUsd <= 0) {
        return NextResponse.json(
          { success: false, error: "This item is not configured for purchase yet." },
          { status: 400 },
        )
      }

      const stripe = await getStripeServer()
      if (!stripe) {
        return NextResponse.json(
          { success: false, error: "Card payments are temporarily unavailable. Please try again later." },
          { status: 503 },
        )
      }

      const appUrl = getAppUrl(request)
      const productName = isCoinPack ? item.name || "Loop Coins" : item.name || "Loop item"
      const productDescription = isCoinPack
        ? item.description || `${totalCoins.toLocaleString()} Loop Coins`
        : item.description || "Loop Shop item"
      const successPath = isCoinPack ? "/wallet" : "/shop"

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: user.email || undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(priceUsd * 100),
              product_data: {
                name: productName,
                description: productDescription,
              },
            },
          },
        ],
        metadata: isCoinPack
          ? {
              kind: "coin_pack",
              user_id: user.id,
              item_id: item.id,
              coins_amount: String(totalCoins),
            }
          : {
              kind: "shop_item",
              user_id: user.id,
              item_id: item.id,
              item_type: itemType,
              item_name: item.name,
            },
        success_url: `${appUrl}${successPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}${successPath}?checkout=cancelled`,
      })

      if (!session.url) {
        return NextResponse.json(
          { success: false, error: "Could not start checkout. Please try again." },
          { status: 502 },
        )
      }

      return NextResponse.json({ success: true, checkout_url: session.url })
    }

    return NextResponse.json(
      {
        success: false,
        error: "Card checkout is not available for this item. Buy with Loop Coins instead.",
      },
      { status: 400 },
    )
  } catch (error) {
    console.error("Purchase error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
