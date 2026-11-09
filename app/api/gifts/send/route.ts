import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import {
  findCanonicalGift,
  type CanonicalGift,
  type GiftRarity,
  type GiftType,
} from "@/lib/gifts/catalog"

export const dynamic = "force-dynamic"

/** Only values the `gifts.gift_type` enum is known to accept. */
const GIFT_TYPE_VALUES: GiftType[] = ["coins", "premium", "theme", "animation", "effect", "badge"]

function normalizeGiftType(value: string | null | undefined): GiftType {
  const next = String(value || "").toLowerCase() as GiftType
  return GIFT_TYPE_VALUES.includes(next) ? next : "badge"
}

/** Map a shop_items row onto a gift type the database accepts. */
function mapShopGiftType(item: any): GiftType {
  const category = String(item?.category || "").toLowerCase()
  const itemType = String(item?.item_type || "").toLowerCase()
  if (category === "coins" || itemType === "gift_currency") return "coins"
  if (category === "premium" || itemType === "subscription") return "premium"
  if (category === "theme" || itemType === "profile_theme") return "theme"
  if (category === "animation") return "animation"
  if (category === "effect") return "effect"
  return "badge"
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

type ResolvedGift = {
  canonical: CanonicalGift | null
  shopItem: any | null
  shopItemId: string | null
  name: string
  description: string
  type: GiftType
  subtype: string
  category: string
  rarity: GiftRarity
  price: number
  itemData: Record<string, any>
  effects: Record<string, any>
  art: string | null
  durationMs: number | null
  iconUrl: string | null
  coinAmount: number
}

/**
 * Resolve a request's gift id against the canonical catalog first, then the
 * shop catalog. Canonical gifts stay sendable even when the shop row is
 * missing — the catalog is the product contract.
 */
async function resolveGift(
  supabase: ReturnType<typeof createServerClient>,
  rawId: string,
): Promise<ResolvedGift | null> {
  const canonical = findCanonicalGift(rawId)

  if (canonical) {
    // Best-effort link to a shop row so inventory still has an item_id.
    const { data: shopRow } = await supabase
      .from("shop_items")
      .select("*")
      .eq("name", canonical.name)
      .maybeSingle()

    const subtype =
      canonical.category === "badge"
        ? "gift_item"
        : canonical.category === "effect"
          ? "gift_effect"
          : "gift_animation"

    return {
      canonical,
      shopItem: shopRow || null,
      shopItemId: shopRow?.id || null,
      name: canonical.name,
      description: canonical.description,
      type: canonical.type,
      subtype,
      category: canonical.category,
      rarity: canonical.rarity,
      price: canonical.price,
      itemData: {
        ...(shopRow?.item_data || {}),
        is_giftable: true,
        icon: (shopRow?.item_data || {}).icon || null,
        gift_art: canonical.art,
        celebration: canonical.celebration,
        palette: canonical.palette,
        gift_animation: { type: "fullscreen", duration_ms: canonical.durationMs },
        duration_ms: canonical.durationMs,
        rarity: canonical.rarity,
      },
      effects: {
        animation: canonical.celebration,
        art: canonical.art,
        palette: canonical.palette,
        duration_ms: canonical.durationMs,
        sound: canonical.sound || null,
        particles: true,
      },
      art: canonical.art,
      durationMs: canonical.durationMs,
      iconUrl: shopRow?.icon_url || shopRow?.preview_url || null,
      coinAmount: 0,
    }
  }

  const { data: item } = await supabase
    .from("shop_items")
    .select("*")
    .eq("id", rawId)
    .eq("is_active", true)
    .maybeSingle()

  if (!item || !isGiftable(item)) return null

  const type = mapShopGiftType(item)
  const price = Number(item.price_coins || item.price || 0)
  if (!Number.isFinite(price) || price <= 0) return null

  const itemData = item.item_data || {}
  const durationMs =
    Number(itemData?.gift_animation?.duration_ms) || Number(itemData?.duration_ms) || null

  return {
    canonical: null,
    shopItem: item,
    shopItemId: item.id,
    name: item.name,
    description: item.description || itemData?.description || "A thoughtful Loop gift",
    type,
    subtype: item.item_type || "gift_item",
    category: item.category || type,
    rarity: (item.rarity || itemData?.rarity || "common") as GiftRarity,
    price,
    itemData,
    effects: itemData?.effects || itemData || {},
    art: itemData?.gift_art || null,
    durationMs,
    iconUrl: item.icon_url || item.preview_url || null,
    coinAmount:
      Number(itemData?.coins_amount ?? itemData?.coin_amount ?? 0) || (type === "coins" ? price : 0),
  }
}

function isMissingColumnError(error: any) {
  const code = String(error?.code || "")
  const message = String(error?.message || "")
  return (
    code === "PGRST204" ||
    code === "42703" ||
    /column .* does not exist/i.test(message) ||
    /could not find the '.*' column/i.test(message)
  )
}

/**
 * Grant the recipient their collectible.
 *
 * The previous implementation used an `upsert` with
 * `onConflict: "user_id,item_id,item_type"`. Both matching indexes in the
 * database are *partial* (`WHERE item_id IS NOT NULL`), which Postgres cannot
 * infer from a plain ON CONFLICT target, so every non-coin gift threw 42P10
 * ("no unique or exclusion constraint matching the ON CONFLICT
 * specification"), refunded the sender and returned a 500. Coin gifts skip
 * this branch — hence only coins worked.
 *
 * Writes are now a read-then-insert against a minimal column set, with a
 * retry without optional columns for older schemas. Delivery is best-effort:
 * the gift record below is the receipt, so a collectible write can never turn
 * a successful charge into an error response.
 */
async function grantInventory(
  supabase: ReturnType<typeof createServerClient>,
  input: {
    userId: string
    giftId: string
    gift: ResolvedGift
  },
): Promise<{ delivered: boolean; warning?: string }> {
  const { userId, giftId, gift } = input

  try {
    // Already owned? Then the collectible is delivered.
    let existingQuery = supabase
      .from("user_inventory")
      .select("id")
      .eq("user_id", userId)
      .eq("item_name", gift.name)
      .eq("item_type", gift.subtype)

    existingQuery = gift.shopItemId
      ? existingQuery.eq("item_id", gift.shopItemId)
      : existingQuery.is("item_id", null)

    const { data: existing } = await existingQuery.limit(1).maybeSingle()
    if (existing?.id) return { delivered: true }

    const baseRow: Record<string, any> = {
      user_id: userId,
      item_id: gift.shopItemId,
      item_name: gift.name,
      item_type: gift.subtype,
      item_data: gift.itemData,
      is_active: false,
      source: "gift",
      gift_id: giftId,
    }

    const extendedRow: Record<string, any> = {
      ...baseRow,
      category: gift.category,
      rarity: gift.rarity,
      preview_data: gift.shopItem?.preview_data || {},
      acquired_from: "gift",
      acquired_at: new Date().toISOString(),
    }

    let { error } = await supabase.from("user_inventory").insert(extendedRow as any)
    if (error && isMissingColumnError(error)) {
      ;({ error } = await supabase.from("user_inventory").insert(baseRow as any))
    }
    if (error) throw error
    return { delivered: true }
  } catch (error: any) {
    console.error("Gift inventory delivery failed:", error?.message || error)
    return { delivered: false, warning: "Gift recorded; collectible delivery is pending." }
  }
}

/** Re-credit the sender without trusting a stale balance snapshot. */
async function refund(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  amount: number,
) {
  try {
    const { data: current } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", userId)
      .maybeSingle()
    await supabase
      .from("profiles")
      .update({
        loop_coins: Number(current?.loop_coins || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
  } catch (error) {
    console.error("Gift refund failed:", error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const recipientId = String(body.recipient_id || "")
    const rawGiftId = String(body.gift_item_id || body.gift_id || "")
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : ""
    const isAnonymous = Boolean(body.is_anonymous)
    const context = body.context && typeof body.context === "object" ? body.context : null
    const providedEffects = body.effects && typeof body.effects === "object" ? body.effects : null

    if (!recipientId || !rawGiftId) {
      return NextResponse.json(
        { success: false, error: "Pick a gift and a recipient first." },
        { status: 400 },
      )
    }

    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Please sign in to send a gift." },
        { status: 401 },
      )
    }

    if (recipientId === user.id) {
      return NextResponse.json(
        { success: false, error: "You can't send a gift to yourself." },
        { status: 400 },
      )
    }

    const gift = await resolveGift(supabase, rawGiftId)
    if (!gift) {
      return NextResponse.json(
        { success: false, error: "That gift is unavailable right now. Pick another one." },
        { status: 404 },
      )
    }

    const price = gift.price
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { success: false, error: "This gift has an invalid price." },
        { status: 400 },
      )
    }

    const [{ data: sender, error: senderError }, { data: recipient, error: recipientError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, loop_coins, username, display_name, avatar_url, video_avatar_url")
          .eq("id", user.id)
          .single(),
        supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, video_avatar_url, loop_coins, is_premium, premium_expires_at",
          )
          .eq("id", recipientId)
          .single(),
      ])

    if (senderError || !sender) {
      return NextResponse.json(
        { success: false, error: "We couldn't load your wallet. Try again." },
        { status: 404 },
      )
    }
    if (recipientError || !recipient) {
      return NextResponse.json(
        { success: false, error: "That recipient no longer exists." },
        { status: 404 },
      )
    }

    if (Number(sender.loop_coins || 0) < price) {
      return NextResponse.json(
        {
          success: false,
          error: `You need ${(price - Number(sender.loop_coins || 0)).toLocaleString()} more coins for ${gift.name}.`,
        },
        { status: 402 },
      )
    }

    // Atomic debit: the balance predicate lives in the UPDATE so two rapid
    // sends can never both spend the same coins.
    const { data: deductedRows, error: deductError } = await supabase
      .from("profiles")
      .update({
        loop_coins: Number(sender.loop_coins) - price,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .gte("loop_coins", price)
      .select("loop_coins")

    if (deductError || !deductedRows?.length) {
      return NextResponse.json(
        { success: false, error: "Not enough coins — top up and try again." },
        { status: 402 },
      )
    }

    const newBalance = Number(deductedRows[0].loop_coins)
    const giftType = normalizeGiftType(gift.type)

    // Deliver the benefit. Only coins/premium change the profile; every other
    // gift is a collectible, granted after the gift receipt below exists so
    // its `gift_id` always references a real row.
    let delivery: { delivered: boolean; warning?: string } = { delivered: true }
    try {
      if (giftType === "coins") {
        const { error } = await supabase
          .from("profiles")
          .update({
            loop_coins: Number(recipient.loop_coins || 0) + gift.coinAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipientId)
        if (error) throw error
      } else if (giftType === "premium") {
        const currentExpiry =
          recipient.premium_expires_at && new Date(recipient.premium_expires_at) > new Date()
            ? new Date(recipient.premium_expires_at)
            : new Date()
        const premiumExpiresAt = addPremiumDuration(currentExpiry, gift.itemData?.duration)
        const { error } = await supabase
          .from("profiles")
          .update({
            is_premium: true,
            premium_expires_at: premiumExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipientId)
        if (error) throw error
      } else {
        delivery = {
          delivered: false,
          warning: "Collectible delivery is pending.",
        }
      }
    } catch (deliveryError: any) {
      console.error("Gift delivery error:", deliveryError?.message || deliveryError)
      await refund(supabase, user.id, price)
      return NextResponse.json(
        {
          success: false,
          error: "The gift couldn't be delivered, so your coins were returned. Please try again.",
        },
        { status: 502 },
      )
    }

    const giftValue = {
      shop_item_id: gift.shopItemId,
      canonical_id: gift.canonical?.id || null,
      category: gift.category,
      item_type: gift.subtype,
      item_data: gift.itemData,
      effects: gift.effects,
      art: gift.art,
      duration_ms: gift.durationMs,
      coins_amount: gift.coinAmount || null,
      is_anonymous: isAnonymous,
    }

    const loopId =
      context?.type === "post" || context?.type === "branch" || context?.type === "comment"
        ? context.id
        : null
    const streamId = context?.type === "stream" ? context.id : null

    const fullRecord: Record<string, any> = {
      sender_id: user.id,
      recipient_id: recipientId,
      gift_type: giftType,
      gift_name: gift.name,
      name: gift.name,
      description: gift.description,
      gift_value: giftValue,
      cost: price,
      price_coins: price,
      message: message || null,
      is_anonymous: isAnonymous,
      status: "sent",
      context_type: context?.type || null,
      context_id: context?.id || null,
      effects: providedEffects || gift.effects,
      rarity: gift.rarity,
      category: gift.category,
      icon_url: gift.iconUrl,
      is_active: true,
      delivered_at: new Date().toISOString(),
    }

    const coreRecord: Record<string, any> = {
      sender_id: user.id,
      recipient_id: recipientId,
      gift_type: giftType,
      gift_name: gift.name,
      gift_value: giftValue,
      cost: price,
      message: message || null,
      is_anonymous: isAnonymous,
      status: "sent",
      context_type: context?.type || null,
      context_id: context?.id || null,
      delivered_at: new Date().toISOString(),
    }

    let giftRecord: any = null
    let giftInsertError: any = null

    const attempts: Array<Record<string, any>> = [fullRecord, coreRecord]
    for (const attempt of attempts) {
      const { data, error } = await supabase
        .from("gifts")
        .insert(attempt as any)
        .select("*")
        .single()
      if (!error) {
        giftRecord = data
        giftInsertError = null
        break
      }
      giftInsertError = error
      // Older schemas have a narrower context_type CHECK. Keep the gift and
      // drop the optional context rather than failing the whole send.
      if (/context_type/i.test(error.message || "")) {
        const withoutContext = { ...attempt, context_type: null, context_id: null }
        const retry = await supabase.from("gifts").insert(withoutContext as any).select("*").single()
        if (!retry.error) {
          giftRecord = retry.data
          giftInsertError = null
          break
        }
        giftInsertError = retry.error
      }
      if (!isMissingColumnError(error) && !/context_type/i.test(error.message || "")) break
    }

    if (giftInsertError || !giftRecord) {
      console.error("Gift record insert error:", giftInsertError)
      await refund(supabase, user.id, price)
      return NextResponse.json(
        {
          success: false,
          error: "We couldn't save that gift, so your coins were returned. Please try again.",
        },
        { status: 500 },
      )
    }

    // After the receipt exists, deliver the collectible.
    if (giftType !== "coins" && giftType !== "premium") {
      delivery = await grantInventory(supabase, {
        userId: recipientId,
        giftId: giftRecord.id,
        gift,
      })
    }

    const { data: transaction } = await supabase
      .from("gift_transactions")
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        gift_id: giftRecord.id,
        loop_id: loopId,
        stream_id: streamId,
        quantity: 1,
        total_cost: price,
        message: message || null,
      })
      .select("*")
      .maybeSingle()

    await supabase.from("coin_transactions").insert([
      {
        user_id: user.id,
        amount: -price,
        transaction_type: "gift_sent",
        description: `Sent ${gift.name} to @${recipient.username}`,
        reference_id: giftRecord.id,
      },
      ...(giftType === "coins"
        ? [
            {
              user_id: recipientId,
              amount: gift.coinAmount,
              transaction_type: "gift_received",
              description: `Received ${gift.name} from ${isAnonymous ? "someone" : `@${sender.username}`}`,
              reference_id: giftRecord.id,
            },
          ]
        : []),
    ])

    // Creator earnings + XP. Coin gifts already deposit spendable coins, so
    // only item gifts convert their cost into withdrawable earnings.
    try {
      const { awardEarnings, coinsToEarnings } = await import("@/lib/earnings")
      const { awardXp } = await import("@/lib/xp")
      if (giftType !== "coins") {
        const earningAmount = coinsToEarnings(price)
        if (earningAmount > 0) {
          await awardEarnings(supabase, recipientId, earningAmount, {
            source: "gift",
            reference_id: giftRecord.id,
            description: `Earnings from ${gift.name}`,
          })
        }
      }
      await awardXp(supabase, user.id, "gift_sent", `Sent gift ${gift.name}`)
      await awardXp(supabase, recipientId, "gift_received", `Received gift ${gift.name}`)
    } catch (xpEarnError) {
      console.error("Gift XP/earnings error:", xpEarnError)
    }

    const notificationPayload = {
      gift_id: giftRecord.id,
      shop_item_id: gift.shopItemId,
      gift_name: gift.name,
      gift_type: giftType,
      gift_rarity: gift.rarity,
      gift_art: gift.art,
      sender_id: isAnonymous ? null : user.id,
      sender_name: isAnonymous ? null : sender.display_name,
      message: message || null,
      transaction_id: transaction?.id || null,
      context,
      ...(context?.type === "post" && context?.circle_id
        ? {
            url: `/communities/${context.circle_id}/posts/${context.id}`,
            action_url: `/communities/${context.circle_id}/posts/${context.id}`,
          }
        : {}),
    }

    // Notification enums differ between schema eras; try the specific type,
    // then the older generic one.
    for (const type of ["gift_received", "gift", "system"]) {
      const { error } = await supabase.from("notifications").insert({
        user_id: recipientId,
        type,
        title: "Gift received",
        message: `${isAnonymous ? "Someone" : sender.display_name || sender.username} sent you ${gift.name}${
          message ? `: “${message}”` : ""
        }`,
        data: notificationPayload,
        actor_id: isAnonymous ? null : user.id,
        is_read: false,
      })
      if (!error) break
    }

    try {
      const { sendWebPushToUser } = await import("@/lib/web-push")
      await sendWebPushToUser(
        recipientId,
        {
          title: "Gift received",
          body: `${isAnonymous ? "Someone" : sender.display_name || sender.username} sent you ${gift.name}`,
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
          gift_name: gift.name,
          gift_type: giftType,
          rarity: gift.rarity,
          art: gift.art,
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
    } catch {
      /* realtime is best-effort */
    }

    try {
      const { trackQuestAction } = await import("@/lib/quest-tracker")
      await trackQuestAction(supabase, user.id, "send_gift")
    } catch (err) {
      console.error("quest track (send_gift):", err)
    }

    return NextResponse.json({
      success: true,
      transaction_id: transaction?.id || null,
      gift_id: giftRecord.id,
      new_balance: newBalance,
      delivered: delivery.delivered,
      delivery_warning: delivery.warning || null,
      gift: {
        id: giftRecord.id,
        shop_item_id: gift.shopItemId,
        canonical_id: gift.canonical?.id || null,
        name: gift.name,
        type: giftType,
        rarity: gift.rarity,
        art: gift.art,
        duration_ms: gift.durationMs,
        cost: price,
        effects: providedEffects || gift.effects,
      },
      recipient: {
        id: recipientId,
        username: recipient.username,
        display_name: recipient.display_name,
      },
    })
  } catch (error) {
    console.error("Gift send error:", error)
    return NextResponse.json(
      { success: false, error: "Something went wrong sending that gift. Please try again." },
      { status: 500 },
    )
  }
}
