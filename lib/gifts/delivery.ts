import type { createServerClient } from "@/lib/supabase"
import { coinsToEarnings, awardEarnings } from "@/lib/earnings"
import { awardXp } from "@/lib/xp"

type Supabase = ReturnType<typeof createServerClient>

export type GiftReceipt = Record<string, any>

export function giftValueOf(gift: GiftReceipt): Record<string, any> {
  return gift?.gift_value && typeof gift.gift_value === "object"
    ? (gift.gift_value as Record<string, any>)
    : {}
}

/**
 * New gifts stay inside `gifts` until the recipient accepts. The marker lives
 * in the existing JSONB value so no migration is needed, and older `sent`
 * gifts (which were already delivered inline by the old send route) are not
 * mistaken for pending ones.
 */
export function isPendingGift(gift: GiftReceipt): boolean {
  return giftValueOf(gift).delivery_pending === true
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

function missingColumn(error: any) {
  return (
    String(error?.code || "") === "PGRST204" ||
    String(error?.code || "") === "42703" ||
    /column .* does not exist/i.test(String(error?.message || "")) ||
    /could not find the '.*' column/i.test(String(error?.message || ""))
  )
}

async function grantCollectible(
  supabase: Supabase,
  gift: GiftReceipt,
  recipientId: string,
) {
  const value = giftValueOf(gift)
  const { data: existing, error: existingError } = await supabase
    .from("user_inventory")
    .select("id")
    .eq("user_id", recipientId)
    .eq("gift_id", gift.id)
    .limit(1)
    .maybeSingle()
  // Older schemas may not have `gift_id`; fall through to the insert which has
  // its own column fallback.
  if (!existingError && existing?.id) return

  const itemData = value.item_data && typeof value.item_data === "object" ? value.item_data : {}
  const fullRow = {
    user_id: recipientId,
    item_id: value.shop_item_id || null,
    item_name: gift.gift_name || gift.name || "Loop gift",
    item_type: value.item_type || gift.gift_type || "gift_item",
    item_data: {
      ...itemData,
      gift_art: value.art || null,
      palette: value.effects?.palette || value.palette || null,
    },
    is_active: false,
    source: "gift",
    gift_id: gift.id,
    category: value.category || gift.category || null,
    rarity: gift.rarity || value.rarity || "common",
    acquired_from: "gift",
    acquired_at: new Date().toISOString(),
  }

  let { error } = await supabase.from("user_inventory").insert(fullRow as any)
  if (error && missingColumn(error)) {
    const slimRow = {
      user_id: recipientId,
      item_id: value.shop_item_id || null,
      item_name: gift.gift_name || gift.name || "Loop gift",
      item_type: value.item_type || gift.gift_type || "gift_item",
      item_data: fullRow.item_data,
      is_active: false,
      source: "gift",
      gift_id: gift.id,
    }
    ;({ error } = await supabase.from("user_inventory").insert(slimRow as any))
  }
  if (error) throw error
}

function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000)
}

/** Visible, expiring flair shown on the profile About tab and in the wallet. */
async function applyGiftFlair(
  supabase: Supabase,
  recipientId: string,
  gift: GiftReceipt,
  kind: "gift_badge" | "gift_highlight",
) {
  const value = giftValueOf(gift)
  const hours = Number(value.effect_hours || 0)
  if (!Number.isFinite(hours) || hours <= 0) return

  const now = new Date()
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_cosmetics")
    .eq("id", recipientId)
    .maybeSingle()

  const current =
    profile?.active_cosmetics && typeof profile.active_cosmetics === "object"
      ? (profile.active_cosmetics as Record<string, any>)
      : {}
  const next = {
    ...current,
    [kind]: {
      gift_id: gift.id,
      label: value.use_label || "Gift perk",
      effect: value.effect || null,
      starts_at: now.toISOString(),
      expires_at: addHours(now, hours).toISOString(),
    },
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active_cosmetics: next, updated_at: now.toISOString() })
    .eq("id", recipientId)
  if (error) throw error
}

/** Boost gifts are credited to the post they were sent on, when possible. */
async function applyPostBoost(supabase: Supabase, gift: GiftReceipt) {
  const value = giftValueOf(gift)
  const amount = Number(value.boost_amount || 0)
  const contextType = String(gift.context_type || "").toLowerCase()
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !gift.context_id ||
    !["post", "branch", "comment", "loop"].includes(contextType)
  ) {
    return false
  }

  const { data: loop } = await supabase
    .from("loops")
    .select("id, boost_coins_current, boost_tier, trending_score")
    .eq("id", gift.context_id)
    .maybeSingle()
  if (!loop) return false

  const current = Number(loop.boost_coins_current || 0)
  const next = current + amount
  const tier = next >= 2000 ? 3 : next >= 500 ? 2 : next >= 100 ? 1 : 0
  const { error } = await supabase
    .from("loops")
    .update({
      boost_coins_current: next,
      is_boosted: tier > 0,
      boost_tier: tier,
      boosted_at: new Date().toISOString(),
      trending_score: Number(loop.trending_score || 0) + amount * 3,
    })
    .eq("id", loop.id)
  if (error) throw error
  return true
}

async function applyGiftUse(supabase: Supabase, gift: GiftReceipt, recipientId: string) {
  const value = giftValueOf(gift)
  const use = String(value.use_type || "").toLowerCase()

  try {
    if (use === "boost") {
      const boosted = await applyPostBoost(supabase, gift)
      if (!boosted) await applyGiftFlair(supabase, recipientId, gift, "gift_highlight")
      return
    }
    if (use === "utility") {
      await applyGiftFlair(supabase, recipientId, gift, "gift_highlight")
      return
    }
    if (use === "support") {
      await applyGiftFlair(supabase, recipientId, gift, "gift_badge")
      return
    }
    if (use === "exclusive") {
      await applyGiftFlair(supabase, recipientId, gift, "gift_badge")
      await applyGiftFlair(supabase, recipientId, gift, "gift_highlight")
    }
  } catch (effectError) {
    // The collectible itself is already granted. A transient profile/boost
    // write must not make the recipient lose the whole gift.
    console.warn("Gift effect delivery failed:", effectError)
  }
}

/**
 * Apply the benefit exactly once after the gift has been atomically claimed.
 * Coin credits are guarded by the ledger reference, inventory by `gift_id`,
 * and creator earnings by their own idempotent RPC.
 */
export async function deliverAcceptedGift(
  supabase: Supabase,
  gift: GiftReceipt,
  recipientId: string,
) {
  const value = giftValueOf(gift)
  const giftType = String(gift.gift_type || value.gift_type || "badge").toLowerCase()

  if (giftType === "coins") {
    const amount = Math.max(0, Number(value.coins_amount || value.coin_amount || 0))
    if (!amount) throw new Error("This coin gift has no amount to deliver.")

    const { data: existingTransaction } = await supabase
      .from("coin_transactions")
      .select("id")
      .eq("user_id", recipientId)
      .eq("reference_id", gift.id)
      .eq("transaction_type", "gift_received")
      .limit(1)
      .maybeSingle()

    if (!existingTransaction?.id) {
      const { data: recipient, error: recipientError } = await supabase
        .from("profiles")
        .select("loop_coins")
        .eq("id", recipientId)
        .single()
      if (recipientError || !recipient) throw recipientError || new Error("Recipient not found")

      const { error: creditError } = await supabase
        .from("profiles")
        .update({
          loop_coins: Number(recipient.loop_coins || 0) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recipientId)
      if (creditError) throw creditError

      await supabase.from("coin_transactions").insert({
        user_id: recipientId,
        amount,
        transaction_type: "gift_received",
        description: `Received ${gift.gift_name || gift.name || "gift"}`,
        reference_id: gift.id,
      })
    }
  } else if (giftType === "premium") {
    const { data: recipient, error: recipientError } = await supabase
      .from("profiles")
      .select("is_premium, premium_expires_at")
      .eq("id", recipientId)
      .single()
    if (recipientError || !recipient) throw recipientError || new Error("Recipient not found")

    const currentExpiry =
      recipient.premium_expires_at && new Date(recipient.premium_expires_at) > new Date()
        ? new Date(recipient.premium_expires_at)
        : new Date()
    const expiresAt = addPremiumDuration(
      currentExpiry,
      value.item_data?.duration || value.duration,
    )
    const { error } = await supabase
      .from("profiles")
      .update({
        is_premium: true,
        premium_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", recipientId)
    if (error) throw error
  } else {
    await grantCollectible(supabase, gift, recipientId)
  }

  await applyGiftUse(supabase, gift, recipientId)

  // Creator earnings and XP are rewards for a completed gift, not a send in
  // flight. Both helpers are best-effort and must not undo a delivered gift.
  try {
    if (giftType !== "coins") {
      const amount = coinsToEarnings(Number(gift.cost || 0))
      if (amount > 0) {
        await awardEarnings(supabase, recipientId, amount, {
          source: "gift",
          reference_id: gift.id,
          description: `Earnings from ${gift.gift_name || gift.name || "gift"}`,
        })
      }
    }
    await awardXp(
      supabase,
      recipientId,
      "gift_received",
      `Accepted gift ${gift.gift_name || gift.name || ""}`.trim(),
    )
  } catch (error) {
    console.warn("Gift reward delivery failed:", error)
  }
}
