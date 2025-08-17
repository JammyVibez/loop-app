import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, createClient } from "@/lib/supabase" // Assuming createClient is available here

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    // Create a new supabase client instance for this request
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser(token)
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
    const type = searchParams.get("type") || "following"

    const supabase = createServerClient()

    let loops: any[] = []

    if (type === "personalized") {
      // For personalized feed, show both user's own loops and following
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)

      const followingIds = followingData?.length ? followingData.map(f => f.following_id) : []
      // Include user's own ID in the list
      const authorIds = [...followingIds, user.id]

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
    } else if (type === "following") {
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)

      if (followingData?.length) {
        const followingIds = followingData.map(f => f.following_id)

        const { data, error } = await supabase
          .from("loops")
          .select(`
            *,
            author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
            loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
          `)
          .in("author_id", followingIds)
          .is("parent_loop_id", null)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1)

        if (!error) loops = data || []
      }
    } else if (type === "trending") {
      const { data, error } = await supabase.rpc("get_trending_loops", {
        time_period: "24h",
        trend_limit: limit,
        trend_offset: offset,
      })
      if (!error) loops = data || []
    } else if (type === "recent") {
      const { data, error } = await supabase
        .from("loops")
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        // remove this line if you don’t add a visibility column:
        // .eq("visibility", "public")
        .is("parent_loop_id", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (!error) loops = data || []
    }

    // Map user interactions
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
        stats: loop.loop_stats || {}, // ✅ rename for frontend
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
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 },
    )
  }
}