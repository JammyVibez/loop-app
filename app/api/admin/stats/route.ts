
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response
    const supabase = createServerClient()

    // Fetch comprehensive statistics
    const today = new Date().toISOString().split('T')[0]
    const thisMonth = new Date().toISOString().slice(0, 7)

    // Total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // Active users today
    const { count: activeUsersToday } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_active', today)

    // Premium users
    const { count: premiumUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_premium', true)

    // Total loops
    const { count: totalLoops } = await supabase
      .from('loops')
      .select('*', { count: 'exact', head: true })

    // Total coins distributed (from transactions)
    const { data: coinsData } = await supabase
      .from('coin_transactions')
      .select('amount')
      .in('transaction_type', ['weekly_bonus', 'quest_reward', 'admin_grant'])

    const totalCoinsDistributed = coinsData?.reduce((sum, tx) => sum + tx.amount, 0) || 0

    // Weekly bonus claimed this week
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    
    const { count: weeklyBonusClaimed } = await supabase
      .from('weekly_bonus_claims')
      .select('*', { count: 'exact', head: true })
      .gte('claimed_at', weekStart.toISOString())

    // Gifts sent today
    const { count: giftsSentToday } = await supabase
      .from('gifts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today)

    // Revenue this month (from shop purchases)
    const { data: revenueData } = await supabase
      .from('shop_items')
      .select('price_usd, purchase_count')
      .not('price_usd', 'is', null)

    const revenueThisMonth = revenueData?.reduce((sum, item) => 
      sum + (item.price_usd * item.purchase_count), 0) || 0

    const stats = {
      total_users: totalUsers || 0,
      active_users_today: activeUsersToday || 0,
      total_loops: totalLoops || 0,
      total_coins_distributed: totalCoinsDistributed,
      premium_users: premiumUsers || 0,
      weekly_bonus_claimed: weeklyBonusClaimed || 0,
      gifts_sent_today: giftsSentToday || 0,
      revenue_this_month: revenueThisMonth
    }

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error("Admin stats error:", error)
    return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 })
  }
}
