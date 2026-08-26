import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoops } from "@/lib/normalize-loop"
import { enrichLoopsWithPollsAndDuels } from "@/lib/enrich-loops"
import { filterPrivateContent, getFollowingIds, getPrivateProfileIds } from "@/lib/privacy"
import { applyRealCommentCounts, applyRealBranchCounts } from "@/lib/loop-stats" 

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
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "hashtags"
    const sort = searchParams.get("sort") || "recent"
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "20", 10) || 20, 50)
    const daysBack = Math.min(Math.max(Number.parseInt(searchParams.get("days") || "7", 10) || 7, 1), 30)
    const user = await getUserFromRequest(request)

    switch (type) {
      case "hashtags": {
        const { data: hashtags, error: hashtagError } = await supabase.rpc("get_trending_hashtags", {
          days_back: daysBack,
          result_limit: limit,
        })

        if (hashtagError) {
          const { data: loops } = await supabase
            .from("loops")
            .select("hashtags")
            .not("hashtags", "is", null)
            .order("created_at", { ascending: false })
            .limit(120)

          const counts = new Map<string, number>()
          for (const loop of loops || []) {
            for (const tag of loop.hashtags || []) {
              const key = String(tag).toLowerCase().replace(/^#/, "")
              if (!key) continue
              counts.set(key, (counts.get(key) || 0) + 1)
            }
          }

          const derived = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([tag, usage_count]) => ({ tag, usage_count, count: usage_count, growth: "live" }))

          return NextResponse.json({ success: true, data: derived, hashtags: derived })
        }

        const normalized = (hashtags || []).map((row: any) => ({
          tag: row.tag || row.hashtag,
          usage_count: Number(row.usage_count ?? row.count ?? 0),
          count: Number(row.usage_count ?? row.count ?? 0),
          growth: row.growth ?? "hot",
        }))
        return NextResponse.json({ success: true, data: normalized, hashtags: normalized })
      }

      case "users": {
        const { data: users, error: usersError } = await supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, bio, followers_count, loops_count, created_at",
          )
          .order("followers_count", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(limit)

        if (usersError) {
          return NextResponse.json({ error: "Failed to fetch trending users" }, { status: 500 })
        }

        // Private profiles never rank in trending users unless the viewer
        // already follows them.
        const following = await getFollowingIds(supabase, user?.id || null)
        const privateIds = await getPrivateProfileIds(supabase, (users || []).map((u: any) => u.id))
        let visible = users || []
        if (privateIds.size) {
          visible = visible.filter((u: any) => {
            if (user && u.id === user.id) return true
            if (following.has(u.id)) return true
            return !privateIds.has(u.id)
          })
        }

        return NextResponse.json({ success: true, data: visible })
      }

      case "discovery": {
        // Participation discovery — answers "what can I participate in right
        // now?": active duels, open co-loops, growing circles, rising creators.
        const nowIso = new Date().toISOString()

        const [duelsRes, coLoopsRes, circlesRes, creatorsRes] = await Promise.all([
          supabase
            .from("loop_duels")
            .select(`
              id, prompt, status, expires_at, stake_coins, loop_id, created_at,
              creator:profiles!creator_id(id, username, display_name, avatar_url, video_avatar_url),
              entries:loop_duel_entries(id, side, title, content, votes_count)
            `)
            .eq("status", "active")
            .gt("expires_at", nowIso)
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("loops")
            .select(`
              id, content_text, content, created_at, author_id, is_co_loop, content_metadata,
              author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url),
              loop_stats(likes_count, comments_count)
            `)
            .eq("visibility", "public")
            .not("content_metadata->co_authors", "is", null)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("circles")
            .select("id, name, description, avatar_url, video_avatar_url, category, is_premium_only, is_private, member_count:circle_members(count)")
            .limit(60),
          supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, bio, followers_count, created_at")
            .order("followers_count", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(30),
        ])

        // 1) Active duels ranked by current vote totals with live splits
        const duelRows = duelsRes.data || []
        const duels = duelRows
          .map((duel: any) => {
            const entries = Array.isArray(duel.entries) ? duel.entries : []
            const votesA = Number(entries.find((e: any) => e.side === "A")?.votes_count || 0)
            const votesB = Number(entries.find((e: any) => e.side === "B")?.votes_count || 0)
            const total = votesA + votesB
            return {
              id: duel.id,
              loop_id: duel.loop_id,
              prompt: duel.prompt,
              expires_at: duel.expires_at,
              stake_coins: duel.stake_coins,
              creator: Array.isArray(duel.creator) ? duel.creator[0] : duel.creator,
              entries,
              votes_a: votesA,
              votes_b: votesB,
              total_votes: total,
              percent_a: total > 0 ? Math.round((votesA / total) * 100) : 50,
              percent_b: total > 0 ? Math.round((votesB / total) * 100) : 50,
            }
          })
          .sort((a: any, b: any) => b.total_votes - a.total_votes)
          .slice(0, 4)

        // 2) Open co-loops — recent collaborative posts
        let coLoopRows = coLoopsRes.data || []
        if (!coLoopRows.length) {
          const { data: fallback } = await supabase
            .from("loops")
            .select(`
              id, content_text, content, created_at, author_id, is_co_loop, content_metadata,
              author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url),
              loop_stats(likes_count, comments_count)
            `)
            .eq("visibility", "public")
            .order("created_at", { ascending: false })
            .limit(60)
          coLoopRows = (fallback || []).filter((l: any) => {
            const meta = l.content_metadata
            return l.is_co_loop || (Array.isArray(meta?.co_authors) && meta.co_authors.length > 0)
          })
        }
        const coLoops = coLoopRows.slice(0, 4).map((loop: any) => {
          const meta = loop.content_metadata
          const coAuthors = Array.isArray(meta?.co_authors) ? meta.co_authors : []
          const stats = Array.isArray(loop.loop_stats) ? loop.loop_stats[0] : loop.loop_stats
          return {
            id: loop.id,
            content: String(loop.content_text || loop.content || "").slice(0, 140),
            created_at: loop.created_at,
            author: Array.isArray(loop.author) ? loop.author[0] : loop.author,
            co_author_count: coAuthors.length + 1,
            likes_count: Number(stats?.likes_count || 0),
            comments_count: Number(stats?.comments_count || 0),
          }
        })

        // 3) Growing circles by real member count (non-premium-only visible to everyone)
        const circleRows = circlesRes.data || []
        const circles = circleRows
          .filter((c: any) => !c.is_premium_only)
          .map((c: any) => ({
            ...c,
            member_count: Number(
              Array.isArray(c.member_count) ? c.member_count[0]?.count || 0 : c.member_count || 0,
            ),
          }))
          .sort((a: any, b: any) => b.member_count - a.member_count)
          .slice(0, 4)

        // 4) Rising creators (private profiles filtered out)
        const following = await getFollowingIds(supabase, user?.id || null)
        const privateIds = await getPrivateProfileIds(supabase, (creatorsRes.data || []).map((u: any) => u.id))
        let visibleCreators = creatorsRes.data || []
        if (privateIds.size) {
          visibleCreators = visibleCreators.filter((u: any) => {
            if (user && u.id === user.id) return true
            if (following.has(u.id)) return true
            return !privateIds.has(u.id)
          })
        }
        const creators = visibleCreators.slice(0, 4)

        return NextResponse.json({
          success: true,
          data: { duels, coLoops, circles, creators },
          duels,
          coLoops,
          circles,
          creators,
        })
      }

      case "loops": {
        const fetchLimit = sort === "creative" || sort === "deepest" ? Math.max(limit * 4, 40) : limit
        const { data: loops, error: loopsError } = await supabase
          .from("loops")
          .select(`
            *,
            author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, active_cosmetics, cosmetics, badge_id),
            loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
          `)
          .is("parent_loop_id", null)
          .eq("visibility", "public")
          .order("created_at", { ascending: false })
          .limit(fetchLimit)

        if (loopsError) {
          console.error("Error fetching explore loops:", loopsError)
          return NextResponse.json({ error: loopsError.message || "Failed to fetch loops" }, { status: 500 })
        }

        let rows = loops || []
        if (sort === "creative") {
          rows = [...rows].sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, limit)
        } else if (sort === "deepest") {
          rows = [...rows]
            .sort((a, b) => {
              const aStats = Array.isArray(a.loop_stats) ? a.loop_stats[0] : a.loop_stats
              const bStats = Array.isArray(b.loop_stats) ? b.loop_stats[0] : b.loop_stats
              const aDepth = Number(a.tree_depth || aStats?.branches_count || 0)
              const bDepth = Number(b.tree_depth || bStats?.branches_count || 0)
              return bDepth - aDepth || engagementScore(b) - engagementScore(a)
            })
            .slice(0, limit)
        } else {
          rows = rows.slice(0, limit)
        }

        const interactionMap = new Map<string, string[]>()
        if (user && rows.length > 0) {
          const { data: interactions } = await supabase
            .from("loop_interactions")
            .select("loop_id, interaction_type")
            .eq("user_id", user.id)
            .in(
              "loop_id",
              rows.map((loop) => loop.id),
            )

          interactions?.forEach((interaction) => {
            if (!interactionMap.has(interaction.loop_id)) interactionMap.set(interaction.loop_id, [])
            interactionMap.get(interaction.loop_id)?.push(interaction.interaction_type)
          })
        }

        const following = await getFollowingIds(supabase, user?.id || null)
        rows = await filterPrivateContent(supabase, rows, user?.id || null, following)
        const enriched = await enrichLoopsWithPollsAndDuels(supabase, rows)
        await applyRealCommentCounts(supabase, enriched)
        await applyRealBranchCounts(supabase, enriched)
        const normalized = normalizeLoops(enriched, interactionMap)
        return NextResponse.json({ success: true, data: normalized, loops: normalized })
      }

      default:
        return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 })
    }
  } catch (error) {
    console.error("Trending API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {

    const supabase = createServerClient()
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { hashtag, loop_id } = body

    if (!hashtag || !loop_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { error } = await supabase.from("hashtag_usage").insert({
      hashtag: String(hashtag).toLowerCase(),
      loop_id,
      user_id: user.id,
    })

    if (error) {
      console.error("Error recording hashtag usage:", error)
      return NextResponse.json({ error: "Failed to record hashtag usage" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Hashtag tracking error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
