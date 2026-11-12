import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { filterPrivateContent, getFollowingIds } from "@/lib/privacy"

export const dynamic = "force-dynamic"

async function getUser(request: NextRequest) {
  return getUserFromRequest(request)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const user = await getUser(request)
    const { searchParams } = new URL(request.url)

    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "30")
    const category = searchParams.get("category") || "trending"
    const hashtag = searchParams.get("hashtag")
    const focusId = searchParams.get("focus")
    const shouldShuffle = searchParams.get("shuffle") !== "false"

    let query = supabase
      .from("reels")
      .select(`
        *,
        author:profiles!author_id (
          id,
          username,
          display_name,
          avatar_url, video_avatar_url,
          is_verified,
          is_premium,
          badge_id
        )
      `)
      .eq("visibility", "public")

    switch (category) {
      case "trending":
        query = query.order("like_count", { ascending: false }).order("view_count", { ascending: false })
        break
      case "explore": {
        // Explore grid: a mix of high-engagement and fresh reels. Engaging
        // reels come from a wider window than "trending" (views + likes over
        // the last ~2 weeks) so the grid isn't stuck on all-time hits, then
        // fresh uploads fill the rest. Deterministic order (no shuffle) so the
        // masonry grid doesn't jump between renders.
        const poolSize = Math.max(limit * 4, 60)
        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

        const { data: hot } = await supabase
          .from("reels")
          .select(`
            *,
            author:profiles!author_id (
              id,
              username,
              display_name,
              avatar_url, video_avatar_url,
              is_verified,
              is_premium,
              badge_id
            )
          `)
          .eq("visibility", "public")
          .gte("created_at", since)
          .order("view_count", { ascending: false })
          .order("like_count", { ascending: false })
          .limit(Math.ceil(poolSize * 0.6))

        const { data: fresh } = await supabase
          .from("reels")
          .select(`
            *,
            author:profiles!author_id (
              id,
              username,
              display_name,
              avatar_url, video_avatar_url,
              is_verified,
              is_premium,
              badge_id
            )
          `)
          .eq("visibility", "public")
          .order("created_at", { ascending: false })
          .limit(Math.ceil(poolSize * 0.4))

        // Merge, dedupe, then interleave so fresh clips surface between hits
        // (pure "hot" ordering would push brand-new uploads to the bottom).
        const seen = new Set<string>()
        const merged: any[] = []
        const hotList = hot || []
        const freshList = (fresh || []).filter((r: any) => !hotList.some((h: any) => h.id === r.id))
        const maxLen = Math.max(hotList.length, freshList.length)
        // 2 hot : 1 fresh cadence
        for (let i = 0; i < maxLen; i++) {
          for (let j = 0; j < 2; j++) {
            const reel = hotList[i * 2 + j]
            if (reel && !seen.has(reel.id)) {
              seen.add(reel.id)
              merged.push(reel)
            }
          }
          const reel = freshList[i]
          if (reel && !seen.has(reel.id)) {
            seen.add(reel.id)
            merged.push(reel)
          }
        }

        // Tail with anything not yet included so we always fill `limit`
        for (const reel of [...hotList, ...freshList]) {
          if (merged.length >= limit) break
          if (!seen.has(reel.id)) {
            seen.add(reel.id)
            merged.push(reel)
          }
        }

        let liked = new Set<string>()
        let saved = new Set<string>()
        if (user && merged.length) {
          const { data: interactions } = await supabase
            .from("reel_interactions")
            .select("reel_id, interaction_type")
            .eq("user_id", user.id)
            .in(
              "reel_id",
              merged.map((r) => r.id),
            )
          for (const row of interactions || []) {
            if (row.interaction_type === "like") liked.add(row.reel_id)
            if (row.interaction_type === "save") saved.add(row.reel_id)
          }
        }

        let exploreProcessed = merged
          .slice(0, limit)
          .map((reel: any) => ({
            ...reel,
            type: reel.content_type,
            is_liked: liked.has(reel.id),
            is_saved: saved.has(reel.id),
          }))

        // Private/followers-only profiles stay out of the explore grid
        const exploreFollowing = await getFollowingIds(supabase, user?.id || null)
        exploreProcessed = await filterPrivateContent(supabase, exploreProcessed, user?.id || null, exploreFollowing)

        return NextResponse.json({
          success: true,
          data: {
            reels: exploreProcessed,
            page,
            limit,
            has_more: merged.length > limit,
          },
        })
      }
      case "following": {
        if (!user) {
          return NextResponse.json({
            success: true,
            data: { reels: [], page, limit, has_more: false },
          })
        }
        const { data: following } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
        const ids = (following || []).map((f) => f.following_id)
        if (ids.length) query = query.in("author_id", ids)
        else query = query.eq("author_id", "00000000-0000-0000-0000-000000000000")
        query = query.order("created_at", { ascending: false })
        break
      }
      case "mine":
        if (!user) {
          return NextResponse.json({ error: "Sign in to view your reels" }, { status: 401 })
        }
        query = query.eq("author_id", user.id)
        query = query.order("created_at", { ascending: false })
        break
      case "recent":
      default:
        query = query.order("created_at", { ascending: false })
    }

    if (hashtag) query = query.contains("hashtags", [hashtag])

    // If shuffling, fetch a larger pool to randomize sequence
    const fetchLimit = shouldShuffle ? Math.max(limit * 2, 40) : limit
    query = query.range(0, fetchLimit - 1)

    const { data: reels, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let liked = new Set<string>()
    let saved = new Set<string>()
    if (user && reels?.length) {
      const { data: interactions } = await supabase
        .from("reel_interactions")
        .select("reel_id, interaction_type")
        .eq("user_id", user.id)
        .in(
          "reel_id",
          reels.map((r) => r.id),
        )
      for (const row of interactions || []) {
        if (row.interaction_type === "like") liked.add(row.reel_id)
        if (row.interaction_type === "save") saved.add(row.reel_id)
      }
    }

    let processed = (reels || []).map((reel) => ({
      ...reel,
      type: reel.content_type,
      is_liked: liked.has(reel.id),
      is_saved: saved.has(reel.id),
    }))

    // Private/followers-only profiles' reels stay out of public browse
    // surfaces unless the viewer follows the author (or is the author).
    const following = await getFollowingIds(supabase, user?.id || null)

    // The feed's Follow buttons need to know the current relationship without
    // one request per card.
    processed = processed.map((reel) => ({
      ...reel,
      is_following: Boolean(
        user && (reel.author_id === user.id || following.has(String(reel.author_id))),
      ),
    }))

    processed = await filterPrivateContent(supabase, processed, user?.id || null, following)

    // Fallback: surface video loops so the feed is never empty
    // (skipped for personal views like "mine" so we never show strangers' clips)
    if (!processed.length && page === 1 && category !== "mine") {
      const { data: videoLoops } = await supabase
        .from("loops")
        .select(`
          id, author_id, content, content_text, media_url, content_media_url, media_type, hashtags, created_at,
          author:profiles!author_id (id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, badge_id),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .or("media_type.eq.video,content_type.eq.video")
        .order("created_at", { ascending: false })
        .limit(limit)

      const fallbackRows = await filterPrivateContent(supabase, videoLoops || [], user?.id || null, following)
      const { applyRealCommentCounts } = await import("@/lib/loop-stats")
      await applyRealCommentCounts(supabase, fallbackRows)
      processed = fallbackRows
        .map((loop: any) => {
          const url = loop.media_url || loop.content_media_url
          if (!url) return null
          const stats = Array.isArray(loop.loop_stats) ? loop.loop_stats[0] : loop.loop_stats
          return {
            id: loop.id,
            author_id: loop.author_id,
            title: (loop.content_text || loop.content || "Loop reel").slice(0, 80),
            description: loop.content_text || loop.content || "",
            content_type: "video",
            type: "video",
            content_url: url,
            thumbnail_url: null,
            hashtags: loop.hashtags || [],
            like_count: Number(stats?.likes_count || 0),
            comment_count: Number(stats?.comments_count || 0),
            share_count: Number(stats?.shares_count || 0),
            view_count: Number(stats?.views_count || 0),
            allows_comments: true,
            author: loop.author,
            created_at: loop.created_at,
            is_liked: false,
            is_saved: false,
            source: "loop",
          }
        })
        .filter(Boolean) as any[]
    }

    // Guarantee the focus reel is present: it may come from a different
    // surface (e.g. the Explore grid) and not be in this category's pool.
    if (focusId && !processed.some((r) => r.id === focusId)) {
      const { data: focusRow } = await supabase
        .from("reels")
        .select(`
          *,
          author:profiles!author_id (
            id,
            username,
            display_name,
            avatar_url, video_avatar_url,
            is_verified,
            is_premium,
            badge_id
          )
        `)
        .eq("id", focusId)
        .eq("visibility", "public")
        .maybeSingle()
      if (focusRow) {
        let focusLiked = false
        let focusSaved = false
        if (user) {
          const { data: focusInteractions } = await supabase
            .from("reel_interactions")
            .select("interaction_type")
            .eq("user_id", user.id)
            .eq("reel_id", focusId)
          for (const row of focusInteractions || []) {
            if (row.interaction_type === "like") focusLiked = true
            if (row.interaction_type === "save") focusSaved = true
          }
        }
        processed = [
          { ...focusRow, type: focusRow.content_type, is_liked: focusLiked, is_saved: focusSaved },
          ...processed,
        ]
        processed = await filterPrivateContent(supabase, processed, user?.id || null, following)
      }
    }

    // Shuffle & randomize sequence per session if requested
    if (shouldShuffle && processed.length > 1) {
      if (focusId) {
        // Keep focus reel first, shuffle the rest
        const focusReel = processed.find((r) => r.id === focusId)
        const others = processed.filter((r) => r.id !== focusId)
        for (let i = others.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[others[i], others[j]] = [others[j], others[i]]
        }
        processed = focusReel ? [focusReel, ...others] : others
      } else {
        // Full Fisher-Yates shuffle
        for (let i = processed.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[processed[i], processed[j]] = [processed[j], processed[i]]
        }
      }
    }

    // Limit output to requested size
    processed = processed.slice(0, limit)

    return NextResponse.json({
      success: true,
      data: {
        reels: processed,
        page,
        limit,
        has_more: (reels?.length || 0) === limit,
      },
    })
  } catch (error) {
    console.error("Get reels error:", error)
    return NextResponse.json({ error: "Failed to fetch reels" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

    const body = await request.json()
    const {
      title,
      description,
      content_type,
      content_url,
      thumbnail_url,
      duration,
      hashtags,
      music_id,
      effects,
      visibility,
      allows_comments,
      allows_duets,
      allows_downloads,
    } = body

    if (!title?.trim() || !content_type || !content_url) {
      return NextResponse.json({ error: "Title, content_type, and content_url are required" }, { status: 400 })
    }

    const validTypes = ["video", "image", "audio", "text"]
    if (!validTypes.includes(content_type)) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    }

    const { data: reel, error } = await supabase
      .from("reels")
      .insert({
        author_id: user.id,
        title: title.trim(),
        description: description?.trim(),
        content_type,
        content_url,
        thumbnail_url,
        // duration is an integer column — Cloudinary reports seconds as a
        // float (e.g. 12.446145), which Postgres rejects as "invalid input
        // syntax for type integer". Round to whole seconds.
        duration: duration != null && Number.isFinite(Number(duration)) ? Math.round(Number(duration)) : null,
        hashtags: hashtags || [],
        music_id: music_id || null,
        effects: effects || null,
        visibility: visibility || "public",
        allows_comments: allows_comments !== false,
        allows_duets: allows_duets !== false,
        allows_downloads: allows_downloads !== false,
      })
      .select(`
        *,
        author:profiles!author_id (
          id, username, display_name, avatar_url, video_avatar_url, is_verified
        )
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Broadcast new reel for realtime feeds
    try {
      await supabase.channel("reels:public").send({
        type: "broadcast",
        event: "reel:created",
        payload: { reel: { ...reel, type: reel.content_type } },
      })
    } catch { /* intentionally silent */ }

    return NextResponse.json({ success: true, data: { reel: { ...reel, type: reel.content_type } } })
  } catch (error) {
    console.error("Create reel error:", error)
    return NextResponse.json({ error: "Failed to create reel" }, { status: 500 })
  }
}
