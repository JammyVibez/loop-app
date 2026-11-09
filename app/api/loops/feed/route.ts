import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoops } from "@/lib/normalize-loop"
import {
  followingBoost,
  hashtagAffinityBonus,
  rawEngagementScore,
  smartEngagementScore,
} from "@/lib/feed-ranking"
import { calculateBoostInfo, isBoostRelevantToUser, capBoostedPostsInFeed } from "@/lib/boost"
import { filterPrivateContent } from "@/lib/privacy"
import { filterCircleScopedContent } from "@/lib/circle-content-privacy"
import {
  FOR_YOU_CONFIG,
  blendForYouFeed,
  candidateLimitForOffset,
  recencyDecay,
  type ForYouSource,
} from "@/lib/for-you-ranking"
import { cosmeticsFromInventory } from "@/lib/cosmetics"
import { applyRealCommentCounts, applyRealBranchCounts, attachParentAuthors } from "@/lib/loop-stats"
import { enrichLoopsWithPollsAndDuels } from "@/lib/enrich-loops"
import { getUserFromRequest } from "@/lib/server-auth";


const FOR_YOU_SELECT = `
  *,
  author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, is_organization, organization_badge_url, organization_name, level, active_cosmetics, cosmetics, badge_id),
  parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url, video_avatar_url, is_verified)),
  loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
`

const FOR_YOU_SELECT_FALLBACK = `
  *,
  author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_premium, is_organization, organization_badge_url, organization_name, equipped_frame_id, active_cosmetics, cosmetics, badge_id),
  parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url, video_avatar_url, is_verified)),
  loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
`

function parseIdList(raw: string | null, max = 120): string[] {
  if (!raw) return []
  const ids = new Set<string>()
  for (const value of raw.split(",")) {
    const id = value.trim()
    if (!id || id.length > 80) continue
    ids.add(id)
    if (ids.size >= max) break
  }
  return [...ids]
}

function isSensitiveLoop(loop: any): boolean {
  const metadata = loop?.content_metadata || {}
  return Boolean(
    metadata.nsfw === true ||
      metadata.sensitive === true ||
      metadata.mature === true ||
      metadata.is_nsfw === true,
  )
}

function boostBonusForLoop(
  loop: any,
  userId: string,
  followingIds: Set<string>,
  affinity: Map<string, number>,
): number {
  const boostInfo = calculateBoostInfo(loop)
  if (!isBoostRelevantToUser(loop, boostInfo, userId, followingIds, affinity)) return 0
  return boostInfo.tier === 3 ? 150 : boostInfo.tier === 2 ? 75 : 35
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

/**
 * Privacy filter: loops authored by a private (or followers-only) profile
 * are only visible to the author themself and to users who follow them.
 * Applied server-side so private content never reaches the client.
 */
async function filterPrivateAuthorLoops(
  supabase: any,
  loops: any[],
  viewerId: string | null,
  followingIds: Set<string> | string[],
) {
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

  const followed = new Set(Array.from(followingIds))
  return loops.filter((loop) => {
    if (viewerId && loop.author_id === viewerId) return true
    if (followed.has(loop.author_id)) return true
    return !privateIds.has(loop.author_id)
  })
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

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    let type = searchParams.get("type") || "recent"
    const since = searchParams.get("since") // ISO timestamp — newer-only refresh
    const supabase = createServerClient()

    // ── For You: one server-ranked blend of following + trending + discovery ──
    // This replaces the old client-side ML/feed interleaving. The client only
    // renders the returned order; all privacy and ranking decisions live here.
    if (type === "personalized" || type === "for_you") {
      const safeLimit = Math.max(1, Math.min(limit || 20, 50))
      const safeOffset = Math.max(0, offset || 0)
      const seenIds = parseIdList(searchParams.get("session_seen"))
      const allowSensitive = ["1", "true"].includes((searchParams.get("allow_sensitive") || "").toLowerCase())

      const followingIds = new Set<string>()
      if (user) {
        const { data: followingData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
        for (const row of followingData || []) {
          if (row.following_id) followingIds.add(row.following_id)
        }
      }

      const affinity = user ? await buildHashtagAffinity(supabase, user.id) : new Map<string, number>()
      const candidateLimit = candidateLimitForOffset(safeOffset, safeLimit)
      const sinceDate = new Date(Date.now() - FOR_YOU_CONFIG.candidateWindowDays * 86_400_000)

      let candidateQuery = supabase
        .from("loops")
        .select(FOR_YOU_SELECT)
        .eq("visibility", "public")
        .gte("created_at", sinceDate.toISOString())
        .order("created_at", { ascending: false })
        .range(0, candidateLimit - 1)

      let { data: candidateRows, error: candidateError } = await candidateQuery
      if (candidateError && (/level|active_cosmetics/i.test(candidateError.message || "") || candidateError.code === "PGRST204")) {
        candidateQuery = supabase
          .from("loops")
          .select(FOR_YOU_SELECT_FALLBACK)
          .eq("visibility", "public")
          .gte("created_at", sinceDate.toISOString())
          .order("created_at", { ascending: false })
          .range(0, candidateLimit - 1)
        ;({ data: candidateRows, error: candidateError } = await candidateQuery)
      }

      if (candidateError) {
        console.error("Supabase For You candidate query error:", candidateError.message)
        return NextResponse.json({ error: candidateError.message }, { status: 500 })
      }

      let candidates = candidateRows || []
      candidates = await filterPrivateContent(supabase, candidates, user?.id || null, followingIds)
      candidates = await filterCircleScopedContent(supabase, candidates, user?.id || null)
      candidates = candidates.filter((loop: any) => {
        if (seenIds.includes(loop.id)) return false
        if (!allowSensitive && isSensitiveLoop(loop)) return false
        return true
      })

      const now = Date.now()
      const ranked: Array<any> = candidates.map((loop: any) => {
        const authorId = String(loop.author_id || "")
        const isOwn = Boolean(user?.id && authorId === user.id)
        const isFollowing = followingIds.has(authorId)
        const source: ForYouSource = isFollowing || isOwn ? "following" : "trending"
        const boostBonus = boostBonusForLoop(loop, user?.id || "", followingIds, affinity)
        const engagement = smartEngagementScore(loop, now)
        const affinityBonus = hashtagAffinityBonus(loop, affinity)

        let score = engagement + affinityBonus + boostBonus
        if (source === "following") {
          score += FOR_YOU_CONFIG.followingScoreBonus + (isOwn ? FOR_YOU_CONFIG.ownPostScoreBonus : 0)
        }

        return {
          ...loop,
          _feed_source: source,
          _rank_score: score,
          boostInfo: calculateBoostInfo(loop, now),
        }
      })

      const trending = ranked
        .map((loop) => ({ loop, score: Number(loop._rank_score) || 0 }))
        .sort((a, b) => b.score - a.score || String(b.loop.created_at).localeCompare(String(a.loop.created_at)))
        .map((row) => row.loop)

      const discovery = ranked
        .filter((loop) => loop._feed_source !== "following")
        .map((loop) => {
          const freshness = recencyDecay(loop.created_at, FOR_YOU_CONFIG.discoveryHalfLifeHours, now)
          const engagement = Math.log1p(Math.max(0, rawEngagementScore(loop)))
          return {
            loop,
            score: freshness * FOR_YOU_CONFIG.discoveryFreshnessWeight + engagement * FOR_YOU_CONFIG.discoveryEngagementWeight,
          }
        })
        .sort((a, b) => b.score - a.score || String(b.loop.created_at).localeCompare(String(a.loop.created_at)))
        .map((row) => ({ ...row.loop, _feed_source: "discovery" as const, _rank_score: row.score }))

      const following = ranked
        .filter((loop) => loop._feed_source === "following")
        .sort((a, b) => Number(b._rank_score) - Number(a._rank_score) || String(b.created_at).localeCompare(String(a.created_at)))

      const blended = blendForYouFeed({
        sources: { following, trending, discovery },
        limit: safeLimit,
        offset: safeOffset,
        seenIds,
      })

      // Do not remove items after blending: dropping an intervening post could
      // turn two same-author posts into three in a row. Boost frequency is
      // already bounded by scoring and the one-per-source dedupe.
      let selected = blended.items

      if (selected.length > 0) {
        const interactionMap = new Map<string, string[]>()
        if (user) {
          const { data: interactions } = await supabase
            .from("loop_interactions")
            .select("loop_id, interaction_type")
            .eq("user_id", user.id)
            .in("loop_id", selected.map((loop) => loop.id))
          interactions?.forEach((interaction) => {
            if (!interactionMap.has(interaction.loop_id)) interactionMap.set(interaction.loop_id, [])
            interactionMap.get(interaction.loop_id)?.push(interaction.interaction_type)
          })
        }

        const authorIdList = [...new Set(selected.map((loop) => loop.author_id).filter(Boolean))] as string[]
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

        selected = selected.map((loop: any) => {
          const author = Array.isArray(loop.author) ? loop.author[0] : loop.author
          const cosmetics = cosmeticsByAuthor.get(loop.author_id) || null
          return {
            ...loop,
            author: author ? { ...author, cosmetics, active_cosmetics: cosmetics } : loop.author,
          }
        })

        selected = await attachParentAuthors(supabase, selected)
        selected = await enrichLoopsWithPollsAndDuels(supabase, selected)
        selected = await applyRealCommentCounts(supabase, selected)
        selected = await applyRealBranchCounts(supabase, selected)

        const normalizedLoops = normalizeLoops(selected, interactionMap).map((loop, index) => {
          const raw = selected[index] as any
          return {
            ...loop,
            engagement_score: Number(raw?._rank_score ?? smartEngagementScore(raw || loop)),
            feed_source: raw?._feed_source || "trending",
          }
        })

        return NextResponse.json({
          success: true,
          loops: normalizedLoops,
          hasMore: blended.hasMore,
          type: user ? "personalized" : "for_you_guest",
          algorithm: "for_you_blend_v1",
          mix: FOR_YOU_CONFIG.mix,
          guest: !user,
          pagination: { limit: safeLimit, offset: safeOffset, total: normalizedLoops.length },
        })
      }

      return NextResponse.json({
        success: true,
        loops: [],
        hasMore: false,
        type: user ? "personalized" : "for_you_guest",
        algorithm: "for_you_blend_v1",
        mix: FOR_YOU_CONFIG.mix,
        guest: !user,
        pagination: { limit: safeLimit, offset: safeOffset, total: 0 },
      })
    }

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
          author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, is_organization, organization_badge_url, organization_name, equipped_frame_id, level, active_cosmetics, cosmetics, badge_id),
          parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url, video_avatar_url, is_verified)),
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
            author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_premium, is_organization, organization_badge_url, organization_name, equipped_frame_id, active_cosmetics, cosmetics, badge_id),
            parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url, video_avatar_url, is_verified)),
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
      loops = await filterPrivateAuthorLoops(supabase, loops, user?.id || null, followingIds)
      loops = await attachParentAuthors(supabase, loops)
      loops = await enrichLoopsWithPollsAndDuels(supabase, loops)
      loops = await applyRealCommentCounts(supabase, loops)
      loops = await applyRealBranchCounts(supabase, loops)
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
        author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, is_organization, organization_badge_url, organization_name, level, active_cosmetics, cosmetics, badge_id),
        parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url, video_avatar_url, is_verified)),
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
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_premium, is_organization, organization_badge_url, organization_name, equipped_frame_id, active_cosmetics, cosmetics, badge_id),
          parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url, video_avatar_url, is_verified)),
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
    // Private profiles' loops stay out of public/recommended surfaces unless
    // the viewer follows the author (or is the author).
    loops = await filterPrivateAuthorLoops(supabase, loops, user?.id || null, followingIds)
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
          author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, is_organization, organization_badge_url, organization_name, equipped_frame_id, level, active_cosmetics, cosmetics, badge_id),
          parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url, video_avatar_url, is_verified)),
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

    loops = await attachParentAuthors(supabase, loops)
    loops = await enrichLoopsWithPollsAndDuels(supabase, loops)
    loops = await applyRealCommentCounts(supabase, loops)
    loops = await applyRealBranchCounts(supabase, loops)

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
