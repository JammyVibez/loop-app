import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizeLoops } from "@/lib/normalize-loop"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")

  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

function engagementScore(loop: any) {
  const stats = Array.isArray(loop.loop_stats) ? loop.loop_stats[0] : loop.loop_stats
  return (
    Number(stats?.likes_count || 0) * 3 +
    Number(stats?.comments_count || 0) * 4 +
    Number(stats?.branches_count || 0) * 5 +
    Number(stats?.shares_count || 0) * 4 +
    Number(stats?.views_count || 0)
  )
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const type = searchParams.get("type") || "recent"
    const supabase = createServerClient()

    let authorIds: string[] | null = null
    if (type === "personalized" || type === "following") {
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
      const followingIds = (followingData || []).map((follow) => follow.following_id).filter(Boolean)
      authorIds = type === "personalized" ? [...followingIds, user.id] : followingIds

      if (authorIds.length === 0) {
        return NextResponse.json({ success: true, loops: [], hasMore: false, type })
      }
    }

    let rangeEnd = offset + limit - 1
    if (type === "trending") rangeEnd = Math.max(limit * 4, 60)

    let query = supabase
      .from("loops")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .is("parent_loop_id", null)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .range(type === "trending" ? 0 : offset, rangeEnd)

    if (authorIds) query = query.in("author_id", authorIds)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let loops = data || []
    if (type === "trending") {
      loops = loops.sort((a, b) => engagementScore(b) - engagementScore(a)).slice(offset, offset + limit)
    }

    const interactionMap = new Map<string, string[]>()
    if (loops.length > 0) {
      const { data: interactions } = await supabase
        .from("loop_interactions")
        .select("loop_id, interaction_type")
        .eq("user_id", user.id)
        .in("loop_id", loops.map((loop) => loop.id))

      interactions?.forEach((interaction) => {
        if (!interactionMap.has(interaction.loop_id)) interactionMap.set(interaction.loop_id, [])
        interactionMap.get(interaction.loop_id)?.push(interaction.interaction_type)
      })
    }

    const normalizedLoops = normalizeLoops(loops, interactionMap)

    return NextResponse.json({
      success: true,
      loops: normalizedLoops,
      hasMore: normalizedLoops.length === limit,
      type,
      pagination: { limit, offset, total: normalizedLoops.length },
    })
  } catch (error: any) {
    console.error("Error fetching feed:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
