import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const REFUND_WINDOW_DAYS = 14
const REFUNDABLE_TYPES = ["deposit", "premium_purchase", "shop_purchase"]

async function getUserFromRequest(request: NextRequest) {
  if (!authHeader) return null
  try {
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return null
    return user
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: requests, error } = await supabase
      .from("refund_requests")
      .select(
        `
        *,
        wallet_transactions:wallet_transactions!wallet_tx_id(id, amount_usd, coins_amount, type, description, created_at, status, payment_method)
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error && !/does not exist/i.test(error.message)) {
      console.error("Refund list error:", error.message)
      return NextResponse.json({ error: "Failed to load refund requests" }, { status: 500 })
    }

    return NextResponse.json({ success: true, requests: requests || [] })
  } catch (error: any) {
    console.error("Refund GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const walletTxId = String(body.wallet_tx_id || "").trim()
    const reason = String(body.reason || "").trim().slice(0, 500)

    if (!walletTxId) {
      return NextResponse.json({ error: "wallet_tx_id is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: tx, error: txError } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("id", walletTxId)
      .maybeSingle()

    if (txError || !tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    if (String(tx.user_id) !== user.id) {
      return NextResponse.json({ error: "This transaction does not belong to you" }, { status: 403 })
    }

    if (tx.payment_method !== "stripe") {
      return NextResponse.json(
        { error: "Only card (Stripe) purchases can be refunded. Coin purchases are final." },
        { status: 400 },
      )
    }

    if (tx.status !== "completed") {
      return NextResponse.json(
        { error: `This transaction is ${tx.status} and cannot be refunded.` },
        { status: 400 },
      )
    }

    if (!REFUNDABLE_TYPES.includes(String(tx.type))) {
      return NextResponse.json(
        { error: "This transaction type is not eligible for a refund." },
        { status: 400 },
      )
    }

    const createdAt = tx.created_at ? new Date(tx.created_at).getTime() : Date.now()
    const windowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000
    if (Date.now() - createdAt > windowMs) {
      return NextResponse.json(
        { error: `Refunds can only be requested within ${REFUND_WINDOW_DAYS} days of purchase.` },
        { status: 400 },
      )
    }

    // One active request per transaction
    const { data: existing } = await supabase
      .from("refund_requests")
      .select("id, status")
      .eq("wallet_tx_id", walletTxId)
      .in("status", ["pending", "approved"])
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: existing.status === "approved" ? "This purchase was already refunded." : "A refund request is already pending for this purchase." },
        { status: 400 },
      )
    }

    const { data: inserted, error: insertError } = await supabase
      .from("refund_requests")
      .insert({
        user_id: user.id,
        wallet_tx_id: walletTxId,
        payment_intent_id: tx.payment_intent_id || null,
        item_id: tx.item_id || null,
        amount_usd: Number(tx.amount_usd || 0),
        coins_amount: Number(tx.coins_amount || 0),
        tx_type: String(tx.type || "deposit"),
        reason: reason || null,
      })
      .select()
      .single()

    if (insertError) {
      if (/does not exist/i.test(insertError.message)) {
        return NextResponse.json(
          { error: "Refunds are not enabled yet. Contact support." },
          { status: 503 },
        )
      }
      console.error("Refund request insert error:", insertError.message)
      return NextResponse.json({ error: "Failed to submit refund request" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Refund request submitted. We'll review it within 2–3 business days.",
      request: inserted,
    })
  } catch (error: any) {
    console.error("Refund POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
