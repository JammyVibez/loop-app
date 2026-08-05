import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

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
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

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

    // Insert withdrawal request record
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
        status: "coming_soon_queued",
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating withdrawal request:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Withdrawal pre-request queued! Payout processing is launching soon for verified creators.",
      request: withdrawal
    })
  } catch (error: any) {
    console.error("POST /api/wallet/withdraw error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
