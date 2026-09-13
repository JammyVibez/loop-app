import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

function mapGiftType(item: any): "coins" | "premium" | "theme" | "animation" | "effect" | "badge" | "special" {
  const category = String(item.category || "").toLowerCase()
  if (category === "coins" || item.item_type === "gift_currency") return "coins"
  if (category === "premium") return "premium"
  if (category === "theme") return "theme"
  if (category === "animation") return "animation"
  if (category === "effect") return "effect"
  if (category === "badge" || String(item.item_type || "").includes("badge") || item.item_type === "gift_item") {
    return "badge"
  }
  return "special"
}

function isGiftable(item: any) {
  if (!item?.is_active) return false
  if (item.item_data?.is_giftable === true) return true
  if (String(item.item_type || "").startsWith("gift_")) return true
  if (item.category === "premium" && Number(item.price_coins || 0) > 0) return true
  return false
}

function addPremiumDuration(base: Date, durationRaw?: string) {
  const duration = String(durationRaw || "1 month").toLowerCase()
  const next = new Date(base)
  const amount = Number.parseInt(duration, 10) || 1
  if (duration.includes("week")) next.setDate(next.getDate() + amount * 7)
  else if (duration.includes("year")) next.setFullYear(next.getFullYear() + amount)
  else next.setMonth(next.getMonth() + amount)
  return next
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const recipientId = body.recipient_id as string
    const giftItemId = (body.gift_item_id || body.gift_id) as string
    const message = typeof body.message === "string" ? body.message.trim() : ""
    const isAnonymous = Boolean(body.is_anonymous)
    const context = body.context || null
    const effects = body.effects || null

    if (!recipientId || !giftItemId) {
      return NextResponse.json({ success: false, error: "recipient_id and gift_item_id are required" }, { status: 400 })
    }


    const supabase = createServerClient()
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 })
    }

    if (recipientId === user.id) {
      return NextResponse.json({ success: false, error: "You cannot gift yourself" }, { status: 400 })
    }

    const { data: giftItem, error: giftError } = await supabase
      .from("shop_items")
      .select("*")
      .eq("id", giftItemId)
      .eq("is_active", true)
      .maybeSingle()

    if (giftError || !giftItem || !isGiftable(giftItem)) {
      return NextResponse.json({ success: false, error: "Gift item not found or unavailable" }, { status: 404 })
    }

    const giftCost = Number(giftItem.price_coins || giftItem.price || 0)
    if (giftCost <= 0) {
      return NextResponse.json({ success: false, error: "Invalid gift price" }, { status: 400 })
    }

    const { data: sender, error: senderError } = await supabase
      .from("profiles")
      .select("id, loop_coins, username, display_name, avatar_url, video_avatar_url")
      .eq("id", user.id)
      .single()

    if (senderError || !sender) {
      return NextResponse.json({ success: false, error: "Sender profile not found" }, { status: 404 })
    }

    if (Number(sender.loop_coins || 0) < giftCost) {
      return NextResponse.json({ success: false, error: "Insufficient coins" }, { status: 400 })
    }

    const { data: recipient, error: recipientError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, loop_coins, is_premium, premium_expires_at")
      .eq("id", recipientId)
      .single()

    if (recipientError || !recipient) {
      return NextResponse.json({ success: false, error: "Recipient not found" }, { status: 404 })
    }

    // Atomic coin deduction
    const { data: deductedRows, error: deductError } = await supabase
      .from("profiles")
      .update({
        loop_coins: Number(sender.loop_coins) - giftCost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .gte("loop_coins", giftCost)
      .select("loop_coins")

    if (deductError || !deductedRows?.length) {
      return NextResponse.json({ success: false, error: "Failed to deduct coins" }, { status: 400 })
    }

    const newBalance = deductedRows[0].loop_coins
    const giftType = mapGiftType(giftItem)
    const coinAmount =
      Number(giftItem.item_data?.coins_amount ?? giftItem.item_data?.coin_amount ?? 0) ||
      (giftType === "coins" ? giftCost : 0)

    // Deliver gift effects
    try {
      if (giftType === "coins") {
        await supabase
          .from("profiles")
          .update({
            loop_coins: Number(recipient.loop_coins || 0) + coinAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipientId)
      } else if (giftType === "premium") {
        const currentExpiry =
          recipient.premium_expires_at && new Date(recipient.premium_expires_at) > new Date()
            ? new Date(recipient.premium_expires_at)
            : new Date()
        const premiumExpiresAt = addPremiumDuration(currentExpiry, giftItem.item_data?.duration)
        await supabase
          .from("profiles")
          .update({
            is_premium: true,
            premium_expires_at: premiumExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipientId)
      } else {
        await supabase.from("user_inventory").upsert(
          {
            user_id: recipientId,
            item_id: giftItem.id,
            item_type: giftItem.item_type || giftType || "gift_item",
            is_active: true,
            acquired_at: new Date().toISOString(),
          },
          { onConflict: "user_id,item_id,item_type" },
        )
      }
    } catch (deliveryError) {
      console.error("Gift delivery error:", deliveryError)
      // Refund sender on delivery failure
      await supabase
        .from("profiles")
        .update({ loop_coins: Number(sender.loop_coins), updated_at: new Date().toISOString() })
        .eq("id", user.id)
      return NextResponse.json({ success: false, error: "Failed to deliver gift" }, { status: 500 })
    }

    const giftValue = {
      shop_item_id: giftItem.id,
      category: giftItem.category,
      item_type: giftItem.item_type,
      item_data: giftItem.item_data || {},
      effects: effects || giftItem.item_data || {},
      coins_amount: coinAmount || null,
      is_anonymous: isAnonymous,
    }

    const loopId = context?.type === "post" || context?.type === "branch" || context?.type === "comment" ? context.id : null
    const streamId = context?.type === "stream" ? context.id : null

    const { data: giftRecord, error: giftInsertError } = await supabase
      .from("gifts")
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        gift_type: giftType,
        gift_name: giftItem.name,
        name: giftItem.name,
        description: giftItem.description || null,
        gift_value: giftValue,
        cost: giftCost,
        price_coins: giftCost,
        message: message || null,
        is_anonymous: isAnonymous,
        status: "sent",
        context_type: context?.type || null,
        context_id: context?.id || null,
        effects: effects || giftItem.item_data || {},
        rarity: giftItem.rarity || giftItem.item_data?.rarity || "common",
        category: giftItem.category || "general",
        icon_url: giftItem.icon_url || giftItem.preview_url || null,
        is_active: true,
        delivered_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (giftInsertError) {
      console.error("Gift record insert error:", giftInsertError)
      // Refund on failure to record
      await supabase
        .from("profiles")
        .update({ loop_coins: Number(sender.loop_coins), updated_at: new Date().toISOString() })
        .eq("id", user.id)
      return NextResponse.json({ success: false, error: giftInsertError.message || "Failed to record gift" }, { status: 500 })
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("gift_transactions")
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        gift_id: giftRecord.id,
        loop_id: loopId,
        stream_id: streamId,
        quantity: 1,
        total_cost: giftCost,
        message: message || null,
      })
      .select("*")
      .single()

    if (transactionError) {
      console.error("Gift transaction insert error:", transactionError)
    }

    await supabase.from("coin_transactions").insert([
      {
        user_id: user.id,
        amount: -giftCost,
        transaction_type: "gift_sent",
        description: `Sent ${giftItem.name} to @${recipient.username}`,
        reference_id: giftRecord.id,
      },
      ...(giftType === "coins"
        ? [
            {
              user_id: recipientId,
              amount: coinAmount,
              transaction_type: "gift_received",
              description: `Received ${giftItem.name} from ${isAnonymous ? "someone" : `@${sender.username}`}`,
              reference_id: giftRecord.id,
            },
          ]
        : []),
    ])

    // Creator earnings + XP for both sides.
    // IMPORTANT: "coins" gifts already deposit real spendable loop_coins into
    // the recipient's balance above — crediting withdrawable available_earnings
    // for the same value on top of that would let a single Stripe-purchased
    // coin pack be both spent in-app AND cashed out as real money. Only
    // non-coin gifts (themes/premium/badges/effects — where the recipient gets
    // an item, not raw coins) convert their coin cost into creator earnings.
    try {
      const { awardEarnings, coinsToEarnings } = await import("@/lib/earnings")
      const { awardXp } = await import("@/lib/xp")
      if (giftType !== "coins") {
        const earningAmount = coinsToEarnings(giftCost)
        if (earningAmount > 0) {
          await awardEarnings(supabase, recipientId, earningAmount, {
            source: "gift",
            reference_id: giftRecord.id,
            description: `Earnings from ${giftItem.name}`,
          })
        }
      }
      await awardXp(supabase, user.id, "gift_sent", `Sent gift ${giftItem.name}`)
      await awardXp(supabase, recipientId, "gift_received", `Received gift ${giftItem.name}`)
    } catch (xpEarnError) {
      console.error("Gift XP/earnings error:", xpEarnError)
    }

    await supabase.from("notifications").insert({
      user_id: recipientId,
      type: "gift_received",
      title: "Gift received",
      message: `${isAnonymous ? "Someone" : sender.display_name || sender.username} sent you ${giftItem.name}${
        message ? `: “${message}”` : ""
      }`,
      data: {
        gift_id: giftRecord.id,
        shop_item_id: giftItem.id,
        gift_name: giftItem.name,
        gift_type: giftType,
        gift_rarity: giftItem.rarity || "common",
        sender_id: isAnonymous ? null : user.id,
        sender_name: isAnonymous ? null : sender.display_name,
        message: message || null,
        transaction_id: transaction?.id || null,
        context,
        // Deep-link to the community post when the gift was sent from one
        ...(context?.type === "post" && context?.circle_id
          ? { url: `/communities/${context.circle_id}/posts/${context.id}`, action_url: `/communities/${context.circle_id}/posts/${context.id}` }
          : {}),
      },
      actor_id: isAnonymous ? null : user.id,
      is_read: false,
    })

    try {
      const { sendWebPushToUser } = await import("@/lib/web-push")
      await sendWebPushToUser(
        recipientId,
        {
          title: "Gift received",
          body: `${isAnonymous ? "Someone" : sender.display_name || sender.username} sent you ${giftItem.name}`,
          url: "/notifications",
          tag: `gift-${giftRecord.id}`,
        },
        { category: "giftRewards" },
      )
    } catch (pushErr) {
      console.warn("Gift push failed:", pushErr)
    }

    try {
      await supabase.channel(`user:${recipientId}`).send({
        type: "broadcast",
        event: "gift_received",
        payload: {
          id: giftRecord.id,
          gift_name: giftItem.name,
          gift_type: giftType,
          rarity: giftItem.rarity || "common",
          sender: isAnonymous
            ? null
            : {
                id: user.id,
                username: sender.username,
                display_name: sender.display_name,
                avatar_url: sender.avatar_url,
              },
          message: message || null,
          context,
        },
      })
    } catch { /* intentionally silent */ }

    return NextResponse.json({
      success: true,
      transaction_id: transaction?.id || null,
      gift_id: giftRecord.id,
      new_balance: newBalance,
      gift: {
        id: giftRecord.id,
        shop_item_id: giftItem.id,
        name: giftItem.name,
        type: giftType,
        rarity: giftItem.rarity || "common",
        effects,
      },
      recipient: {
        id: recipientId,
        username: recipient.username,
        display_name: recipient.display_name,
      },
    })
  } catch (error) {
    console.error("Gift send error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
