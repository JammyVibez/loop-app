import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { notifyUser } from "@/lib/notifications"
import { getStripeServer } from "@/lib/stripe-server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const supabase = createServerClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  let query = supabase
    .from("refund_requests")
    .select(
      `
        *,
        user:profiles!user_id(id, username, display_name, avatar_url, loop_coins),
        wallet_transactions:wallet_transactions!wallet_tx_id(id, amount_usd, coins_amount, type, description, created_at, status, payment_method, payment_intent_id)
      `,
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    query = query.eq("status", status)
  }

  const { data: requests, error } = await query
  if (error) {
    if (/does not exist/i.test(error.message)) {
      return NextResponse.json({ success: true, requests: [] })
    }
    console.error("Admin refund list error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, requests: requests || [] })
}

export async function PATCH(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const supabase = createServerClient()
  const body = await request.json().catch(() => ({}))
  const { id, action, admin_note } = body

  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "id and action (approve|reject) are required" },
      { status: 400 },
    )
  }

  const { data: refundRequest, error: fetchError } = await supabase
    .from("refund_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (fetchError || !refundRequest) {
    return NextResponse.json({ error: "Refund request not found" }, { status: 404 })
  }

  if (refundRequest.status !== "pending") {
    return NextResponse.json(
      { error: `This request was already ${refundRequest.status}.` },
      { status: 400 },
    )
  }

  if (action === "reject") {
    const { error: rejectError } = await supabase
      .from("refund_requests")
      .update({
        status: "rejected",
        admin_note: admin_note || "Request rejected.",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (rejectError) {
      console.error("Reject refund error:", rejectError.message)
      return NextResponse.json({ error: "Failed to reject refund request" }, { status: 500 })
    }

    await notifyUser(supabase, {
      userId: refundRequest.user_id,
      type: "system",
      title: "Refund request declined",
      message: admin_note || "Your refund request was reviewed and declined. Contact support if you have questions.",
      actionUrl: "/wallet",
    })

    return NextResponse.json({ success: true, message: "Refund request rejected" })
  }

  // ---- Approve: refund the money through Stripe, then reverse the grant ----
  let stripeRefund: { id: string } | null = null
  const stripe = await getStripeServer()
  if (stripe) {
    try {
      let paymentIntent = refundRequest.payment_intent_id
      if (!paymentIntent && String(refundRequest.wallet_tx_id || "").startsWith("stripe_")) {
        // wallet_tx_id doubles as the Checkout session id for older purchases
        const sessionId = String(refundRequest.wallet_tx_id).replace("stripe_", "")
        const session = await stripe.checkout.sessions.retrieve(sessionId)
        paymentIntent = session.payment_intent as string | undefined
      }
      if (paymentIntent) {
        stripeRefund = await stripe.refunds.create({
          payment_intent: paymentIntent,
          metadata: { refund_request_id: refundRequest.id },
        })
      }
    } catch (err: any) {
      console.error("Stripe refund failed:", err?.message)
    }
  }

  if (!stripeRefund) {
    return NextResponse.json(
      { error: "Could not refund the charge with Stripe. The payment may already be refunded or too old." },
      { status: 502 },
    )
  }

  const txType = String(refundRequest.tx_type || "deposit")
  const coinsAmount = Number(refundRequest.coins_amount || 0)
  const itemId = refundRequest.item_id

  // Reverse the coin credit (coin packs) so the user can't double-spend.
  if (txType === "deposit" && coinsAmount > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", refundRequest.user_id)
      .maybeSingle()
    const nextCoins = Math.max(0, Number(profile?.loop_coins || 0) - coinsAmount)
    await supabase
      .from("profiles")
      .update({ loop_coins: nextCoins, updated_at: new Date().toISOString() })
      .eq("id", refundRequest.user_id)
  }

  // Remove granted shop item from inventory.
  if (txType === "shop_purchase" && itemId) {
    await supabase
      .from("user_inventory")
      .delete()
      .eq("user_id", refundRequest.user_id)
      .eq("item_id", itemId)
  }

  // Revoke premium if it was granted by this purchase.
  if (txType === "premium_purchase") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("premium_expires_at")
      .eq("id", refundRequest.user_id)
      .maybeSingle()
    if (profile?.premium_expires_at && new Date(profile.premium_expires_at) > new Date()) {
      await supabase
        .from("profiles")
        .update({
          is_premium: false,
          premium_expires_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", refundRequest.user_id)
    }
  }

  // Mark the ledger transaction refunded.
  await supabase
    .from("wallet_transactions")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("id", refundRequest.wallet_tx_id)

  await supabase
    .from("refund_requests")
    .update({
      status: "approved",
      admin_note: admin_note || `Refunded via Stripe (${stripeRefund.id})`,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)

  await notifyUser(supabase, {
    userId: refundRequest.user_id,
    type: "system",
    title: "Refund processed 💸",
    message: `Your refund of $${Number(refundRequest.amount_usd || 0).toFixed(2)} was processed. It may take 3–10 business days to appear on your statement.`,
    actionUrl: "/wallet",
  })

  return NextResponse.json({
    success: true,
    message: "Refund processed",
    stripe_refund_id: stripeRefund.id,
  })
}
