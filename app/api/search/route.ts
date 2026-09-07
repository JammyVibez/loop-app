import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoops } from "@/lib/normalize-loop"
import { enrichLoopsWithPollsAndDuels } from "@/lib/enrich-loops"
import { applyRealCommentCounts } from "@/lib/loop-stats"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"


function escapeIlike(value: string) {
  return value.replace(/[%_,]/g, " ").trim()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = (searchParams.get("q") || searchParams.get("query") || "").trim()
    const type = searchParams.get("type") || "all"
    const limit = Math.min(40, Number.parseInt(searchParams.get("limit") || "20") || 20)
    const offset = Number.parseInt(searchParams.get("offset") || "0") || 0

    if (!rawQuery || rawQuery.length < 1) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }

    const user = await getUserFromRequest(request)
    const supabase = createServerClient()

    const query = escapeIlike(rawQuery.replace(/^@/, "").replace(/^#/, ""))
    const isHashtagIntent = rawQuery.startsWith("#")
    const isUserIntent = rawQuery.startsWith("@")

    const results: {
      loops: any[]
      users: any[]
      hashtags: any[]
      circles: any[]
      total: number
    } = { loops: [], users: [], hashtags: [], circles: [], total: 0 }

    // Best-effort analytics
    if (user) {
      try {
        await supabase.from("search_analytics").insert({
          user_id: user.id,
          query: rawQuery.toLowerCase(),
          search_type: type,
        })
      } catch {
        /* optional table */
      }
    }

    const wantLoops = (type === "all" || type === "loops") && !isUserIntent
    const wantUsers = (type === "all" || type === "users") && !isHashtagIntent
    const wantHashtags = (type === "all" || type === "hashtags") && !isUserIntent
    const wantCircles = (type === "all" || type === "circles") && !isUserIntent && !isHashtagIntent

    // Private (and followers-only) profiles never surface in public search for
    // people who don't follow them — neither their loops nor their profile.
    const followingIds = new Set<string>()
    if (user) {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
      for (const row of follows || []) {
        if (row.following_id) followingIds.add(row.following_id)
      }
    }

    const filterPrivateLoops = async (loops: any[]) => {
      if (!loops.length) return loops
      const authorIds = [...new Set(loops.map((l) => l.author_id).filter(Boolean))] as string[]
      if (!authorIds.length) return loops
      const { data: authors } = await supabase
        .from("profiles")
        .select("id, privacy_settings")
        .in("id", authorIds)
      const privateIds = new Set(
        (authors || [])
          .filter((a: any) =>
            ["private", "followers"].includes((a.privacy_settings || {})?.profile_visibility),
          )
          .map((a: any) => a.id),
      )
      if (!privateIds.size) return loops
      return loops.filter((loop) => {
        if (user && loop.author_id === user.id) return true
        if (followingIds.has(loop.author_id)) return true
        return !privateIds.has(loop.author_id)
      })
    }

    if (wantLoops) {
      const pattern = `%${query}%`
      let loops: any[] | null = null

      const primary = await supabase
        .from("loops")
        .select(
          `
          *,
          author:profiles!author_id(
            id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium
          ),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `,
        )
        .is("parent_loop_id", null)
        .eq("visibility", "public")
        .ilike("content", pattern)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (!primary.error) {
        loops = primary.data
      } else {
        const fallback = await supabase
          .from("loops")
          .select(
            `
            *,
            author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id),
            loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
          `,
          )
          .is("parent_loop_id", null)
          .ilike("content", pattern)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1)
        loops = fallback.data
        if (fallback.error) console.error("loops search fallback:", fallback.error.message)
      }

      // Also match content_text when present
      try {
        const textHits = await supabase
          .from("loops")
          .select(
            `
            *,
            author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id),
            loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
          `,
          )
          .is("parent_loop_id", null)
          .eq("visibility", "public")
          .ilike("content_text", pattern)
          .order("created_at", { ascending: false })
          .limit(limit)
        if (!textHits.error && textHits.data?.length) {
          const merged = [...(loops || [])]
          const ids = new Set(merged.map((l) => l.id))
          for (const row of textHits.data) {
            if (!ids.has(row.id)) {
              merged.push(row)
              ids.add(row.id)
            }
          }
          loops = merged
        }
      } catch {
        /* content_text may be missing */
      }

      // Also find loops whose hashtags array contains the query
      if ((isHashtagIntent || type === "all") && query) {
        const tag = query.toLowerCase().replace(/^#/, "")
        const { data: tagged } = await supabase
          .from("loops")
          .select(
            `
            *,
            author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id),
            loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
          `,
          )
          .is("parent_loop_id", null)
          .contains("hashtags", [tag])
          .order("created_at", { ascending: false })
          .limit(limit)

        const merged = [...(loops || [])]
        const ids = new Set(merged.map((l) => l.id))
        for (const row of tagged || []) {
          if (!ids.has(row.id)) {
            merged.push(row)
            ids.add(row.id)
          }
        }
        loops = merged.slice(0, limit)
      }

      const visibleLoops = (await filterPrivateLoops(loops || [])) || []
      results.loops = normalizeLoops(
        await applyRealCommentCounts(supabase, await enrichLoopsWithPollsAndDuels(supabase, visibleLoops)),
      )
    }

    if (wantUsers) {
      const pattern = `%${query}%`
      let users: any[] | null = null
      const primary = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, video_avatar_url, bio, is_verified, is_premium, followers_count, following_count",
        )
        .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
        .order("followers_count", { ascending: false })
        .range(0, Math.min(limit, 20) - 1)

      if (!primary.error) {
        users = primary.data
      } else {
        const fallback = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, video_avatar_url, bio, is_verified, is_premium")
          .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
          .limit(20)
        users = fallback.data
      }

      // Mark following status + hide private profiles the viewer can't see.
      if (users?.length) {
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user?.id || "__nobody__")
          .in(
            "following_id",
            users.map((u) => u.id),
          )
        const following = new Set((follows || []).map((f) => f.following_id))
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, privacy_settings")
          .in(
            "id",
            users.map((u) => u.id),
          )
        const privateIds = new Set(
          (profiles || [])
            .filter((p: any) =>
              ["private", "followers"].includes((p.privacy_settings || {})?.profile_visibility),
            )
            .map((p: any) => p.id),
        )
        users = users
          .filter((u: any) => {
            if (!privateIds.has(u.id)) return true
            if (user && u.id === user.id) return true
            return following.has(u.id)
          })
          .map((u: any) => ({ ...u, is_following: following.has(u.id) }))
      }

      results.users = users || []
    }

    if (wantHashtags) {
      const tagQuery = query.toLowerCase().replace(/^#/, "")
      let hashtags: any[] = []

      const { data: fromTable } = await supabase
        .from("hashtags")
        .select("*")
        .ilike("tag", `%${tagQuery}%`)
        .order("usage_count", { ascending: false })
        .limit(12)

      if (fromTable?.length) {
        hashtags = fromTable.map((h) => ({
          tag: String(h.tag || "").replace(/^#/, ""),
          usage_count: h.usage_count || h.count || 0,
          is_trending: Boolean(h.is_trending),
          loop_count: h.usage_count || h.count || 0,
        }))
      } else {
        // Derive from recent loops hashtags
        const { data: recent } = await supabase
          .from("loops")
          .select("hashtags")
          .not("hashtags", "eq", "{}")
          .order("created_at", { ascending: false })
          .limit(120)

        const counts = new Map<string, number>()
        for (const row of recent || []) {
          for (const raw of row.hashtags || []) {
            const tag = String(raw).toLowerCase().replace(/^#/, "")
            if (!tag || (tagQuery && !tag.includes(tagQuery))) continue
            counts.set(tag, (counts.get(tag) || 0) + 1)
          }
        }
        hashtags = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([tag, count]) => ({ tag, usage_count: count, loop_count: count, is_trending: count >= 3 }))
      }

      results.hashtags = hashtags
    }

    if (wantCircles) {
      const pattern = `%${query}%`
      let circles: any[] | null = null
      const primary = await supabase
        .from("circles")
        .select(
          `
          id, name, description, avatar_url, video_avatar_url, cover_url, member_count, is_public, slug,
          owner:profiles!owner_id(id, username, display_name, avatar_url, video_avatar_url, is_verified)
        `,
        )
        .or(`name.ilike.${pattern},description.ilike.${pattern}`)
        .order("member_count", { ascending: false })
        .limit(12)

      if (!primary.error) {
        circles = primary.data
      } else {
        const fallback = await supabase
          .from("circles")
          .select("id, name, description, avatar_url, video_avatar_url, member_count, is_public")
          .ilike("name", pattern)
          .limit(12)
        circles = fallback.data
      }

      results.circles = (circles || []).filter((c: any) => c.is_public !== false)
    }

    results.total =
      results.loops.length + results.users.length + results.hashtags.length + results.circles.length

    return NextResponse.json({
      success: true,
      query: rawQuery,
      type,
      // Flat + nested for older/newer clients
      loops: results.loops,
      users: results.users,
      hashtags: results.hashtags,
      circles: results.circles,
      results,
      pagination: { limit, offset, total: results.total },
    })
  } catch (error: any) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
