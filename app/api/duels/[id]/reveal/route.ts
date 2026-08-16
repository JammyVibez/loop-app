import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: duelId } = await params
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = user.id

    const { correctSide } = await req.json()
    if (correctSide !== "yes" && correctSide !== "no") {
      return NextResponse.json({ error: "correctSide must be yes or no" }, { status: 400 })
    }

    const { data: duel, error: duelErr } = await supabase
      .from("loop_duels")
      .select("*")
      .eq("id", duelId)
      .maybeSingle()
    if (duelErr || !duel) return NextResponse.json({ error: "Duel not found" }, { status: 404 })
    if (duel.duel_type !== "clutch") return NextResponse.json({ error: "Not a clutch duel" }, { status: 400 })
    if (duel.outcome_revealed) {
      return NextResponse.json({ error: "Outcome already revealed" }, { status: 400 })
    }

    // Only the creator (or an admin) may reveal the outcome.
    const isAdmin = Boolean((user as any)?.is_admin)
    if (duel.creator_id !== userId && !isAdmin) {
      return NextResponse.json({ error: "Only the duel creator can reveal the outcome" }, { status: 403 })
    }

    // Mark revealed first — then settle.
    await supabase
      .from("loop_duels")
      .update({ correct_side: correctSide, outcome_revealed: true, updated_at: new Date().toISOString() })
      .eq("id", duelId)

    const { data: predictions } = await supabase
      .from("clutch_duel_predictions")
      .select("id, user_id, side, stake_coins")
      .eq("duel_id", duelId)

    const rows = predictions || []
    const correct = rows.filter((p) => p.side === correctSide)
    const wrong = rows.filter((p) => p.side !== correctSide)
    const wrongPool = wrong.reduce((s, p) => s + Number(p.stake_coins || 0), 0)
    const correctStakeTotal = correct.reduce((s, p) => s + Number(p.stake_coins || 0), 0)

    interface Payout {
      user_id: string
      amount: number
      kind: "win" | "refund"
    }
    const payouts: Payout[] = []

    if (correct.length === 0) {
      // No one guessed right — refund the whole pool proportionally.
      for (const p of wrong) {
        const share = wrongPool > 0 ? (Number(p.stake_coins) / wrongPool) * wrongPool : 0
        payouts.push({ user_id: p.user_id, amount: Math.floor(share), kind: "refund" })
      }
    } else {
      // Winners get their stake back plus a proportional cut of the losers' pool.
      for (const p of correct) {
        const bonus = correctStakeTotal > 0 ? Math.floor((Number(p.stake_coins) / correctStakeTotal) * wrongPool) : 0
        payouts.push({ user_id: p.user_id, amount: Number(p.stake_coins) + bonus, kind: "win" })
      }
      // Losers get nothing (their stake funds the winners).
      if (wrong.length === 0 && correct.length > 0) {
        // Nothing was pooled — winners already keep their stake via the loop above.
      }
    }

    // Credit payouts atomically per user.
    for (const payout of payouts) {
      if (payout.amount <= 0) continue
      const { data: prof } = await supabase
        .from("profiles")
        .select("loop_coins")
        .eq("id", payout.user_id)
        .maybeSingle()
      if (!prof) continue
      await supabase
        .from("profiles")
        .update({ loop_coins: Number(prof.loop_coins || 0) + payout.amount, updated_at: new Date().toISOString() })
        .eq("id", payout.user_id)
      try {
        await supabase.from("coin_transactions").insert({
          user_id: payout.user_id,
          amount: payout.amount,
          transaction_type: "clutch_duel_winnings",
          description:
            payout.kind === "refund"
              ? `Clutch Duel refund (no correct predictions)`
              : `Won Clutch Duel — ${duel.prediction_question || "prediction"}`,
          reference_id: duelId,
        })
      } catch (txErr) {
        console.error("Clutch payout transaction error:", txErr)
      }
    }

    await supabase
      .from("loop_duels")
      .update({ payout_processed: true, status: "completed", updated_at: new Date().toISOString() })
      .eq("id", duelId)

    // Notify winners.
    try {
      const { notifyUser } = await import("@/lib/notifications")
      for (const payout of payouts) {
        if (payout.amount <= 0) continue
        await notifyUser(supabase, {
          userId: payout.user_id,
          type: "clutch_duel_result",
          title: payout.kind === "refund" ? "Clutch Duel refunded" : "You won your Clutch Duel! 🎉",
          message:
            payout.kind === "refund"
              ? "Nobody predicted correctly, so your stake was refunded."
              : `You earned ${payout.amount} coins — ${duel.prediction_question || "the clutch was real!"}`,
          actionUrl: `/loop/${duel.loop_id}`,
          actorId: userId,
          pushCategory: "social",
          data: { duelId, loopId: duel.loop_id },
        })
      }
    } catch (notifyErr) {
      console.error("Clutch payout notify error:", notifyErr)
    }

    return NextResponse.json({
      success: true,
      correct_side: correctSide,
      payouts: payouts.filter((p) => p.amount > 0),
      summary: { total_predictions: rows.length, correct: correct.length, wrong: wrong.length, wrong_pool: wrongPool },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
