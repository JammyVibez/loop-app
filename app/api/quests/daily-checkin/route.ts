import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const DAILY_AMOUNT = 40

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

async function getUser(token: string | null) {
  if (!token) return null
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUser(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const dayStart = startOfUtcDay().toISOString()
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const [{ data: dailyClaim }, { data: weeklyClaim }, { data: profile }] = await Promise.all([
      supabase
        .from("coin_transactions")
        .select("id, created_at, amount")
        .eq("user_id", user.id)
        .eq("transaction_type", "daily_checkin")
        .gte("created_at", dayStart)
        .maybeSingle(),
      supabase
        .from("weekly_bonus_claims")
        .select("id, claimed_at, bonus_amount")
        .eq("user_id", user.id)
        .gte("claimed_at", weekStart.toISOString())
        .maybeSingle(),
      supabase.from("profiles").select("loop_coins, level, xp_points").eq("id", user.id).maybeSingle(),
    ])

    // Soft streak: consecutive days with daily_checkin in last 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentCheckins } = await supabase
      .from("coin_transactions")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("transaction_type", "daily_checkin")
      .gte("created_at", fourteenDaysAgo)
      .order("created_at", { ascending: false })

    const days = new Set((recentCheckins || []).map((row) => row.created_at.slice(0, 10)))
    let streak = 0
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      const key = d.toISOString().slice(0, 10)
      if (days.has(key)) streak += 1
      else if (i > 0) break
    }

    return NextResponse.json({
      success: true,
      daily: {
        claimed: Boolean(dailyClaim),
        amount: DAILY_AMOUNT,
        streak,
      },
      weekly: {
        claimed: Boolean(weeklyClaim),
        amount: 500,
      },
      coins: profile?.loop_coins ?? 0,
      level: profile?.level ?? 1,
    })
  } catch (error) {
    console.error("Daily checkin GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUser(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const kind = body.kind === "weekly" ? "weekly" : "daily"

    if (kind === "weekly") {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(0, 0, 0, 0)

      const { data: existing } = await supabase
        .from("weekly_bonus_claims")
        .select("id")
        .eq("user_id", user.id)
        .gte("claimed_at", weekStart.toISOString())
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: "Weekly bonus already claimed", claimed: true }, { status: 400 })
      }

      const { data: profile } = await supabase.from("profiles").select("loop_coins").eq("id", user.id).maybeSingle()
      const nextCoins = Number(profile?.loop_coins || 0) + 500

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ loop_coins: nextCoins, updated_at: new Date().toISOString() })
        .eq("id", user.id)

      if (updateError) {
        // Fallback RPC if column update fails for any reason
        const { error: rpcError } = await supabase.rpc("award_weekly_bonus", {
          p_user_id: user.id,
          p_bonus_amount: 500,
        })
        if (rpcError) return NextResponse.json({ error: "Failed to award weekly bonus" }, { status: 500 })
      } else {
        await supabase.from("weekly_bonus_claims").insert({ user_id: user.id, bonus_amount: 500 })
        await supabase.from("coin_transactions").insert({
          user_id: user.id,
          amount: 500,
          transaction_type: "weekly_bonus",
          description: "Weekly Loop bonus",
        })
      }

      return NextResponse.json({ success: true, kind: "weekly", amount: 500, coins: nextCoins })
    }

    const dayStart = startOfUtcDay().toISOString()
    const { data: existingDaily } = await supabase
      .from("coin_transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("transaction_type", "daily_checkin")
      .gte("created_at", dayStart)
      .maybeSingle()

    if (existingDaily) {
      return NextResponse.json({ error: "Already checked in today", claimed: true }, { status: 400 })
    }

    const { data: profile } = await supabase.from("profiles").select("loop_coins, xp_points").eq("id", user.id).maybeSingle()
    const nextCoins = Number(profile?.loop_coins || 0) + DAILY_AMOUNT
    const nextXp = Number(profile?.xp_points || 0) + 15

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        loop_coins: nextCoins,
        xp_points: nextXp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    await supabase.from("coin_transactions").insert({
      user_id: user.id,
      amount: DAILY_AMOUNT,
      transaction_type: "daily_checkin",
      description: "Daily check-in streak bonus",
    })

    return NextResponse.json({
      success: true,
      kind: "daily",
      amount: DAILY_AMOUNT,
      coins: nextCoins,
      xp_gained: 15,
    })
  } catch (error) {
    console.error("Daily checkin POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
