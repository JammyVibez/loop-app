import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}


export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: requests, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    return NextResponse.json({
      success: true,
      requests: requests || []
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const coins_amount = Number(body.coins_amount || 0)
    const payout_method = body.payout_method || "bank"
    const payout_details = body.payout_details || "Default Payout Account"

    if (coins_amount < 500) {
      return NextResponse.json({ error: "Minimum withdrawal threshold is 500 Loop Coins ($5.00 USD)" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Fetch profile to verify coin balance and verification status
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    const currentCoins = profile?.loop_coins ?? 0
    const isVerified = profile?.is_verified || user.user_metadata?.is_verified || false

    if (!isVerified) {
      return NextResponse.json({
        error: "Withdrawal feature is currently restricted to Verified Creators. Please apply for verification first.",
        requiresVerification: true
      }, { status: 403 })
    }

    if (coins_amount > currentCoins) {
      return NextResponse.json({ error: "Insufficient coin balance for requested cashout" }, { status: 400 })
    }

    const estimatedUsd = (coins_amount * 0.01).toFixed(2)
    const requestId = `wdr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    // Reserve the coins immediately so they can't be spent/gifted while the
    // payout is under review. Rejecting a request refunds them (see
    // /api/admin/withdrawals PATCH).
    const { error: reserveError } = await supabase
      .from("profiles")
      .update({ loop_coins: currentCoins - coins_amount, updated_at: new Date().toISOString() })
      .eq("id", user.id)

    if (reserveError) {
      return NextResponse.json({ error: "Failed to reserve coins for payout" }, { status: 500 })
    }

    // Insert withdrawal request record — this is a real request, reviewed
    // manually by an admin (see /api/admin/withdrawals), not a placeholder.
    const { data: withdrawal, error: insertError } = await supabase
      .from("withdrawal_requests")
      .insert({
        id: requestId,
        user_id: user.id,
        username: profile?.username || user.email?.split("@")[0] || "user",
        coins_amount,
        estimated_usd: Number(estimatedUsd),
        payout_method,
        payout_details,
        status: "pending_review",
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating withdrawal request:", insertError)
      // Refund the reservation if we couldn't record the request
      await supabase
        .from("profiles")
        .update({ loop_coins: currentCoins, updated_at: new Date().toISOString() })
        .eq("id", user.id)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Payout request submitted. Our team manually reviews cashout requests within a few business days.",
      request: withdrawal
    })
  } catch (error: any) {
    console.error("POST /api/wallet/withdraw error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
