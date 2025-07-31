import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// This endpoint should be called by a cron job weekly
export async function POST(request: NextRequest) {
  try {
    // Verify this is called from a trusted source (cron job)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: activeUsers, error: usersError } = await supabase
      .from("profiles")
      .select("id, loop_coins, last_login")
      .gte("last_login", thirtyDaysAgo.toISOString())

    if (usersError) {
      console.error("Error fetching users:", usersError)
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    if (!activeUsers || activeUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active users found",
        updated: 0,
      })
    }

    // Update all active users with 500 bonus coins
    const updates = activeUsers.map((user) => ({
      id: user.id,
      loop_coins: user.loop_coins + 500,
    }))

    const { error: updateError } = await supabase.from("profiles").upsert(updates)

    if (updateError) {
      console.error("Error updating coins:", updateError)
      return NextResponse.json({ error: "Failed to update coins" }, { status: 500 })
    }

    // Log the weekly bonus distribution
    await supabase.from("coin_transactions").insert(
      activeUsers.map((user) => ({
        user_id: user.id,
        amount: 500,
        type: "weekly_bonus",
        description: "Weekly Loop Coins bonus",
        created_at: new Date().toISOString(),
      })),
    )

    return NextResponse.json({
      success: true,
      message: `Weekly bonus distributed to ${activeUsers.length} active users`,
      updated: activeUsers.length,
    })
  } catch (error) {
    console.error("Error distributing weekly coins:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
