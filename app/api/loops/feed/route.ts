import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizeLoops } from "@/lib/normalize-loop"
import {
  followingBoost,
  hashtagAffinityBonus,
  smartEngagementScore,
} from "@/lib/feed-ranking"

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

async function buildHashtagAffinity(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const affinity = new Map<string, number>()
  const { data: likes } = await supabase
    .from("loop_interactions")
    .select("loop_id")
    .eq("user_id", userId)
    .eq("interaction_type", "like")
    .order("created_at", { ascending: false })
    .limit(40)

  const loopIds = (likes || []).map((l) => l.loop_id).filter(Boolean)
  if (!loopIds.length) return affinity

  const { data: loops } = await supabase.from("loops").select("hashtags").in("id", loopIds)
  for (const loop of loops || []) {
    for (const raw of loop.hashtags || []) {
      const tag = String(raw).toLowerCase().replace(/^#/, "")
      if (!tag) continue
      affinity.set(tag, (affinity.get(tag) || 0) + 1)
    }
  }
  return affinity
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

    const { data: followingData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
    const followingIds = new Set(
      (followingData || []).map((f) => f.following_id).filter(Boolean) as string[],
    )

    let authorIds: string[] | null = null
    let mode = type
    let useSmartRank = type === "personalized" || type === "trending"

    if (type === "following") {
      authorIds = Array.from(followingIds)
      if (authorIds.length === 0) {
        return NextResponse.json({ success: true, loops: [], hasMore: false, type })
      }
    } else if (type === "personalized") {
      // Smart For You: pull a wider candidate pool, rank by engagement + affinity + following
      authorIds = null
      useSmartRank = true
      mode = followingIds.size === 0 ? "personalized_cold_start" : "personalized"
    }

    const fetchLimit = useSmartRank ? Math.max(limit * 5, 80) : offset + limit

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
      .range(0, fetchLimit - 1)

    if (type === "following" && authorIds) {
      query = query.in("author_id", authorIds)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let loops = data || []
    const affinity =
      type === "personalized" ? await buildHashtagAffinity(supabase, user.id) : new Map<string, number>()

    if (useSmartRank) {
      loops = [...loops]
        .map((loop) => ({
          loop,
          score:
            smartEngagementScore(loop) +
            hashtagAffinityBonus(loop, affinity) +
            followingBoost(loop, followingIds) +
            // Slight boost for own posts so creators see them
            (loop.author_id === user.id ? 6 : 0),
        }))
        .sort((a, b) => b.score - a.score)
        .map((row) => ({ ...row.loop, _rank_score: row.score }))

      // Light author diversity: avoid 4+ consecutive from same author
      const diversified: typeof loops = []
      const recentAuthors: string[] = []
      for (const loop of loops) {
        const author = loop.author_id
        const streak = recentAuthors.filter((id) => id === author).length
        if (streak >= 2 && diversified.length < limit * 3) {
          // defer — push later if needed
          continue
        }
        diversified.push(loop)
        recentAuthors.push(author)
        if (recentAuthors.length > 3) recentAuthors.shift()
        if (diversified.length >= offset + limit + 10) break
      }
      // Fill gaps from remaining ranked list
      if (diversified.length < offset + limit) {
        for (const loop of loops) {
          if (diversified.some((d) => d.id === loop.id)) continue
          diversified.push(loop)
          if (diversified.length >= offset + limit) break
        }
      }
      loops = diversified.slice(offset, offset + limit)
    } else if (type === "recent" || type === "following") {
      loops = loops.slice(offset, offset + limit)
    }

    const interactionMap = new Map<string, string[]>()
    if (loops.length > 0) {
      const { data: interactions } = await supabase
        .from("loop_interactions")
        .select("loop_id, interaction_type")
        .eq("user_id", user.id)
        .in(
          "loop_id",
          loops.map((loop) => loop.id),
        )

      interactions?.forEach((interaction) => {
        if (!interactionMap.has(interaction.loop_id)) interactionMap.set(interaction.loop_id, [])
        interactionMap.get(interaction.loop_id)?.push(interaction.interaction_type)
      })
    }

    const normalizedLoops = normalizeLoops(loops, interactionMap).map((loop, i) => ({
      ...loop,
      engagement_score: Number((loops[i] as any)?._rank_score ?? smartEngagementScore(loops[i] || loop)),
    }))

    return NextResponse.json({
      success: true,
      loops: normalizedLoops,
      hasMore: normalizedLoops.length === limit,
      type: mode,
      algorithm: useSmartRank ? "smart_rank_v1" : "chronological",
      pagination: { limit, offset, total: normalizedLoops.length },
    })
  } catch (error: any) {
    console.error("Error fetching feed:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
