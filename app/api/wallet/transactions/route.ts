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

    // 1. Fetch user coin balance
    const { data: profile } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", user.id)
      .single()

    const coinBalance = profile?.loop_coins ?? 0

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

// Loop Coins can only be credited by a verified Stripe payment (see
// /api/shop/purchase for Checkout Session creation and /api/payments/webhook
// for crediting on "checkout.session.completed"). There is intentionally no
// client-callable way to mint coins directly — do not re-add one here.
export async function POST() {
  return NextResponse.json(
    {
      error: "Direct wallet deposits are disabled. Buy Loop Coins with a real payment via /api/shop/purchase.",
    },
    { status: 410 },
  )
}
