import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { calculateBoostInfo } from "@/lib/boost"
import { normalizeLoops } from "@/lib/normalize-loop"
import { applyRealCommentCounts } from "@/lib/loop-stats"

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get("limit")) || 10

    const { data: rawLoops, error } = await supabase
      .from("loops")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, level, badge_id),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .gt("boost_coins_current", 0)
      .eq("visibility", "public")
      .is("parent_loop_id", null)
      .order("boost_coins_current", { ascending: false })
      .limit(30)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const now = Date.now()
    const activeBoostedLoops = (rawLoops || [])
      .map((loop) => {
        const boostInfo = calculateBoostInfo(loop, now)
        return { loop, boostInfo }
      })
      .filter(({ boostInfo }) => boostInfo.isBoosted)
      .sort((a, b) => {
        // Tier 3 first, then by coin count
        if (b.boostInfo.tier !== a.boostInfo.tier) {
          return b.boostInfo.tier - a.boostInfo.tier
        }
        return b.boostInfo.coins - a.boostInfo.coins
      })
      .slice(0, limit)

    await applyRealCommentCounts(
      supabase,
      activeBoostedLoops.map((item) => item.loop),
    )
    const normalized = normalizeLoops(activeBoostedLoops.map((item) => item.loop))

    // Attach boostInfo to normalized items
    const result = normalized.map((item) => {
      const match = activeBoostedLoops.find((b) => b.loop.id === item.id)
      return {
        ...item,
        boostInfo: match?.boostInfo || calculateBoostInfo(item, now),
      }
    })

    return NextResponse.json({
      success: true,
      loops: result,
      count: result.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
