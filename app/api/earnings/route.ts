import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

const COUNTED_GIFT_STATUSES = ["sent", "delivered", "claimed"]

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()

    const [
      profileRes,
      giftsAggRes,
      recentGiftsRes,
      topLoopsRes,
      topReelsRes,
      streamsRes,
      boostsRes,
      withdrawalsRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("loop_coins, total_earnings, available_earnings, is_verified")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("gifts")
        .select("cost")
        .eq("recipient_id", user.id)
        .in("status", COUNTED_GIFT_STATUSES),
      supabase
        .from("gifts")
        .select("id, gift_name, cost, sender_id, is_anonymous, created_at, context_type, context_id")
        .eq("recipient_id", user.id)
        .in("status", COUNTED_GIFT_STATUSES)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("loops")
        .select("id, content_title, content_text, content, media_type, like_count, comment_count, view_count, share_count, created_at")
        .eq("author_id", user.id)
        .order("like_count", { ascending: false })
        .limit(5),
      supabase
        .from("reels")
        .select("id, title, like_count, comment_count, view_count, share_count, created_at")
        .eq("author_id", user.id)
        .order("like_count", { ascending: false })
        .limit(5),
      supabase
        .from("live_streams")
        .select("id, title, status, viewer_count, max_viewers, total_earnings, started_at, ended_at")
        .eq("streamer_id", user.id)
        .order("max_viewers", { ascending: false })
        .limit(5),
      supabase.from("loop_boosts").select("coins").eq("user_id", user.id),
      supabase
        .from("withdrawal_requests")
        .select("id, coins_amount, estimated_usd, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ])

    const profile = profileRes.data
    const giftsReceivedCoins = (giftsAggRes.data || []).reduce((sum, g) => sum + Number(g.cost || 0), 0)
    const giftsReceivedCount = (giftsAggRes.data || []).length
    const boostSpendCoins = (boostsRes.data || []).reduce((sum, b) => sum + Number(b.coins || 0), 0)
    const liveTotalEarnings = (streamsRes.data || []).reduce((sum, s) => sum + Number(s.total_earnings || 0), 0)
    const livePeakViewers = (streamsRes.data || []).reduce((max, s) => Math.max(max, Number(s.max_viewers || 0)), 0)

    return NextResponse.json({
      success: true,
      balance: {
        loop_coins: Number(profile?.loop_coins || 0),
        total_earnings: Number(profile?.total_earnings || 0),
        available_earnings: Number(profile?.available_earnings || 0),
        is_verified: Boolean(profile?.is_verified),
      },
      gifts: {
        received_count: giftsReceivedCount,
        received_coins: giftsReceivedCoins,
        recent: recentGiftsRes.data || [],
      },
      top_loops: topLoopsRes.data || [],
      top_reels: topReelsRes.data || [],
      live: {
        streams: streamsRes.data || [],
        peak_viewers: livePeakViewers,
        total_earnings: liveTotalEarnings,
      },
      boosts: {
        total_spend_coins: boostSpendCoins,
        count: (boostsRes.data || []).length,
      },
      withdrawals: withdrawalsRes.data || [],
    })
  } catch (error: any) {
    console.error("GET /api/earnings error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
