import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoops } from "@/lib/normalize-loop"
import { enrichLoopsWithPollsAndDuels } from "@/lib/enrich-loops"
import { applyRealCommentCounts } from "@/lib/loop-stats"
import { getUserFromRequest } from "@/lib/server-auth";
import { getBlockedProfileIds } from "@/lib/privacy"
import { isRestrictedProfileVisibility } from "@/lib/profile-privacy"

export const dynamic = "force-dynamic"


function escapeIlike(value: string) {
  return value.replace(/[%,_()\\\\]/g, " ").trim()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = (searchParams.get("q") || searchParams.get("query") || "").trim()
    const type = searchParams.get("type") || "all"
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "20", 10)
    const requestedOffset = Number.parseInt(searchParams.get("offset") || "0", 10)
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(40, requestedLimit)) : 20
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.min(10_000, requestedOffset)) : 0

    if (!rawQuery) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }
    if (rawQuery.length > 120) {
      return NextResponse.json({ error: "Search terms are limited to 120 characters" }, { status: 400 })
    }
    if (!["all", "loops", "users", "hashtags", "circles", "chains", "collections"].includes(type)) {
      return NextResponse.json({ error: "Unsupported search type" }, { status: 400 })
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
      chains: any[]
      collections: any[]
      total: number
    } = { loops: [], users: [], hashtags: [], circles: [], chains: [], collections: [], total: 0 }

    // Resolve block relationships once for cross-type filtering below.


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
    const wantChains = (type === "all" || type === "chains") && !isUserIntent && !isHashtagIntent
    const wantCollections = (type === "all" || type === "collections") && !isUserIntent && !isHashtagIntent

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

    // Public search results must not expose work owned by blocked or restricted
    // profiles. A failed owner lookup is treated as unavailable, not public.
    const filterPublicOwnerItems = async (items: any[], ownerField: "author_id" | "creator_id" | "owner_id") => {
      if (!items.length) return []
      const publicItems = items.filter((item) => item.visibility === "public")
      const ownerIds = [...new Set(publicItems.map((item) => item[ownerField]).filter(Boolean))] as string[]
      if (!ownerIds.length) return []
      const blockedIds = await getBlockedProfileIds(supabase, user?.id || null, ownerIds).catch(() => new Set(ownerIds))
      const { data: owners, error: ownerError } = await supabase
        .from("profiles")
        .select("id, privacy_settings")
        .in("id", ownerIds)
      if (ownerError || !owners) return []
      const ownerById = new Map(owners.map((owner: any) => [owner.id, owner]))
      return publicItems.filter((item) => {
        const ownerId = item[ownerField]
        if (!ownerId || blockedIds.has(ownerId)) return false
        const owner = ownerById.get(ownerId)
        if (!owner) return false
        const restricted = isRestrictedProfileVisibility(owner.privacy_settings)
        return !restricted || (user && (ownerId === user.id || followingIds.has(ownerId)))
      })
    }

    const filterPrivateLoops = async (loops: any[]) => {
      if (!loops.length) return loops
      const blockedIds = await getBlockedProfileIds(supabase, user?.id || null, loops.map((l) => l.author_id))
      const unblockedLoops = loops.filter((loop) => !blockedIds.has(loop.author_id))
      if (!unblockedLoops.length) return []
      const authorIds = [...new Set(unblockedLoops.map((l) => l.author_id).filter(Boolean))] as string[]
      if (!authorIds.length) return unblockedLoops
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
      if (!privateIds.size) return unblockedLoops
      return unblockedLoops.filter((loop) => {
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
          .eq("visibility", "public")
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
          .eq("visibility", "public")
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
        // Blocked users (either direction) are hidden from search results.
        const hiddenIds = await getBlockedProfileIds(supabase, user?.id || null, users.map((entry: any) => entry.id))
        users = users
          .filter((u: any) => {
            if (hiddenIds.has(u.id)) return false
            if (!privateIds.has(u.id)) return true
            if (user && u.id === user.id) return true
            return following.has(u.id)
          })
          .map((u: any) => ({ ...u, is_following: following.has(u.id) }))
      }

      results.users = users || []
    }

    if (wantHashtags) {
      // Derive search suggestions only from public Loops. A global hashtag
      // counter cannot prove whether a tag originated solely in private posts.
      const tagQuery = query.toLowerCase().replace(/^#/, "")
      const { data: recent } = await supabase
        .from("loops")
        .select("hashtags")
        .eq("visibility", "public")
        .is("parent_loop_id", null)
        .not("hashtags", "eq", "{}")
        .order("created_at", { ascending: false })
        .limit(300)

      const counts = new Map<string, number>()
      for (const row of recent || []) {
        for (const raw of row.hashtags || []) {
          const tag = String(raw).toLowerCase().replace(/^#/, "")
          if (!tag || (tagQuery && !tag.includes(tagQuery))) continue
          counts.set(tag, (counts.get(tag) || 0) + 1)
        }
      }
      results.hashtags = [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 12)
        .map(([tag, count]) => ({
          tag,
          usage_count: count,
          loop_count: count,
          is_trending: count >= 3,
        }))
    }


    if (wantChains) {
      const pattern = `%${query}%`
      const selection = `
        id, creator_id, circle_id, title, description, prompt, kind, category,
        visibility, status, cover_image_url, contribution_count, participant_count,
        created_at, updated_at,
        creator:profiles!creator_id(id, username, display_name, avatar_url, is_verified)
      `
      let chains: any[] | null = null
      const primary = await supabase
        .from("chains")
        .select(selection)
        .eq("visibility", "public")
        // The Chain access policy requires Circle membership whenever a Chain
        // is attached to a Circle, even if its visibility is otherwise public.
        .is("circle_id", null)
        .in("status", ["active", "completed"])
        .or(`title.ilike.${pattern},description.ilike.${pattern},prompt.ilike.${pattern}`)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (!primary.error) {
        chains = primary.data
      } else {
        const fallback = await supabase
          .from("chains")
          .select(selection)
          .eq("visibility", "public")
          .is("circle_id", null)
          .in("status", ["active", "completed"])
          .ilike("title", pattern)
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1)
        chains = fallback.error ? [] : fallback.data
      }

      const visibleChains = (chains || []).filter((chain: any) =>
        chain.visibility === "public" &&
        chain.circle_id == null &&
        ["active", "completed"].includes(chain.status),
      )
      results.chains = await filterPublicOwnerItems(visibleChains, "creator_id")
    }

    if (wantCollections) {
      const pattern = `%${query}%`
      const selection = `
        id, owner_id, title, description, visibility, is_collaborative,
        created_at, updated_at,
        owner:profiles!owner_id(id, username, display_name, avatar_url, is_verified)
      `
      let collections: any[] | null = null
      const primary = await supabase
        .from("collections")
        .select(selection)
        .eq("visibility", "public")
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (!primary.error) {
        collections = primary.data
      } else {
        const fallback = await supabase
          .from("collections")
          .select(selection)
          .eq("visibility", "public")
          .ilike("title", pattern)
          .order("updated_at", { ascending: false })
          .range(offset, offset + limit - 1)
        collections = fallback.error ? [] : fallback.data
      }

      results.collections = await filterPublicOwnerItems(
        (collections || []).filter((collection: any) => collection.visibility === "public"),
        "owner_id",
      )
    }

    if (wantCircles) {
      const pattern = `%${query}%`
      let circles: any[] | null = null
      const primary = await supabase
        .from("circles")
        .select(
          `
          id, name, description, avatar_url, video_avatar_url, cover_url, member_count, is_private, slug,
          owner:profiles!owner_id(id, username, display_name, avatar_url, video_avatar_url, is_verified)
        `,
        )
        .or(`name.ilike.${pattern},description.ilike.${pattern}`)
        .eq("is_private", false)
        .order("member_count", { ascending: false })
        .limit(12)

      if (!primary.error) {
        circles = primary.data
      } else {
        const fallback = await supabase
          .from("circles")
          .select("id, name, description, avatar_url, member_count, is_private")
          .ilike("name", pattern)
          .eq("is_private", false)
          .limit(12)
        circles = fallback.data
      }

      // Circle discovery is public-only. Private Circle metadata should not
      // be exposed by search, even when a viewer guesses a matching name.
      results.circles = (circles || []).filter((circle: any) => circle.is_private === false)
    }

    results.total =
      results.loops.length + results.users.length + results.hashtags.length + results.circles.length +
      results.chains.length + results.collections.length

    return NextResponse.json({
      success: true,
      query: rawQuery,
      type,
      // Flat + nested for older/newer clients
      loops: results.loops,
      users: results.users,
      hashtags: results.hashtags,
      circles: results.circles,
      chains: results.chains,
      collections: results.collections,
      results,
      pagination: { limit, offset, total: results.total },
    })
  } catch (error: any) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
