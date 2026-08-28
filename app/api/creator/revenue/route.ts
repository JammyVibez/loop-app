import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const COUNTED_GIFT_STATUSES = ["sent", "delivered", "claimed"]

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const range = searchParams.get("range") || "30d"

    // Calculate date range
    const now = new Date()
    let startDate: Date
    if (range === "7d") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (range === "30d") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else {
      startDate = new Date(0) // All time
    }

    const startDateStr = startDate.toISOString()

    // Parallel queries for revenue data
    const [
      profileRes,
      giftsRes,
      boostsRes,
      streamsRes,
      tipsRes,
      topLoopsRes,
      withdrawalsRes,
    ] = await Promise.all([
      // Profile balance
      supabase
        .from("profiles")
        .select("loop_coins, total_earnings, available_earnings, is_verified")
        .eq("id", user.id)
        .maybeSingle(),

      // Gifts received (in range)
      supabase
        .from("gifts")
        .select("cost")
        .eq("recipient_id", user.id)
        .in("status", COUNTED_GIFT_STATUSES)
        .gte("created_at", startDateStr),

      // Boosts purchased
      supabase
        .from("loop_boosts")
        .select("coins")
        .eq("user_id", user.id)
        .gte("created_at", startDateStr),

      // Live stream earnings
      supabase
        .from("live_streams")
        .select("total_earnings, viewer_count, started_at")
        .eq("streamer_id", user.id)
        .gte("started_at", startDateStr),

      // Tips received (stored in gifts with context_type = "tip")
      supabase
        .from("gifts")
        .select("cost")
        .eq("recipient_id", user.id)
        .eq("context_type", "tip")
        .in("status", COUNTED_GIFT_STATUSES)
        .gte("created_at", startDateStr),

      // Top earning loops
      supabase
        .from("loops")
        .select("id, content_title, content_text, media_type, like_count, view_count, comment_count, share_count, created_at")
        .eq("author_id", user.id)
        .order("like_count", { ascending: false })
        .limit(5),

      // Pending withdrawals
      supabase
        .from("withdrawal_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending"),
    ])

    const profile = profileRes.data
    const giftsReceived = (giftsRes.data || []).reduce((sum: number, g: any) => sum + Number(g.cost || 0), 0)
    const tipsReceived = (tipsRes.data || []).reduce((sum: number, t: any) => sum + Number(t.cost || 0), 0)
    const liveEarnings = (streamsRes.data || []).reduce((sum: number, s: any) => sum + Number(s.total_earnings || 0), 0)
    const boostsSpent = (boostsRes.data || []).reduce((sum: number, b: any) => sum + Number(b.coins || 0), 0)

    // Calculate monthly trend (last 6 months)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)

      // Gifts in this month
      const { data: monthGifts } = await supabase
        .from("gifts")
        .select("cost")
        .eq("recipient_id", user.id)
        .in("status", COUNTED_GIFT_STATUSES)
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())

      const monthEarnings = (monthGifts || []).reduce((sum: number, g: any) => sum + Number(g.cost || 0), 0)

      monthlyTrend.push({
        month: monthStart.toLocaleDateString("en-US", { month: "short" }),
        earnings: monthEarnings,
        gifts: (monthGifts || []).length,
        engagement: monthEarnings * 10, // Rough engagement estimate
      })
    }

    // Calculate content engagement rate
    const topContent = (topLoopsRes.data || []).map((loop: any) => {
      const views = Number(loop.view_count || 0)
      const likes = Number(loop.like_count || 0)
      const comments = Number(loop.comment_count || 0)
      const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0

      return {
        id: loop.id,
        title: loop.content_title || loop.content_text?.slice(0, 50) || "Untitled",
        type: loop.media_type || "text",
        earnings: Math.floor(likes * 2 + comments * 3 + views * 0.1), // Simulated earnings
        views,
        engagement_rate: engagementRate,
      }
    })

    // Revenue breakdown
    const creatorFund = Math.floor(giftsReceived * 0.1) // 10% creator fund cut
    const subscriptions = 0 // Would come from subscription table

    return NextResponse.json({
      balance: {
        loop_coins: Number(profile?.loop_coins || 0),
        total_earnings: Number(profile?.total_earnings || 0),
        available_earnings: Number(profile?.available_earnings || 0),
        is_verified: Boolean(profile?.is_verified),
      },
      revenue_breakdown: {
        gifts: giftsReceived,
        tips: tipsReceived,
        creator_fund: creatorFund,
        boosts: boostsSpent,
        live_streams: liveEarnings,
        subscriptions,
      },
      monthly_trend: monthlyTrend,
      top_earning_content: topContent,
      pending_withdrawals: (withdrawalsRes.data || []).length,
      next_payout_date: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    })
  } catch (error) {
    console.error("Creator revenue API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
