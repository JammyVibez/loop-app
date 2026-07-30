import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const { action, amount } = await request.json()
    const supabase = createServerClient()

    if (action === "weekly_reward") {
      const rewardAmount = Number(amount || 500)
      const { data: profiles, error: fetchError } = await supabase
        .from("profiles")
        .select("id, loop_coins")
        .eq("is_banned", false)

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }

      let rewarded = 0
      for (const profile of profiles || []) {
        const { error } = await supabase
          .from("profiles")
          .update({
            loop_coins: Number(profile.loop_coins || 0) + rewardAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id)

        if (!error) {
          rewarded++
          await supabase.from("coin_transactions").insert({
            user_id: profile.id,
            amount: rewardAmount,
            transaction_type: "admin_reward",
            description: "Admin weekly reward",
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: "Weekly rewards distributed successfully",
        users_rewarded: rewarded,
        total_coins_distributed: rewarded * rewardAmount,
      })
    }

    if (action === "bulk_reward" && amount) {
      const rewardAmount = Number(amount)
      if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 })
      }

      const { data: profiles, error: fetchError } = await supabase
        .from("profiles")
        .select("id, loop_coins")
        .eq("is_banned", false)

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }

      let rewarded = 0
      for (const profile of profiles || []) {
        const { error } = await supabase
          .from("profiles")
          .update({
            loop_coins: Number(profile.loop_coins || 0) + rewardAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id)

        if (!error) {
          rewarded++
          await supabase.from("coin_transactions").insert({
            user_id: profile.id,
            amount: rewardAmount,
            transaction_type: "admin_reward",
            description: "Admin bulk reward",
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: `Bulk reward of ${rewardAmount} coins distributed`,
        users_rewarded: rewarded,
        total_coins_distributed: rewarded * rewardAmount,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error managing user coins:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
