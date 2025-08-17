
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")
    const type = searchParams.get("type") || "all" // all, loops, users, hashtags, circles
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const timeframe = searchParams.get("timeframe") || "all" // 1h, 24h, 7d, 30d, all
    const category = searchParams.get("category")

    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const results: any = {
      loops: [],
      users: [],
      hashtags: [],
      circles: [],
      total: 0
    }

    // Log search analytics
    if (user) {
      await supabase
        .from('search_analytics')
        .insert({
          user_id: user.id,
          query: query.toLowerCase(),
          search_type: type,
          filters: {
            timeframe,
            category,
            limit,
            offset
          }
        })
    }

    // Time filter for loops
    let timeFilter = null
    if (timeframe !== 'all') {
      const timeMap = {
        '1h': 1,
        '24h': 24,
        '7d': 24 * 7,
        '30d': 24 * 30
      }
      const hoursAgo = timeMap[timeframe as keyof typeof timeMap]
      if (hoursAgo) {
        timeFilter = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
      }
    }

    // Search loops
    if (type === "all" || type === "loops") {
      let loopsQuery = supabase
        .from('loops')
        .select(`
          *,
          author:profiles!author_id(
            id,
            username,
            display_name,
            avatar_url,
            is_verified,
            is_premium
          ),
          loop_stats(
            likes_count,
            comments_count,
            branches_count,
            shares_count,
            views_count
          )
        `)
        .textSearch('content_text', query.split(' ').join(' | '))
        .eq('is_public', true)

      if (timeFilter) {
        loopsQuery = loopsQuery.gte('created_at', timeFilter)
      }

      if (category) {
        loopsQuery = loopsQuery.eq('category', category)
      }

      const { data: loops } = await loopsQuery
        .order('trending_score', { ascending: false })
        .range(offset, offset + limit - 1)

      results.loops = loops || []
    }

    // Search users
    if (type === "all" || type === "users") {
      const { data: users } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          display_name,
          avatar_url,
          bio,
          is_verified,
          is_premium,
          followers_count,
          following_count
        `)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,bio.ilike.%${query}%`)
        .order('followers_count', { ascending: false })
        .range(offset, offset + Math.floor(limit / 2) - 1)

      results.users = users || []
    }

    // Search hashtags
    if (type === "all" || type === "hashtags") {
      const { data: hashtags } = await supabase
        .from('hashtags')
        .select('*')
        .ilike('tag', `%${query}%`)
        .order('usage_count', { ascending: false })
        .range(offset, offset + Math.floor(limit / 4) - 1)

      results.hashtags = hashtags || []
    }

    // Search circles
    if (type === "all" || type === "circles") {
      const { data: circles } = await supabase
        .from('circles')
        .select(`
          *,
          owner:profiles!owner_id(
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .eq('is_public', true)
        .order('member_count', { ascending: false })
        .range(offset, offset + Math.floor(limit / 4) - 1)

      results.circles = circles || []
    }

    results.total = results.loops.length + results.users.length + results.hashtags.length + results.circles.length

    return NextResponse.json({
      success: true,
      query,
      type,
      results,
      pagination: {
        limit,
        offset,
        total: results.total
      }
    })

  } catch (error: any) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
