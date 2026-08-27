import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { calculateBoostInfo } from "@/lib/boost"
import { notifyUser } from "@/lib/notifications"
import { getUserFromRequest } from "@/lib/server-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loopId } = await params

    const { data: loop } = await supabase
      .from("loops")
      .select("id, boost_coins_current, boost_coins_target, is_boosted, boosted_at, boost_tier")
      .eq("id", loopId)
      .single()

    if (!loop) {
      return NextResponse.json({ error: "Loop not found" }, { status: 404 })
    }

    const boostInfo = calculateBoostInfo(loop)

    // Fetch top contributors
    const { data: rawBoosts } = await supabase
      .from("loop_boosts")
      .select("id, coins, created_at, user:profiles!user_id(id, username, display_name, avatar_url, video_avatar_url)")
      .eq("loop_id", loopId)
      .order("created_at", { ascending: false })
      .limit(20)

    const contributorCount = rawBoosts
      ? new Set(
          rawBoosts.map((b: any) => {
            const u = Array.isArray(b.user) ? b.user[0] : b.user
            return u?.id || b.user_id
          })
        ).size
      : 0

    return NextResponse.json({
      success: true,
      boostInfo,
      contributors: rawBoosts || [],
      contributorCount,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loopId } = await params


    const authUser = await getUserFromRequest(req)
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authUser.id
    const { coins } = await req.json()
    const coinAmount = Number(coins)

    if (!coinAmount || coinAmount <= 0 || !Number.isFinite(coinAmount)) {
      return NextResponse.json({ error: "Coin contribution must be greater than 0" }, { status: 400 })
    }

    // 1. Fetch current loop boost state
    const { data: loop, error: loopErr } = await supabase
      .from("loops")
      .select("id, author_id, boost_coins_current, boost_coins_target, is_boosted, boosted_at, boost_tier, trending_score")
      .eq("id", loopId)
      .single()

    if (loopErr || !loop) {
      return NextResponse.json({ error: "Loop not found" }, { status: 404 })
    }

    // Boosting used to pool "coins" against the loop's target without ever
    // touching the booster's real wallet — anyone could boost unlimited
    // loops for free. Charge the booster's actual loop_coins balance first,
    // atomically, the same way gifts and shop purchases do.
    const { data: booster, error: boosterErr } = await supabase
      .from("profiles")
      .select("id, loop_coins, username, display_name")
      .eq("id", userId)
      .single()

    if (boosterErr || !booster) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (Number(booster.loop_coins || 0) < coinAmount) {
      return NextResponse.json({ error: "Insufficient Loop Coins" }, { status: 400 })
    }

    const { data: deductedRows, error: deductError } = await supabase
      .from("profiles")
      .update({
        loop_coins: Number(booster.loop_coins) - coinAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .gte("loop_coins", coinAmount)
      .select("loop_coins")

    if (deductError || !deductedRows?.length) {
      return NextResponse.json({ error: "Failed to deduct coins" }, { status: 400 })
    }

    const newBalance = deductedRows[0].loop_coins

    const currentCoins = loop.boost_coins_current || 0
    const newCoinsCurrent = currentCoins + coinAmount

    // Calculate Tier based on requirements:
    // Tier 1: 100+
    // Tier 2: 500+
    // Tier 3: 2000+
    let newTier = 0
    if (newCoinsCurrent >= 2000) newTier = 3
    else if (newCoinsCurrent >= 500) newTier = 2
    else if (newCoinsCurrent >= 100) newTier = 1

    const now = new Date().toISOString()

    // 2. Insert into loop_boosts log
    await supabase.from("loop_boosts").insert({
      loop_id: loopId,
      user_id: userId,
      coins: coinAmount,
      created_at: now,
    })

    // 3. Update loop boost progress & boost rank score
    const newTrendingScore = (loop.trending_score || 0) + coinAmount * 3

    const { data: updatedLoop, error: updateErr } = await supabase
      .from("loops")
      .update({
        boost_coins_current: newCoinsCurrent,
        is_boosted: newTier > 0,
        boost_tier: newTier,
        boosted_at: now,
        trending_score: newTrendingScore,
      })
      .eq("id", loopId)
      .select()
      .single()

    if (updateErr) {
      console.error("Failed to update loop boost:", updateErr)
      // Refund — the coins were already deducted above.
      await supabase
        .from("profiles")
        .update({ loop_coins: Number(booster.loop_coins), updated_at: new Date().toISOString() })
        .eq("id", userId)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: -coinAmount,
      transaction_type: "boost_spent",
      description: `Boosted a loop with ${coinAmount} Loop Coins`,
      reference_id: loopId,
    })

    const boostInfo = calculateBoostInfo(updatedLoop)

    if (loop.author_id && loop.author_id !== userId) {
      try {
        const { data: booster } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("id", userId)
          .maybeSingle()
        const boosterName = booster?.display_name || booster?.username || "Someone"
        const tierCrossed = newTier > (loop.boost_tier || 0)
        await notifyUser(supabase, {
          userId: loop.author_id,
          type: "boost",
          title: tierCrossed ? `Your loop just got boosted to Tier ${newTier}! 🚀` : "Your loop got boosted 🚀",
          message: `${boosterName} contributed ${coinAmount} Loop Coins to boost your loop.`,
          actorId: userId,
          actionUrl: `/loop/${loopId}`,
          data: { loop_id: loopId, coins: coinAmount, tier: newTier },
          pushCategory: "social",
        })
      } catch (notifyErr) {
        console.warn("Boost notify failed:", notifyErr)
      }
    }

    // Fetch total contributors count
    const { data: rawBoosts } = await supabase
      .from("loop_boosts")
      .select("id, coins, created_at, user:profiles!user_id(id, username, display_name, avatar_url, video_avatar_url)")
      .eq("loop_id", loopId)

    const contributorCount = rawBoosts
      ? new Set(
          rawBoosts.map((b: any) => {
            const u = Array.isArray(b.user) ? b.user[0] : b.user
            return u?.id || b.user_id
          })
        ).size
      : 1

    return NextResponse.json({
      success: true,
      boostInfo,
      boost: {
        current: newCoinsCurrent,
        target: updatedLoop.boost_coins_target || 1000,
        isBoosted: boostInfo.isBoosted,
        tier: boostInfo.tier,
      },
      contributors: rawBoosts?.slice(0, 10) || [],
      contributorCount,
      loop: updatedLoop,
      newLoopCoinsBalance: newBalance,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
