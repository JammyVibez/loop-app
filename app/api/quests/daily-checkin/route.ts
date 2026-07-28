import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const DAILY_AMOUNT = 40
const DAILY_MS = 24 * 60 * 60 * 1000
const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000
const WEEKLY_AMOUNT = 500

async function getUser(token: string | null) {
  if (!token) return null
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

function nextAt(fromIso: string, windowMs: number) {
  return new Date(new Date(fromIso).getTime() + windowMs).toISOString()
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUser(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sinceDaily = new Date(Date.now() - DAILY_MS * 2).toISOString()
    const sinceWeekly = new Date(Date.now() - WEEKLY_MS * 2).toISOString()

    const [{ data: lastDaily }, { data: lastWeekly }, { data: profile }, { data: recentCheckins }] = await Promise.all([
      supabase
        .from("coin_transactions")
        .select("id, created_at, amount")
        .eq("user_id", user.id)
        .eq("transaction_type", "daily_checkin")
        .gte("created_at", sinceDaily)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("weekly_bonus_claims")
        .select("id, claimed_at, bonus_amount")
        .eq("user_id", user.id)
        .gte("claimed_at", sinceWeekly)
        .order("claimed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("loop_coins, level, xp_points").eq("id", user.id).maybeSingle(),
      supabase
        .from("coin_transactions")
        .select("created_at")
        .eq("user_id", user.id)
        .eq("transaction_type", "daily_checkin")
        .gte("created_at", new Date(Date.now() - 14 * DAILY_MS).toISOString())
        .order("created_at", { ascending: false }),
    ])

    const now = Date.now()
    const dailyClaimedAt = lastDaily?.created_at || null
    const weeklyClaimedAt = lastWeekly?.claimed_at || null
    const dailyReadyAt = dailyClaimedAt ? nextAt(dailyClaimedAt, DAILY_MS) : null
    const weeklyReadyAt = weeklyClaimedAt ? nextAt(weeklyClaimedAt, WEEKLY_MS) : null
    const dailyClaimed = Boolean(dailyReadyAt && new Date(dailyReadyAt).getTime() > now)
    const weeklyClaimed = Boolean(weeklyReadyAt && new Date(weeklyReadyAt).getTime() > now)

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
        claimed: dailyClaimed,
        amount: DAILY_AMOUNT,
        streak,
        claimed_at: dailyClaimedAt,
        next_available: dailyClaimed ? dailyReadyAt : new Date().toISOString(),
        cooldown_hours: 24,
      },
      weekly: {
        claimed: weeklyClaimed,
        amount: WEEKLY_AMOUNT,
        claimed_at: weeklyClaimedAt,
        next_available: weeklyClaimed ? weeklyReadyAt : new Date().toISOString(),
        cooldown_days: 7,
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
    const now = Date.now()

    if (kind === "weekly") {
      const { data: lastWeekly } = await supabase
        .from("weekly_bonus_claims")
        .select("id, claimed_at")
        .eq("user_id", user.id)
        .order("claimed_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastWeekly?.claimed_at) {
        const readyAt = new Date(lastWeekly.claimed_at).getTime() + WEEKLY_MS
        if (readyAt > now) {
          return NextResponse.json(
            {
              error: "Weekly bonus already claimed. Come back after 7 days.",
              claimed: true,
              next_available: new Date(readyAt).toISOString(),
            },
            { status: 400 },
          )
        }
      }

      const { data: profile } = await supabase.from("profiles").select("loop_coins").eq("id", user.id).maybeSingle()
      const nextCoins = Number(profile?.loop_coins || 0) + WEEKLY_AMOUNT

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ loop_coins: nextCoins, updated_at: new Date().toISOString() })
        .eq("id", user.id)

      if (updateError) {
        const { error: rpcError } = await supabase.rpc("award_weekly_bonus", {
          p_user_id: user.id,
          p_bonus_amount: WEEKLY_AMOUNT,
        })
        if (rpcError) return NextResponse.json({ error: "Failed to award weekly bonus" }, { status: 500 })
      } else {
        await supabase.from("weekly_bonus_claims").insert({ user_id: user.id, bonus_amount: WEEKLY_AMOUNT })
        await supabase.from("coin_transactions").insert({
          user_id: user.id,
          amount: WEEKLY_AMOUNT,
          transaction_type: "weekly_bonus",
          description: "Weekly Loop bonus (7-day cooldown)",
        })
      }

      return NextResponse.json({
        success: true,
        kind: "weekly",
        amount: WEEKLY_AMOUNT,
        coins: nextCoins,
        next_available: new Date(now + WEEKLY_MS).toISOString(),
      })
    }

    const { data: lastDaily } = await supabase
      .from("coin_transactions")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("transaction_type", "daily_checkin")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastDaily?.created_at) {
      const readyAt = new Date(lastDaily.created_at).getTime() + DAILY_MS
      if (readyAt > now) {
        return NextResponse.json(
          {
            error: "Daily check-in already claimed. Come back after 24 hours.",
            claimed: true,
            next_available: new Date(readyAt).toISOString(),
          },
          { status: 400 },
        )
      }
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
      description: "Daily check-in (24h cooldown)",
    })

    return NextResponse.json({
      success: true,
      kind: "daily",
      amount: DAILY_AMOUNT,
      coins: nextCoins,
      xp_gained: 15,
      next_available: new Date(now + DAILY_MS).toISOString(),
    })
  } catch (error) {
    console.error("Daily checkin POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
