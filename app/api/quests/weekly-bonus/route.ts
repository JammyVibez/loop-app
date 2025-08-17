import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const WEEKLY_BONUS_AMOUNT = 500

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Verify user token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    // Check if user has already claimed weekly bonus this week
    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const { data: existingClaim, error: claimError } = await supabase
      .from("weekly_bonus_claims")
      .select("*")
      .eq("user_id", user.id)
      .gte("claimed_at", startOfWeek.toISOString())
      .single()

    if (existingClaim) {
      return NextResponse.json(
        {
          error: "Weekly bonus already claimed this week",
          next_available: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { status: 400 },
      )
    }

    // Award the weekly bonus
    const { error: updateError } = await supabase.rpc("award_weekly_bonus", {
      p_user_id: user.id,
      p_bonus_amount: WEEKLY_BONUS_AMOUNT,
    })

    if (updateError) {
      console.error("Error awarding weekly bonus:", updateError)
      return NextResponse.json({ error: "Failed to award weekly bonus" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      bonus_amount: WEEKLY_BONUS_AMOUNT,
      message: `Weekly bonus of ${WEEKLY_BONUS_AMOUNT} Loop Coins awarded!`,
    })
  } catch (error) {
    console.error("Error claiming weekly bonus:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
