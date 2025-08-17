import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getUserFromToken(token: string) {
  try {
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
    const q = searchParams.get("q")
    const type = searchParams.get("type") || "all" // all, users, loops, circles
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    if (!q || q.trim() === "" || q === "*") {
      // Return empty results for wildcard or empty queries instead of error
      return NextResponse.json({
        success: true,
        query: q,
        type,
        results: {
          loops: [],
          users: [],
          hashtags: [],
          circles: []
        },
        hasMore: false,
        total: 0,
      })
    }

    const searchTerm = q.trim()
    const results: any = {
      users: [],
      loops: [],
      circles: [],
      hashtags: [],
    }

    // Search users/profiles
    if (type === "all" || type === "users") {
      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, is_verified, is_premium")
        .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%,bio.ilike.%${searchTerm}%`)
        .limit(type === "users" ? limit : 10)
        .range(type === "users" ? offset : 0, type === "users" ? offset + limit - 1 : 9)

      if (!usersError) {
        results.users = users || []
      }
    }

    // Search loops
    if (type === "all" || type === "loops") {
      const { data: loops, error: loopsError } = await supabase
        .from("loops")
        .select(`
          id,
          content_text,
          content_title,
          content_type,
          content_media_url,
          hashtags,
          created_at,
          author:profiles(id, username, display_name, avatar_url, is_verified),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .eq("visibility", "public")
        .or(`content_text.ilike.%${searchTerm}%,content_title.ilike.%${searchTerm}%`)
        .limit(type === "loops" ? limit : 10)
        .range(type === "loops" ? offset : 0, type === "loops" ? offset + limit - 1 : 9)
        .order("created_at", { ascending: false })

      if (!loopsError) {
        results.loops = loops || []
      }
    }

    // Search circles
    if (type === "all" || type === "circles") {
      const { data: circles, error: circlesError } = await supabase
        .from("circles")
        .select("id, name, description, avatar_url, is_private, member_count, owner_id")
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .eq("is_private", false) // Only show public circles in search
        .limit(type === "circles" ? limit : 10)
        .range(type === "circles" ? offset : 0, type === "circles" ? offset + limit - 1 : 9)

      if (!circlesError) {
        results.circles = circles || []
      }
    }

    // Search hashtags
    if (type === "all" || type === "hashtags") {
      const { data: hashtagLoops, error: hashtagError } = await supabase
        .from("loops")
        .select("hashtags")
        .not("hashtags", "is", null)
        .eq("visibility", "public")

      if (!hashtagError && hashtagLoops) {
        const hashtagCounts: { [key: string]: number } = {}

        hashtagLoops.forEach(loop => {
          if (loop.hashtags) {
            loop.hashtags.forEach((hashtag: string) => {
              if (hashtag.toLowerCase().includes(searchTerm.toLowerCase())) {
                hashtagCounts[hashtag] = (hashtagCounts[hashtag] || 0) + 1
              }
            })
          }
        })

        results.hashtags = Object.entries(hashtagCounts)
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, type === "hashtags" ? limit : 5)
      }
    }

    // Calculate total results for pagination
    const totalResults = results.users.length + results.loops.length + results.circles.length + results.hashtags.length
    const hasMore = type !== "all" && totalResults === limit

    return NextResponse.json({
      success: true,
      query: searchTerm,
      type,
      results,
      hasMore,
      total: totalResults,
    })
  } catch (error) {
    console.error("Error performing search:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST endpoint for saving search history (optional feature)
export async function POST(request: NextRequest) {
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

    const { query, type } = await request.json()

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: "Invalid search query" }, { status: 400 })
    }

    // Here you could implement search history storage
    // For now, just return success
    return NextResponse.json({
      success: true,
      message: "Search recorded",
    })
  } catch (error) {
    console.error("Error recording search:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}