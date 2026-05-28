import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function getAuthenticatedUser(request: NextRequest, supabase: ReturnType<typeof createServerClient>) {
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.replace(/^Bearer\s+/i, "")

  if (!token) {
    return { user: null, error: "Unauthorized" }
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { user: null, error: "Invalid token" }
  }

  return { user, error: null }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { user, error: authError } = await getAuthenticatedUser(request, supabase)

    if (authError || !user) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { type, amount } = body

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    const currentCoins = profile?.loop_coins || 0

    if (type === "onboarding_bonus") {
      const bonusAmount = amount || 100
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
    }

    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const { data: existingClaim } = await supabase
      .from("weekly_bonus_claims")
      .select("id")
      .eq("user_id", user.id)
      .gte("claimed_at", startOfWeek.toISOString())
      .maybeSingle()

    if (existingClaim) {
      return NextResponse.json(
        {
          error: "Weekly bonus already claimed this week",
          next_available: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { status: 400 },
      )
    }

    const weeklyAmount = 500
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ loop_coins: currentCoins + weeklyAmount, updated_at: new Date().toISOString() })
      .eq("id", user.id)

    if (updateError) {
      console.error("Error awarding weekly bonus:", updateError)
      return NextResponse.json({ error: "Failed to award weekly bonus" }, { status: 500 })
    }

    await supabase.from("weekly_bonus_claims").insert({
      user_id: user.id,
      bonus_amount: weeklyAmount,
    })

    await supabase.from("coin_transactions").insert({
      user_id: user.id,
      amount: weeklyAmount,
      transaction_type: "weekly_bonus",
      description: "Weekly bonus coins",
    })

    return NextResponse.json({
      success: true,
      bonus_amount: weeklyAmount,
      message: "Weekly bonus of 500 Loop Coins awarded!",
    })
  } catch (error) {
    console.error("Error processing coins request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
