import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { checkBlockStatus } from "@/lib/user-blocks"
import { broadcastRealtime } from "@/lib/realtime-server"
import { deliverAcceptedGift, giftValueOf, isPendingGift } from "@/lib/gifts/delivery"

export const dynamic = "force-dynamic"

type Supabase = ReturnType<typeof createServerClient>

async function getOwnedGift(supabase: Supabase, giftId: string, userId: string) {
  const { data, error } = await supabase
    .from("gifts")
    .select("*")
    .eq("id", giftId)
    .eq("recipient_id", userId)
    .maybeSingle()
  return { gift: data, error }
}

async function notifySender(
  supabase: Supabase,
  gift: Record<string, any>,
  title: string,
  message: string,
  data: Record<string, unknown>,
) {
  if (gift.is_anonymous || !gift.sender_id) return
  for (const type of ["system", "gift", "gift_sent"]) {
    const { error } = await supabase.from("notifications").insert({
      user_id: gift.sender_id,
      type,
      title,
      message,
      data: { gift_id: gift.id, ...data },
      actor_id: gift.recipient_id,
      is_read: false,
    })
    if (!error) return
  }
}

/** The same privacy and block gates the normal DM composer applies. */
async function canThankSender(supabase: Supabase, fromId: string, toId: string) {
  const block = await checkBlockStatus(supabase, fromId, toId)
  if (block.blocked) return "You can't message this person."

  const { data: profile } = await supabase
    .from("profiles")
    .select("privacy_settings")
    .eq("id", toId)
    .maybeSingle()
  const privacy = (profile as any)?.privacy_settings || {}
  const mode = privacy.message_privacy || "everyone"
  if (mode === "nobody" || mode === "none") {
    return "This person has direct messages turned off."
  }
  if (mode === "followers") {
    const [{ data: fromFollows }, { data: toFollows }] = await Promise.all([
      supabase
        .from("follows")
        .select("id")
        .eq("follower_id", fromId)
        .eq("following_id", toId)
        .maybeSingle(),
      supabase
        .from("follows")
        .select("id")
        .eq("follower_id", toId)
        .eq("following_id", fromId)
        .maybeSingle(),
    ])
    if (!fromFollows && !toFollows) {
      return "This person only accepts messages from people they follow."
    }
  }
  return null
}

async function getOrCreateDirectConversation(supabase: Supabase, fromId: string, toId: string) {
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", fromId)
    .is("left_at", null)
  const myIds = (mine || []).map((row: any) => row.conversation_id)

  if (myIds.length) {
    const { data: theirs } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", toId)
      .in("conversation_id", myIds)
      .is("left_at", null)

    for (const membership of theirs || []) {
      const { data: people } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", membership.conversation_id)
        .is("left_at", null)
      if ((people || []).length === 2) return membership.conversation_id as string
    }
  }

  const now = new Date().toISOString()
  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({
      is_group: false,
      created_by: fromId,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single()
  if (error || !conversation) throw error || new Error("Could not start a conversation")

  const { error: participantError } = await supabase.from("conversation_participants").insert([
    { conversation_id: conversation.id, user_id: fromId, role: "owner", joined_at: now },
    { conversation_id: conversation.id, user_id: toId, role: "member", joined_at: now },
  ])
  if (participantError) throw participantError
  return conversation.id as string
}

async function sendThankYou(
  request: NextRequest,
  supabase: Supabase,
  gift: Record<string, any>,
  userId: string,
  message: string,
) {
  const content = String(message || "").trim().slice(0, 280)
  if (!content) {
    return NextResponse.json({ error: "Write a short thank-you first." }, { status: 400 })
  }
  if (gift.is_anonymous || !gift.sender_id) {
    return NextResponse.json(
      { error: "This sender chose to stay anonymous, so there is no one to reply to." },
      { status: 409 },
    )
  }

  const blockedReason = await canThankSender(supabase, userId, gift.sender_id)
  if (blockedReason) {
    return NextResponse.json({ error: blockedReason }, { status: 403 })
  }

  const conversationId = await getOrCreateDirectConversation(
    supabase,
    userId,
    gift.sender_id,
  )
  const now = new Date().toISOString()
  const { data: sent, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      author_id: userId,
      content,
      message_type: "text",
      created_at: now,
    })
    .select("*")
    .single()
  if (error || !sent) {
    return NextResponse.json(
      { error: error?.message || "Could not send your thank-you." },
      { status: 500 },
    )
  }

  await supabase
    .from("conversations")
    .update({ updated_at: now })
    .eq("id", conversationId)

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle()

  const enriched = {
    ...sent,
    sender: senderProfile || null,
  }
  await broadcastRealtime(`conversation:${conversationId}`, "new_message", enriched)

  try {
    const { notifyUser } = await import("@/lib/notifications")
    await notifyUser(supabase, {
      userId: gift.sender_id,
      type: "message",
      title: `${senderProfile?.display_name || senderProfile?.username || "Someone"} thanked you`,
      message: content,
      actorId: userId,
      actionUrl: `/messages?c=${conversationId}`,
      data: { conversation_id: conversationId, gift_id: gift.id },
      pushCategory: "directMessages",
    })
  } catch {
    /* the message itself is delivered; push is best-effort */
  }

  return NextResponse.json({
    success: true,
    conversation_id: conversationId,
    message: "Thank-you sent.",
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const giftId = String(body.gift_id || body.giftId || "")
    const action = String(body.action || "").toLowerCase()
    const reason = String(body.reason || "").slice(0, 240)

    if (!giftId) {
      return NextResponse.json({ error: "Gift ID is required." }, { status: 400 })
    }

    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Please sign in to manage gifts." }, { status: 401 })
    }

    const supabase = createServerClient()
    const { gift, error } = await getOwnedGift(supabase, giftId, user.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!gift) {
      return NextResponse.json({ error: "Gift not found." }, { status: 404 })
    }

    if (action === "thank") {
      return sendThankYou(request, supabase, gift, user.id, String(body.message || ""))
    }

    if (gift.status !== "sent") {
      return NextResponse.json(
        { error: "This gift was already handled." },
        { status: 409 },
      )
    }

    if (action === "accept") {
      // Older pending rows were already delivered by the send route. Mark them
      // claimed without applying the benefit a second time.
      if (!isPendingGift(gift)) {
        const { data: claimed, error: claimError } = await supabase
          .from("gifts")
          .update({ status: "claimed", delivered_at: new Date().toISOString() })
          .eq("id", gift.id)
          .eq("recipient_id", user.id)
          .eq("status", "sent")
          .select("id")
          .maybeSingle()
        if (claimError || !claimed) {
          return NextResponse.json(
            { error: "This gift could not be accepted. Try again." },
            { status: 409 },
          )
        }
        return NextResponse.json({
          success: true,
          status: "claimed",
          legacy_delivery: true,
          message: "Gift accepted.",
        })
      }

      const claimedAt = new Date().toISOString()
      const { data: claimed, error: claimError } = await supabase
        .from("gifts")
        .update({ status: "claimed", delivered_at: claimedAt })
        .eq("id", gift.id)
        .eq("recipient_id", user.id)
        .eq("status", "sent")
        .select("*")
        .maybeSingle()

      if (claimError || !claimed) {
        return NextResponse.json(
          { error: "This gift was already accepted or declined." },
          { status: 409 },
        )
      }

      try {
        await deliverAcceptedGift(supabase, gift, user.id)
      } catch (deliveryError: any) {
        console.error("Gift acceptance delivery failed:", deliveryError?.message || deliveryError)
        // Put the claim back so the recipient can retry instead of losing it.
        await supabase
          .from("gifts")
          .update({ status: "sent", delivered_at: null })
          .eq("id", gift.id)
          .eq("recipient_id", user.id)
          .eq("status", "claimed")
        return NextResponse.json(
          {
            error:
              "The gift is safe, but it could not be delivered yet. Please try accepting again.",
          },
          { status: 502 },
        )
      }

      const nextValue = {
        ...giftValueOf(gift),
        delivery_pending: false,
        accepted_at: claimedAt,
      }
      await supabase.from("gifts").update({ gift_value: nextValue }).eq("id", gift.id)

      await notifySender(
        supabase,
        gift,
        "Gift accepted",
        `${gift.gift_name || "Your gift"} was accepted.`,
        { accepted: true },
      )

      return NextResponse.json({
        success: true,
        status: "claimed",
        message: "Gift accepted.",
      })
    }

    if (action === "decline") {
      if (!isPendingGift(gift)) {
        return NextResponse.json(
          { error: "This gift was already delivered and can no longer be declined." },
          { status: 409 },
        )
      }

      const { data: declined, error: declineError } = await supabase
        .from("gifts")
        .update({ status: "declined" })
        .eq("id", gift.id)
        .eq("recipient_id", user.id)
        .eq("status", "sent")
        .select("id")
        .maybeSingle()
      if (declineError || !declined) {
        return NextResponse.json(
          { error: "This gift was already accepted or declined." },
          { status: 409 },
        )
      }

      const { data: sender } = await supabase
        .from("profiles")
        .select("loop_coins")
        .eq("id", gift.sender_id)
        .maybeSingle()
      if (sender) {
        await supabase
          .from("profiles")
          .update({
            loop_coins: Number(sender.loop_coins || 0) + Number(gift.cost || 0),
            updated_at: new Date().toISOString(),
          })
          .eq("id", gift.sender_id)
        await supabase.from("coin_transactions").insert({
          user_id: gift.sender_id,
          amount: Number(gift.cost || 0),
          transaction_type: "refund",
          description: `Gift declined: ${gift.gift_name || "gift"}${reason ? ` (${reason})` : ""}`,
          reference_id: gift.id,
        })
      }

      await notifySender(
        supabase,
        gift,
        "Gift returned",
        `Your ${gift.gift_name || "gift"} was declined and its coins were returned.`,
        { declined: true, refund_amount: Number(gift.cost || 0) },
      )

      return NextResponse.json({
        success: true,
        status: "declined",
        message: "Gift declined and the sender was refunded.",
      })
    }

    return NextResponse.json({ error: "Invalid gift action." }, { status: 400 })
  } catch (error) {
    console.error("Gift management error:", error)
    return NextResponse.json(
      { error: "Something went wrong managing that gift. Please try again." },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Please sign in to view gifts." }, { status: 401 })
    }

    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "sent"
    const { data: rows, error } = await supabase
      .from("gifts")
      .select("*")
      .eq("recipient_id", user.id)
      .eq("status", status)
      .order("created_at", { ascending: true })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const eligible = (rows || []).filter(
      (row: any) => status !== "sent" || isPendingGift(row),
    )

    const senderIds = Array.from(
      new Set(
        eligible
          .filter((row: any) => !row.is_anonymous && row.sender_id)
          .map((row: any) => row.sender_id),
      ),
    )
    const { data: senderProfiles } = senderIds.length
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", senderIds)
      : { data: [] as any[] }
    const senders = new Map((senderProfiles || []).map((profile: any) => [profile.id, profile]))

    const gifts = eligible.map((gift: any) => {
      const value = giftValueOf(gift)
      const effects = gift.effects && typeof gift.effects === "object" ? gift.effects : value.effects || {}
      const anon = Boolean(gift.is_anonymous)
      const senderProfile = anon ? null : senders.get(gift.sender_id) || null
      return {
        id: gift.id,
        gift_name: gift.gift_name || gift.name,
        gift_type: gift.gift_type,
        rarity: gift.rarity || value.rarity || "common",
        art: value.art || effects.art || null,
        palette: effects.palette || value.palette || null,
        effects,
        duration_ms: value.duration_ms || effects.duration_ms || null,
        message: gift.message || null,
        is_anonymous: anon,
        sender: senderProfile
          ? {
              id: senderProfile.id,
              username: senderProfile.username,
              display_name: senderProfile.display_name,
              avatar_url: senderProfile.avatar_url,
            }
          : null,
        cost: Number(gift.cost || 0),
        status: gift.status,
        created_at: gift.created_at,
      }
    })

    return NextResponse.json({
      success: true,
      gifts,
      data: { gifts },
    })
  } catch (error) {
    console.error("Get gifts error:", error)
    return NextResponse.json({ error: "Failed to fetch gifts." }, { status: 500 })
  }
}
