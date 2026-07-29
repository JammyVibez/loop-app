import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getEconomySettings } from "@/lib/economy"

async function getAuthenticatedUser(request: NextRequest, supabase: ReturnType<typeof createServerClient>) {
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "")

  if (!token) {
    return { user: null, error: "Unauthorized" }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { user: null, error: "Invalid token" }
  }

  return { user, error: null }
}

/**
 * Onboarding bonus only — weekly faucet lives on /api/quests/daily-checkin.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { user, error: authError } = await getAuthenticatedUser(request, supabase)

    if (authError || !user) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { type } = body
    const economy = await getEconomySettings(supabase)

    if (type !== "onboarding_bonus") {
      return NextResponse.json(
        {
          error: "Use /api/quests/daily-checkin for daily/weekly claims",
          redirect: "/api/quests/daily-checkin",
        },
        { status: 400 },
      )
    }

    const bonusAmount = economy.onboarding_bonus

    // One-time only
    const { data: existing } = await supabase
      .from("coin_transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("transaction_type", "onboarding_bonus")
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      return NextResponse.json({
        success: true,
        bonus_amount: 0,
        already_claimed: true,
        message: "Onboarding bonus already awarded",
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    const currentCoins = profile?.loop_coins || 0
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ loop_coins: currentCoins + bonusAmount, updated_at: new Date().toISOString() })
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await supabase.from("coin_transactions").insert({
      user_id: user.id,
      amount: bonusAmount,
      transaction_type: "onboarding_bonus",
      description: "Onboarding completion bonus",
    })

    return NextResponse.json({
      success: true,
      bonus_amount: bonusAmount,
      message: `Onboarding bonus of ${bonusAmount} Loop Coins awarded!`,
    })
  } catch (error) {
    console.error("Error processing coins request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
