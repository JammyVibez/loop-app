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

    // 1. Fetch user coin balance
    const { data: profile } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", user.id)
      .single()

    const coinBalance = profile?.loop_coins ?? (user as any).user_metadata?.loop_coins ?? 2500

    // 2. Fetch recent transactions
    const { data: transactions, error: txError } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)

    if (txError && txError.code !== "PGRST116") {
      console.warn("Wallet transactions fetch warning:", txError.message)
    }

    return NextResponse.json({
      success: true,
      balance: Number(coinBalance),
      transactions: transactions || [],
    })
  } catch (error: any) {
    console.error("GET /api/wallet/transactions error:", error)
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
    const { amount_usd, coins_amount, payment_method, description } = body

    if (!coins_amount || Number(coins_amount) <= 0) {
      return NextResponse.json({ error: "Invalid coin amount" }, { status: 400 })
    }

    const supabase = createServerClient()

    // 1. Fetch current profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", user.id)
      .single()

    const currentCoins = Number(profile?.loop_coins ?? (user as any).user_metadata?.loop_coins ?? 2500)
    const addedCoins = Number(coins_amount)
    const newCoins = currentCoins + addedCoins

    // 2. Update user profile balance
    const { error: updateError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        loop_coins: newCoins,
        updated_at: new Date().toISOString()
      })

    if (updateError) {
      console.error("Failed to update loop_coins in profile:", updateError)
    }

    // 3. Record transaction
    const txRecord = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: user.id,
      amount_usd: Number(amount_usd || 0),
      coins_amount: addedCoins,
      type: "deposit",
      description: description || `Deposited $${amount_usd || 0} for ${addedCoins} Loop Coins`,
      status: "completed",
      payment_method: payment_method || "card",
      created_at: new Date().toISOString()
    }

    const { data: newTx, error: txError } = await supabase
      .from("wallet_transactions")
      .insert(txRecord)
      .select()
      .single()

    if (txError) {
      console.warn("Transaction record save warning:", txError.message)
    }

    return NextResponse.json({
      success: true,
      newBalance: newCoins,
      transaction: newTx || txRecord,
      message: `Successfully deposited ${addedCoins} Loop Coins!`
    })
  } catch (error: any) {
    console.error("POST /api/wallet/transactions error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
