import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoops } from "@/lib/normalize-loop"
import {
  followingBoost,
  hashtagAffinityBonus,
  smartEngagementScore,
} from "@/lib/feed-ranking"
import { calculateBoostInfo, isBoostRelevantToUser, capBoostedPostsInFeed } from "@/lib/boost"
import { cosmeticsFromInventory } from "@/lib/cosmetics"

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

/** Interleave own posts (~25–30%) into algorithmically ranked For You feed */
function mixOwnPostsIntoFeed<T extends { id: string; author_id?: string }>(
  ranked: T[],
  ownPosts: T[],
  userId: string,
  limit: number,
  offset: number,
) {
  if (!ownPosts.length) {
    return ranked.slice(offset, offset + limit)
  }

  const ownQuota = Math.max(1, Math.round(limit * 0.28))
  const ownSlice = ownPosts.slice(0, Math.max(ownQuota + 2, 6))
  const ownIds = new Set(ownSlice.map((p) => p.id))

  // Build a window larger than needed, then page
  const mixed: T[] = []
  let ownIdx = 0
  let algoIdx = 0
  const algoPool = ranked.filter((p) => !ownIds.has(p.id) || p.author_id !== userId)

  // Pattern: every ~3–4 algo items, insert one own post
  while (mixed.length < offset + limit + 8 && (ownIdx < ownSlice.length || algoIdx < algoPool.length)) {
    const shouldInsertOwn =
      ownIdx < ownSlice.length &&
      (mixed.length === 0 || mixed.filter((m) => m.author_id === userId).length < ownQuota + offset) &&
      (mixed.length % 4 === 1 || algoIdx >= algoPool.length)

    if (shouldInsertOwn) {
      const next = ownSlice[ownIdx++]
      if (!mixed.some((m) => m.id === next.id)) mixed.push(next)
      continue
    }

    if (algoIdx < algoPool.length) {
      const next = algoPool[algoIdx++]
      if (!mixed.some((m) => m.id === next.id)) mixed.push(next)
    } else if (ownIdx < ownSlice.length) {
      const next = ownSlice[ownIdx++]
      if (!mixed.some((m) => m.id === next.id)) mixed.push(next)
    } else {
      break
    }
  }

  // Ensure at least one own post appears in first page when available
  if (offset === 0 && ownSlice[0] && !mixed.slice(0, limit).some((m) => m.author_id === userId)) {
    const insertAt = Math.min(2, Math.max(0, limit - 1))
    mixed.splice(insertAt, 0, ownSlice[0])
  }

  return mixed.slice(offset, offset + limit)
}

async function enrichLoopsWithPollsAndDuels(supabase: any, loops: any[]) {
  if (!loops || loops.length === 0) return loops
  const loopIds = loops.map((l) => l.id).filter(Boolean)
  if (!loopIds.length) return loops

  const pollMap = new Map<string, any>()
  const duelMap = new Map<string, any>()

  const [pollsRes, duelsRes] = await Promise.all([
    supabase.from("loop_polls").select("*").in("loop_id", loopIds),
    supabase
      .from("loop_duels")
      .select(`
        *,
        creator:profiles!creator_id(id, username, display_name, avatar_url),
        opponent:profiles!opponent_id(id, username, display_name, avatar_url),
        entries:loop_duel_entries(id, side, title, content, media_url, votes_count, user_id)
      `)
      .in("loop_id", loopIds),
  ])

  pollsRes.data?.forEach((p: any) => pollMap.set(p.loop_id, p))
  duelsRes.data?.forEach((d: any) => duelMap.set(d.loop_id, d))

  return loops.map((loop) => {
    const poll = pollMap.get(loop.id) || loop.poll || loop.loop_polls || undefined
    const duel = duelMap.get(loop.id) || loop.duel || loop.loop_duels || undefined
    const post_type = loop.post_type || (poll ? "poll" : duel ? "duel" : loop.content_type || "standard")
    return {
      ...loop,
      poll,
      duel,
      post_type,
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    let type = searchParams.get("type") || "recent"
    const since = searchParams.get("since") // ISO timestamp — newer-only refresh
    const supabase = createServerClient()

    // Guests may only browse public chronological / trending feeds
    if (!user) {
      if (type === "personalized" || type === "following") type = "trending"
      if (type !== "trending" && type !== "recent") type = "recent"
    }

    // X-style refresh: return only loops newer than `since`, chronological (no re-rank shuffle)
    if (since) {
      const sinceDate = new Date(since)
      if (Number.isNaN(sinceDate.getTime())) {
        return NextResponse.json({ error: "Invalid since timestamp" }, { status: 400 })
      }

      let followingIds: string[] = []
      if (user) {
        const { data: followingData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
        followingIds = (followingData || []).map((f) => f.following_id).filter(Boolean) as string[]
      }

      let refreshQuery = supabase
        .from("loops")
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_premium, level, active_cosmetics, cosmetics, badge_id),
          parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url)),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .or("visibility.eq.public,visibility.is.null")
        .gt("created_at", sinceDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(Math.min(limit, 50))

      if (type === "following") {
        if (!followingIds.length) {
          return NextResponse.json({
            success: true,
            loops: [],
            hasMore: false,
            new_count: 0,
            type,
            algorithm: "since_refresh",
            guest: !user,
          })
        }
        refreshQuery = refreshQuery.in("author_id", followingIds)
      }

      let { data, error } = await refreshQuery
      if (error && (/level|PGRST204/i.test(error.message || "") || error.code === "PGRST204")) {
        let fallback = supabase
          .from("loops")
          .select(`
            *,
            author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_premium, active_cosmetics, cosmetics, badge_id),
            parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url)),
            loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
          `)
          .eq("visibility", "public")
          .gt("created_at", sinceDate.toISOString())
          .order("created_at", { ascending: false })
          .limit(Math.min(limit, 50))
        if (type === "following" && followingIds.length) {
          fallback = fallback.in("author_id", followingIds)
        }
        ;({ data, error } = await fallback)
      }

      if (error) {
        console.error("Supabase since query error:", error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      let loops = data || []
      loops = await enrichLoopsWithPollsAndDuels(supabase, loops)
      const interactionMap = new Map<string, string[]>()
      if (user && loops.length > 0) {
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

      const normalizedLoops = normalizeLoops(loops, interactionMap)
      return NextResponse.json({
        success: true,
        loops: normalizedLoops,
        hasMore: false,
        new_count: normalizedLoops.length,
        type,
        algorithm: "since_refresh",
        guest: !user,
        pagination: { limit, offset: 0, total: normalizedLoops.length },
      })
    }

    if (!user && (type === "following" || type === "personalized")) {
      type = "trending"
    }

    const followingIds = new Set<string>()
    if (user) {
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
      for (const f of followingData || []) {
        if (f.following_id) followingIds.add(f.following_id)
      }
    }

    let authorIds: string[] | null = null
    let mode = type
    let useSmartRank = type === "personalized" || type === "trending"

    if (type === "following") {
      authorIds = Array.from(followingIds)
      if (authorIds.length === 0) {
        return NextResponse.json({ success: true, loops: [], hasMore: false, type })
      }
    } else if (type === "personalized") {
      authorIds = null
      useSmartRank = true
      mode = followingIds.size === 0 ? "personalized_cold_start" : "personalized"
    }

    const fetchLimit = useSmartRank ? Math.max(limit * 5, 80) : offset + limit

    let query = supabase
      .from("loops")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_premium, is_organization, organization_badge_url, organization_name, level, active_cosmetics, cosmetics, badge_id),
        parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url)),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .range(0, fetchLimit - 1)

    if (type === "following" && authorIds) {
      query = query.in("author_id", authorIds)
    }

    let { data, error } = await query

    if (error && (/level|active_cosmetics/i.test(error.message || "") || error.code === "PGRST204")) {
      let fallback = supabase
        .from("loops")
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_premium, active_cosmetics, cosmetics, badge_id),
          parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url)),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .range(0, fetchLimit - 1)
      if (type === "following" && authorIds) {
        fallback = fallback.in("author_id", authorIds)
      }
      ;({ data, error } = await fallback)
    }

    if (error) {
      console.error("Supabase query error in feed route:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let loops = data || []
    const affinity =
      type === "personalized" && user
        ? await buildHashtagAffinity(supabase, user.id)
        : new Map<string, number>()

    let ownPosts: typeof loops = []
    if (type === "personalized" && user) {
      const { data: mine } = await supabase
        .from("loops")
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_premium, level, active_cosmetics, cosmetics, badge_id),
          parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url)),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .eq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12)

      ownPosts = mine || []
      const seen = new Set(loops.map((l) => l.id))
      for (const post of ownPosts) {
        if (!seen.has(post.id)) {
          loops.push(post)
          seen.add(post.id)
        }
      }
    }

    if (useSmartRank) {
      const userId = user?.id || ""
      const ranked = [...loops]
        .map((loop) => {
          const boostInfo = calculateBoostInfo(loop)
          const isRelevant = isBoostRelevantToUser(loop, boostInfo, userId, followingIds, affinity)
          let boostBonus = 0
          if (boostInfo.isBoosted && isRelevant) {
            boostBonus = boostInfo.tier === 3 ? 150 : boostInfo.tier === 2 ? 75 : 35
          }
          return {
            loop,
            boostInfo,
            score:
              smartEngagementScore(loop) +
              hashtagAffinityBonus(loop, affinity) +
              followingBoost(loop, followingIds) +
              (userId && loop.author_id === userId ? 10 : 0) +
              boostBonus,
          }
        })
        .sort((a, b) => b.score - a.score)
        .map((row) => ({ ...row.loop, _rank_score: row.score, boostInfo: row.boostInfo }))

      // Light author diversity
      const diversified: typeof ranked = []
      const recentAuthors: string[] = []
      for (const loop of ranked) {
        const author = loop.author_id
        const streak = recentAuthors.filter((id) => id === author).length
        if (streak >= 2 && diversified.length < limit * 3 && (!userId || loop.author_id !== userId)) {
          continue
        }
        diversified.push(loop)
        recentAuthors.push(author)
        if (recentAuthors.length > 3) recentAuthors.shift()
        if (diversified.length >= offset + limit + 20) break
      }
      if (diversified.length < offset + limit) {
        for (const loop of ranked) {
          if (diversified.some((d) => d.id === loop.id)) continue
          diversified.push(loop)
          if (diversified.length >= offset + limit + 10) break
        }
      }

      if (type === "personalized" && user) {
        const scoredOwn = ownPosts.map((loop) => ({
          ...loop,
          _rank_score: smartEngagementScore(loop) + 10,
        }))
        loops = mixOwnPostsIntoFeed(diversified, scoredOwn, user.id, limit, offset)
        mode = `${mode}_mixed`
      } else {
        loops = diversified.slice(offset, offset + limit)
      }
    } else if (type === "recent" || type === "following") {
      loops = loops.slice(offset, offset + limit)
    }

    // Cap boost frequency: max 1 boosted post per 10 organic posts
    loops = capBoostedPostsInFeed(loops, (l: any) => l.boostInfo || calculateBoostInfo(l), 10)

    const interactionMap = new Map<string, string[]>()
    if (user && loops.length > 0) {
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

    // Attach active cosmetics for authors onto raw rows before normalize
    const authorIdList = [...new Set(loops.map((l) => l.author_id).filter(Boolean))] as string[]
    const cosmeticsByAuthor = new Map<string, ReturnType<typeof cosmeticsFromInventory>>()

    if (authorIdList.length) {
      const { data: activeItems } = await supabase
        .from("user_inventory")
        .select("user_id, item_id, item_type, is_active, shop_item:shop_items(id, name, category, item_type, item_data, preview_data, icon_url, preview_url, rarity)")
        .in("user_id", authorIdList)
        .eq("is_active", true)
        .limit(200)

      const grouped = new Map<string, any[]>()
      for (const row of activeItems || []) {
        if (!grouped.has(row.user_id)) grouped.set(row.user_id, [])
        grouped.get(row.user_id)!.push(row)
      }
      for (const [uid, rows] of grouped) {
        cosmeticsByAuthor.set(uid, cosmeticsFromInventory(rows))
      }
    }

    loops = loops.map((loop: any) => {
      const author = Array.isArray(loop.author) ? loop.author[0] : loop.author
      const cosmetics = cosmeticsByAuthor.get(loop.author_id) || null
      return {
        ...loop,
        author: author
          ? { ...author, cosmetics, active_cosmetics: cosmetics }
          : loop.author,
      }
    })

    loops = await enrichLoopsWithPollsAndDuels(supabase, loops)

    const normalizedLoops = normalizeLoops(loops, interactionMap).map((loop, i) => {
      const raw = loops[i] as any
      return {
        ...loop,
        engagement_score: Number(raw?._rank_score ?? smartEngagementScore(raw || loop)),
      }
    })

    return NextResponse.json({
      success: true,
      loops: normalizedLoops,
      hasMore: normalizedLoops.length === limit,
      type: mode,
      algorithm: useSmartRank ? (type === "personalized" ? "smart_rank_mixed_v1" : "smart_rank_v1") : "chronological",
      guest: !user,
      pagination: { limit, offset, total: normalizedLoops.length },
    })
  } catch (error: any) {
    console.error("Error fetching feed:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
