import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { awardXp, XP_REWARDS, levelFromXp } from "@/lib/xp"

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

async function latestDailyClaim(userId: string) {
  // Prefer dedicated daily_claims table
  const { data: claimRow } = await supabase
    .from("daily_claims")
    .select("id, claimed_at, amount")
    .eq("user_id", userId)
    .eq("kind", "daily")
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (claimRow?.claimed_at) {
    return { claimed_at: claimRow.claimed_at as string, amount: Number(claimRow.amount || DAILY_AMOUNT), source: "daily_claims" }
  }

  // Fallback: coin ledger (daily_checkin or quest_reward with daily description)
  const since = new Date(Date.now() - DAILY_MS * 2).toISOString()
  const { data: tx } = await supabase
    .from("coin_transactions")
    .select("id, created_at, amount, transaction_type, description")
    .eq("user_id", userId)
    .in("transaction_type", ["daily_checkin", "quest_reward"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10)

  const match = (tx || []).find(
    (row) =>
      row.transaction_type === "daily_checkin" ||
      /daily check-?in/i.test(String(row.description || "")),
  )
  if (match?.created_at) {
    return { claimed_at: match.created_at as string, amount: Number(match.amount || DAILY_AMOUNT), source: "coin_transactions" }
  }

  return null
}

async function recentDailyDays(userId: string) {
  const since = new Date(Date.now() - 14 * DAILY_MS).toISOString()
  const days = new Set<string>()

  const { data: claims } = await supabase
    .from("daily_claims")
    .select("claimed_at")
    .eq("user_id", userId)
    .eq("kind", "daily")
    .gte("claimed_at", since)

  for (const row of claims || []) {
    if (row.claimed_at) days.add(String(row.claimed_at).slice(0, 10))
  }

  if (days.size === 0) {
    const { data: txs } = await supabase
      .from("coin_transactions")
      .select("created_at, transaction_type, description")
      .eq("user_id", userId)
      .in("transaction_type", ["daily_checkin", "quest_reward"])
      .gte("created_at", since)

    for (const row of txs || []) {
      if (
        row.transaction_type === "daily_checkin" ||
        /daily check-?in/i.test(String(row.description || ""))
      ) {
        days.add(String(row.created_at).slice(0, 10))
      }
    }
  }

  let streak = 0
  for (let i = 0; i < 14; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (days.has(key)) streak += 1
    else if (i > 0) break
  }
  return streak
}

async function recordDailyClaim(userId: string, amount: number) {
  const claimedAt = new Date().toISOString()

  const { error: claimError } = await supabase.from("daily_claims").insert({
    user_id: userId,
    kind: "daily",
    amount,
    claimed_at: claimedAt,
  })

  // Write ledger with allowed types — try daily_checkin first, fall back to quest_reward
  let ledgerOk = false
  const { error: dailyTypeError } = await supabase.from("coin_transactions").insert({
    user_id: userId,
    amount,
    transaction_type: "daily_checkin",
    description: "Daily check-in (24h cooldown)",
  })
  if (!dailyTypeError) {
    ledgerOk = true
  } else {
    const { error: questError } = await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount,
      transaction_type: "quest_reward",
      description: "Daily check-in (24h cooldown)",
    })
    ledgerOk = !questError
    if (questError) console.error("Daily claim ledger insert failed:", questError.message)
  }

  if (claimError) {
    console.error("daily_claims insert failed:", claimError.message)
    // If both claim table and ledger fail, surface error to caller
    if (!ledgerOk) throw new Error(claimError.message)
  }

  return claimedAt
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUser(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sinceWeekly = new Date(Date.now() - WEEKLY_MS * 2).toISOString()

    const [lastDaily, { data: lastWeekly }, { data: profile }, streak] = await Promise.all([
      latestDailyClaim(user.id),
      supabase
        .from("weekly_bonus_claims")
        .select("id, claimed_at, bonus_amount")
        .eq("user_id", user.id)
        .gte("claimed_at", sinceWeekly)
        .order("claimed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("loop_coins, level, xp_points").eq("id", user.id).maybeSingle(),
      recentDailyDays(user.id),
    ])

    const now = Date.now()
    const dailyClaimedAt = lastDaily?.claimed_at || null
    const weeklyClaimedAt = lastWeekly?.claimed_at || null
    const dailyReadyAt = dailyClaimedAt ? nextAt(dailyClaimedAt, DAILY_MS) : null
    const weeklyReadyAt = weeklyClaimedAt ? nextAt(weeklyClaimedAt, WEEKLY_MS) : null
    const dailyClaimed = Boolean(dailyReadyAt && new Date(dailyReadyAt).getTime() > now)
    const weeklyClaimed = Boolean(weeklyReadyAt && new Date(weeklyReadyAt).getTime() > now)

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
      level: profile?.level ?? levelFromXp(Number(profile?.xp_points || 0)),
      xp_points: profile?.xp_points ?? 0,
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
        await supabase.from("daily_claims").insert({
          user_id: user.id,
          kind: "weekly",
          amount: WEEKLY_AMOUNT,
        })
        await supabase.from("coin_transactions").insert({
          user_id: user.id,
          amount: WEEKLY_AMOUNT,
          transaction_type: "weekly_bonus",
          description: "Weekly Loop bonus (7-day cooldown)",
        })
      }

      const xp = await awardXp(supabase, user.id, "weekly_bonus", "Weekly bonus")

      return NextResponse.json({
        success: true,
        kind: "weekly",
        amount: WEEKLY_AMOUNT,
        coins: nextCoins,
        xp_gained: xp?.xp_gained || XP_REWARDS.weekly_bonus,
        level: xp?.level,
        next_available: new Date(now + WEEKLY_MS).toISOString(),
      })
    }

    const lastDaily = await latestDailyClaim(user.id)
    if (lastDaily?.claimed_at) {
      const readyAt = new Date(lastDaily.claimed_at).getTime() + DAILY_MS
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

    const { data: profile } = await supabase.from("profiles").select("loop_coins, xp_points, level").eq("id", user.id).maybeSingle()
    const nextCoins = Number(profile?.loop_coins || 0) + DAILY_AMOUNT

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        loop_coins: nextCoins,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    try {
      await recordDailyClaim(user.id, DAILY_AMOUNT)
    } catch (err: any) {
      // Coins already credited — still try to keep claim state consistent via quest_reward
      console.error("recordDailyClaim error:", err?.message || err)
    }

    const xp = await awardXp(supabase, user.id, "daily_checkin", "Daily check-in")

    return NextResponse.json({
      success: true,
      kind: "daily",
      amount: DAILY_AMOUNT,
      coins: nextCoins,
      xp_gained: xp?.xp_gained || XP_REWARDS.daily_checkin,
      level: xp?.level,
      xp_points: xp?.xp_points,
      leveled_up: xp?.leveled_up || false,
      next_available: new Date(now + DAILY_MS).toISOString(),
      claimed: true,
    })
  } catch (error) {
    console.error("Daily checkin POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
