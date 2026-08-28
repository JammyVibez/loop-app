import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Verify admin
    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "30d"

    // Calculate date range
    const now = new Date()
    let startDate: Date
    if (period === "7d") startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    else if (period === "30d") startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    else if (period === "90d") startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    else startDate = new Date(0)

    const startDateStr = startDate.toISOString()
    const prevStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()))
    const prevStartDateStr = prevStartDate.toISOString()

    // Parallel queries
    const [
      coinPurchases,
      gifts,
      withdrawals,
      pendingWithdrawals,
      prevCoinPurchases,
      prevGifts,
    ] = await Promise.all([
      supabase.from("coin_transactions").select("amount, created_at").gte("created_at", startDateStr),
      supabase.from("gifts").select("cost, created_at").in("status", ["sent", "delivered", "claimed"]).gte("created_at", startDateStr),
      supabase.from("withdrawal_requests").select("coins_amount, estimated_usd, created_at").eq("status", "completed").gte("created_at", startDateStr),
      supabase.from("withdrawal_requests").select("id").eq("status", "pending"),
      supabase.from("coin_transactions").select("amount").gte("created_at", prevStartDateStr).lt("created_at", startDateStr),
      supabase.from("gifts").select("cost").in("status", ["sent", "delivered", "claimed"]).gte("created_at", prevStartDateStr).lt("created_at", startDateStr),
    ])

    const totalCoinsSold = (coinPurchases.data || []).reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount || 0)), 0)
    const totalGiftsValue = (gifts.data || []).reduce((sum: number, g: any) => sum + Number(g.cost || 0), 0)
    const totalWithdrawals = (withdrawals.data || []).reduce((sum: number, w: any) => sum + Number(w.estimated_usd || 0), 0)

    const prevCoins = (prevCoinPurchases.data || []).reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount || 0)), 0)
    const prevGifts = (prevGifts.data || []).reduce((sum: number, g: any) => sum + Number(g.cost || 0), 0)
    const prevTotal = prevCoins + prevGifts

    const currentTotal = totalCoinsSold + totalGiftsValue
    const changePercent = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0

    // Daily revenue for chart
    const allTransactions = [
      ...(coinPurchases.data || []).map((t: any) => ({ date: t.created_at, amount: Math.abs(Number(t.amount || 0)) })),
      ...(gifts.data || []).map((g: any) => ({ date: g.created_at, amount: Number(g.cost || 0) })),
    ]

    const dailyMap: Record<string, number> = {}
    for (const t of allTransactions) {
      const day = t.date.split("T")[0]
      dailyMap[day] = (dailyMap[day] || 0) + t.amount
    }

    const dailyRevenue = Object.entries(dailyMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      total_revenue_usd: currentTotal,
      revenue_change_percent: Math.round(changePercent * 10) / 10,
      total_coins_sold: totalCoinsSold,
      total_gifts_value: totalGiftsValue,
      total_withdrawals: totalWithdrawals,
      pending_withdrawals: (pendingWithdrawals.data || []).length,
      daily_revenue: dailyRevenue,
      top_revenue_sources: [
        { name: "Coin Purchases", amount: totalCoinsSold, count: (coinPurchases.data || []).length },
        { name: "Gift Revenue", amount: totalGiftsValue, count: (gifts.data || []).length },
        { name: "Withdrawals", amount: totalWithdrawals, count: (withdrawals.data || []).length },
      ],
      recent_transactions: [],
    })
  } catch (error) {
    console.error("Admin revenue API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
