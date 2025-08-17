import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
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
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const type = searchParams.get("type") || "recent"

    let loops: any[] = []

    if (type === "personalized" || type === "following") {
      // Get user's following list
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)

      const followingIds = followingData?.length ? followingData.map(f => f.following_id) : []

      // For personalized feed, include user's own posts
      const authorIds = type === "personalized" ? [...followingIds, user.id] : followingIds

      if (authorIds.length > 0) {
        const { data, error } = await supabase
          .from("loops")
          .select(`
            *,
            author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
            loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
          `)
          .in("author_id", authorIds)
          .is("parent_loop_id", null)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1)

        if (!error) loops = data || []
      }
    } else if (type === "recent") {
      const { data, error } = await supabase
        .from("loops")
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .is("parent_loop_id", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (!error) loops = data || []
    }

    // Add user interactions
    if (loops.length > 0) {
      const loopIds = loops.map(loop => loop.id)
      const { data: interactions } = await supabase
        .from("loop_interactions")
        .select("loop_id, interaction_type")
        .eq("user_id", user.id)
        .in("loop_id", loopIds)

      const interactionMap = new Map()
      interactions?.forEach(interaction => {
        if (!interactionMap.has(interaction.loop_id)) {
          interactionMap.set(interaction.loop_id, [])
        }
        interactionMap.get(interaction.loop_id).push(interaction.interaction_type)
      })

      loops = loops.map(loop => ({
        ...loop,
        stats: loop.loop_stats?.[0] || {
          likes_count: 0,
          comments_count: 0,
          branches_count: 0,
          shares_count: 0,
          views_count: 0
        },
        user_interactions: {
          is_liked: interactionMap.get(loop.id)?.includes("like") || false,
          is_saved: interactionMap.get(loop.id)?.includes("save") || false,
          has_viewed: interactionMap.get(loop.id)?.includes("view") || false,
        },
      }))
    }

    return NextResponse.json({
      success: true,
      loops,
      hasMore: loops.length === limit,
      type,
      pagination: {
        limit,
        offset,
        total: loops.length,
      },
    })
  } catch (error: any) {
    console.error("Error fetching feed:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 },
    )
  }
}