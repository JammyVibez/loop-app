import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

const MIN_STAKE = 5
const MAX_STAKE = 5000

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: duelId } = await params
    const { data: duel, error } = await supabase
      .from("loop_duels")
      .select("id, duel_type, yes_stake, no_stake, betting_ends_at, outcome_revealed, correct_side")
      .eq("id", duelId)
      .maybeSingle()
    if (error || !duel) return NextResponse.json({ error: "Duel not found" }, { status: 404 })
    if (duel.duel_type !== "clutch") {
      return NextResponse.json({ error: "Not a clutch duel" }, { status: 400 })
    }

    const { data: predictions } = await supabase
      .from("clutch_duel_predictions")
      .select("side, stake_coins")
      .eq("duel_id", duelId)

    const yesStake = (predictions || []).filter((p) => p.side === "yes").reduce((s, p) => s + Number(p.stake_coins || 0), 0)
    const noStake = (predictions || []).filter((p) => p.side === "no").reduce((s, p) => s + Number(p.stake_coins || 0), 0)

    return NextResponse.json({
      success: true,
      summary: {
        yes: { predictions: (predictions || []).filter((p) => p.side === "yes").length, stake: yesStake },
        no: { predictions: (predictions || []).filter((p) => p.side === "no").length, stake: noStake },
      },
      bettingOpen: !duel.outcome_revealed && new Date(duel.betting_ends_at).getTime() > Date.now(),
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
    const { id: duelId } = await params
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: authData, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = authData.user.id

    const { side, stake } = await req.json()
    if (side !== "yes" && side !== "no") {
      return NextResponse.json({ error: "Invalid side. Must be yes or no." }, { status: 400 })
    }
    const stakeAmount = Number(stake)
    if (!Number.isFinite(stakeAmount) || stakeAmount < MIN_STAKE || stakeAmount > MAX_STAKE) {
      return NextResponse.json({ error: `Stake must be between ${MIN_STAKE} and ${MAX_STAKE} coins` }, { status: 400 })
    }

    // Duel must exist, be a clutch duel, and still be in the betting window.
    const { data: duel, error: duelErr } = await supabase
      .from("loop_duels")
      .select("id, duel_type, status, betting_ends_at, outcome_revealed, payout_processed, creator_id")
      .eq("id", duelId)
      .maybeSingle()
    if (duelErr || !duel) return NextResponse.json({ error: "Duel not found" }, { status: 404 })
    if (duel.duel_type !== "clutch") return NextResponse.json({ error: "Not a clutch duel" }, { status: 400 })
    if (duel.status !== "active" || duel.outcome_revealed) {
      return NextResponse.json({ error: "This duel is no longer accepting predictions" }, { status: 400 })
    }
    if (new Date(duel.betting_ends_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "The prediction window has closed" }, { status: 400 })
    }
    if (duel.creator_id === userId) {
      return NextResponse.json({ error: "You can't predict on your own clutch duel" }, { status: 400 })
    }

    // One prediction per user.
    const { data: existing } = await supabase
      .from("clutch_duel_predictions")
      .select("id")
      .eq("duel_id", duelId)
      .eq("user_id", userId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: "You already locked in your prediction for this duel" }, { status: 400 })
    }

    // Atomic coin deduction (same guard pattern as gift purchases).
    const { data: profile } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", userId)
      .maybeSingle()
    if (!profile || Number(profile.loop_coins || 0) < stakeAmount) {
      return NextResponse.json({ error: "Insufficient coins" }, { status: 400 })
    }

    const { data: deducted, error: deductErr } = await supabase
      .from("profiles")
      .update({
        loop_coins: Number(profile.loop_coins) - stakeAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .gte("loop_coins", stakeAmount)
      .select("loop_coins")
    if (deductErr || !deducted?.length) {
      return NextResponse.json({ error: "Failed to deduct coins" }, { status: 400 })
    }

    // Record the prediction.
    const { data: prediction, error: insertErr } = await supabase
      .from("clutch_duel_predictions")
      .insert({ duel_id: duelId, user_id: userId, side, stake_coins: stakeAmount })
      .select()
      .single()
    if (insertErr || !prediction) {
      // Refund on failure to record.
      await supabase
        .from("profiles")
        .update({ loop_coins: Number(profile.loop_coins), updated_at: new Date().toISOString() })
        .eq("id", userId)
      return NextResponse.json({ error: insertErr?.message || "Failed to record prediction" }, { status: 500 })
    }

    // Recompute cached stake totals.
    const { data: allPredictions } = await supabase
      .from("clutch_duel_predictions")
      .select("side, stake_coins")
      .eq("duel_id", duelId)
    const yesTotal = (allPredictions || []).filter((p) => p.side === "yes").reduce((s, p) => s + Number(p.stake_coins || 0), 0)
    const noTotal = (allPredictions || []).filter((p) => p.side === "no").reduce((s, p) => s + Number(p.stake_coins || 0), 0)
    await supabase.from("loop_duels").update({ yes_stake: yesTotal, no_stake: noTotal }).eq("id", duelId)

    try {
      await supabase.from("coin_transactions").insert({
        user_id: userId,
        amount: -stakeAmount,
        transaction_type: "clutch_duel_stake",
        description: `Staked ${stakeAmount} coins on a Clutch Duel (${side.toUpperCase()})`,
        reference_id: duelId,
      })
    } catch (txErr) {
      console.error("Clutch stake transaction error:", txErr)
    }

    return NextResponse.json({
      success: true,
      prediction,
      new_balance: deducted[0].loop_coins,
      summary: { yes: yesTotal, no: noTotal },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
