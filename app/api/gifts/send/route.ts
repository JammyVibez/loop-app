import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { recipient_id, gift_item_id, message, is_anonymous, context, effects } = await request.json()
    const supabase = createClient()

    // Get user from auth header
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

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

    const { data: giftItem, error: giftError } = await supabase
      .from("shop_items")
      .select("*")
      .eq("id", gift_item_id)
      .eq("is_active", true)
      .single()

    if (giftError || !giftItem) {
      return NextResponse.json({ success: false, error: "Gift item not found or unavailable" }, { status: 404 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("loop_coins, username, display_name, avatar_url")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 })
    }

    const giftCost = giftItem.price_coins || giftItem.price || 0
    if (profile.loop_coins < giftCost) {
      return NextResponse.json({ success: false, error: "Insufficient coins" }, { status: 400 })
    }

    const { data: recipientProfile, error: recipientError } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", recipient_id)
      .single()

    if (recipientError || !recipientProfile) {
      return NextResponse.json({ success: false, error: "Recipient not found" }, { status: 404 })
    }

    // Start transaction
    const { error: deductError } = await supabase
      .from("profiles")
      .update({
        loop_coins: profile.loop_coins - giftCost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (deductError) {
      return NextResponse.json({ success: false, error: "Failed to deduct coins" }, { status: 500 })
    }

    if (giftItem.category === "coins") {
      // Add coins to recipient
      const coinAmount = giftItem.item_data?.coin_amount || giftCost
      await supabase.rpc("add_user_coins", {
        p_user_id: recipient_id,
        p_amount: coinAmount,
      })
    } else if (giftItem.category === "premium") {
      // Grant premium subscription
      const duration = giftItem.item_data?.duration || "1 week"
      const premiumUntil = new Date()

      if (duration.includes("week")) {
        const weeks = Number.parseInt(duration) || 1
        premiumUntil.setDate(premiumUntil.getDate() + weeks * 7)
      } else if (duration.includes("month")) {
        const months = Number.parseInt(duration) || 1
        premiumUntil.setMonth(premiumUntil.getMonth() + months)
      }

      await supabase
        .from("profiles")
        .update({
          is_premium: true,
          premium_until: premiumUntil.toISOString(),
        })
        .eq("id", recipient_id)
    } else {
      // Add item to recipient's inventory
      await supabase.from("user_inventory").upsert({
        user_id: recipient_id,
        item_id: gift_item_id,
        quantity: 1,
        acquired_at: new Date().toISOString(),
      })
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("gift_transactions")
      .insert({
        sender_id: user.id,
        recipient_id,
        gift_item_id,
        gift_name: giftItem.name,
        gift_cost: giftCost,
        message: message || null,
        is_anonymous,
        context_type: context?.type || null,
        context_id: context?.id || null,
        effects: effects || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (transactionError) {
      console.error("Transaction recording error:", transactionError)
      // Don't fail the request, just log the error
    }

    await supabase.from("notifications").insert({
      user_id: recipient_id,
      type: "gift_received",
      title: `Gift Received! 🎁`,
      message: `${is_anonymous ? "Someone" : profile.display_name} sent you ${giftItem.name}${message ? ` with a message: "${message}"` : ""}`,
      data: {
        gift_id: gift_item_id,
        gift_name: giftItem.name,
        gift_rarity: giftItem.rarity || "common",
        sender_id: is_anonymous ? null : user.id,
        sender_name: is_anonymous ? null : profile.display_name,
        message: message || null,
        effects: effects || null,
        transaction_id: transaction?.id,
      },
      is_read: false,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      transaction_id: transaction?.id,
      new_balance: profile.loop_coins - giftCost,
      gift: {
        id: giftItem.id,
        name: giftItem.name,
        type: giftItem.category,
        rarity: giftItem.rarity || "common",
        effects: effects,
      },
      recipient: {
        id: recipient_id,
        username: recipientProfile.username,
        display_name: recipientProfile.display_name,
      },
    })
  } catch (error) {
    console.error("Gift send error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
