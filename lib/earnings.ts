import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Credit creator earnings (USD-equivalent from gift coin spend).
 * Coin → earning rate: 100 coins ≈ $1.00 (1 coin = $0.01)
 */
export function coinsToEarnings(coins: number) {
  return Math.round(Math.max(0, coins) * 0.01 * 100) / 100
}

export async function awardEarnings(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  meta?: {
    source?: string
    reference_id?: string
    description?: string
  },
) {
  if (!userId || !amount || amount <= 0) return null

  // Credit profiles.total_earnings/available_earnings exactly once: prefer the
  // atomic RPC (safe under concurrent gifts), and only fall back to a direct
  // read-then-write if the RPC itself is unavailable/erroring. Never run both —
  // that used to double-credit every gift.
  let credited = false
  try {
    const { error: rpcError } = await supabase.rpc("add_user_earnings", {
      user_id: userId,
      amount,
    })
    if (!rpcError) {
      credited = true
    } else {
      const { error: altRpcError } = await supabase.rpc("add_user_earnings", {
        p_user_id: userId,
        amount,
      })
      credited = !altRpcError
    }
  } catch {
    credited = false
  }

  let nextAvailable: number | null = null
  let nextTotal: number | null = null

  if (!credited) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("available_earnings, total_earnings")
      .eq("id", userId)
      .maybeSingle()

    nextAvailable = Number(profile?.available_earnings || 0) + amount
    nextTotal = Number(profile?.total_earnings || 0) + amount

    const { error } = await supabase
      .from("profiles")
      .update({
        available_earnings: nextAvailable,
        total_earnings: nextTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (error) {
      console.error("awardEarnings failed:", error.message)
      return null
    }
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("available_earnings, total_earnings")
      .eq("id", userId)
      .maybeSingle()
    nextAvailable = Number(profile?.available_earnings || 0)
    nextTotal = Number(profile?.total_earnings || 0)
  }

  try {
    await supabase.from("earnings").insert({
      user_id: userId,
      amount,
      source_type: meta?.source || "gift",
      source_id: meta?.reference_id || null,
      currency: "usd",
      status: "available",
      processed_at: new Date().toISOString(),
    })
  } catch {
    /* earnings ledger insert is best-effort; profile totals above are the source of truth */
  }

  return { available_earnings: nextAvailable, total_earnings: nextTotal, amount }
}
