import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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

    const { reward_id } = await request.json()

    if (!reward_id) {
      return NextResponse.json({ error: "Reward ID is required" }, { status: 400 })
    }

    // Check if reward exists and is available for redemption
    const { data: reward, error: rewardError } = await supabase
      .from("quest_rewards")
      .select("*")
      .eq("id", reward_id)
      .eq("user_id", user.id)
      .eq("is_redeemed", false)
      .single()

    if (rewardError || !reward) {
      return NextResponse.json({ error: "Reward not found or already redeemed" }, { status: 404 })
    }

    // Get the shop item details
    const { data: shopItem, error: itemError } = await supabase
      .from("shop_items")
      .select("*")
      .eq("id", reward.item_id)
      .single()

    if (itemError || !shopItem) {
      return NextResponse.json({ error: "Shop item not found" }, { status: 404 })
    }

    // Start transaction
    const { error: transactionError } = await supabase.rpc("redeem_quest_reward", {
      p_user_id: user.id,
      p_reward_id: reward_id,
      p_item_id: reward.item_id,
    })

    if (transactionError) {
      console.error("Transaction error:", transactionError)
      return NextResponse.json({ error: "Failed to redeem reward" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Reward redeemed successfully",
      item: shopItem,
    })
  } catch (error) {
    console.error("Error redeeming reward:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
