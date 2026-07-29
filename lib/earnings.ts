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

  try {
    const { error: rpcError } = await supabase.rpc("add_user_earnings", {
      user_id: userId,
      amount,
    })
    if (rpcError) {
      await supabase.rpc("add_user_earnings", {
        p_user_id: userId,
        amount,
      })
    }
  } catch {
    /* fall through to direct update */
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("available_earnings, total_earnings")
    .eq("id", userId)
    .maybeSingle()

  const nextAvailable = Number(profile?.available_earnings || 0) + amount
  const nextTotal = Number(profile?.total_earnings || 0) + amount

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

  try {
    await supabase.from("earnings").insert({
      user_id: userId,
      amount,
      source: meta?.source || "gift",
      reference_id: meta?.reference_id || null,
      description: meta?.description || "Gift earnings",
      status: "available",
    })
  } catch {
    /* earnings table optional */
  }

  return { available_earnings: nextAvailable, total_earnings: nextTotal, amount }
}
