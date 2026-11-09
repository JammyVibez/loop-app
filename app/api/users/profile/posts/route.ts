import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoops } from "@/lib/normalize-loop"
import { enrichLoopsWithPollsAndDuels } from "@/lib/enrich-loops"
import { getUserFromRequest } from "@/lib/server-auth"
import { profileStatus } from "@/lib/user-status"
import { applyRealCommentCounts, attachParentAuthors } from "@/lib/loop-stats"
import { checkBlockStatus } from "@/lib/user-blocks"
import { isRestrictedProfileVisibility } from "@/lib/profile-privacy"
import { filterPrivateContent, getFollowingIds } from "@/lib/privacy"
import { filterCircleScopedContent } from "@/lib/circle-content-privacy"

const PROFILE_LOOP_SELECT = `
  *,
  author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id, equipped_frame_id, active_cosmetics, cosmetics),
  loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
`

const EMPTY_PAGE = (offset: number, limit: number) => ({
  success: true,
  loops: [],
  pagination: {
    offset,
    limit,
    total: 0,
    next_offset: offset,
    has_more: false,
  },
})

/**
 * Paginated profile posts.
 *
 * The profile header payload is intentionally capped because it also carries
 * cosmetics, awards and relationship state. This endpoint is the full,
 * chronological post surface used by the Loops tab: every authored top-level
 * Loop, including duels and clutch duels, with the same privacy and Circle
 * checks as the rest of the profile.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const username = request.nextUrl.searchParams.get("username")?.trim()
    const authedUser = await getUserFromRequest(request)

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    const parsedOffset = Number.parseInt(request.nextUrl.searchParams.get("offset") || "0", 10)
    const parsedLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "24", 10)
    const offset = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0
    const limit = Number.isFinite(parsedLimit) ? Math.min(50, Math.max(1, parsedLimit)) : 24

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, privacy_settings, is_deleted, is_banned, deletion_executed_at")
      .eq("username", username)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (profileStatus(profile as any) !== "active") {
      return NextResponse.json(EMPTY_PAGE(offset, limit))
    }

    const isSelf = Boolean(authedUser && authedUser.id === profile.id)
    const privacySettings = (profile as any)?.privacy_settings || {}
    const isPrivate = isRestrictedProfileVisibility(privacySettings)

    let isFollower = false
    if (authedUser && !isSelf) {
      const blockStatus = await checkBlockStatus(supabase, authedUser.id, profile.id)
      if (blockStatus.blocked) return NextResponse.json(EMPTY_PAGE(offset, limit))

      if (isPrivate) {
        const { data: followRecord } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", authedUser.id)
          .eq("following_id", profile.id)
          .maybeSingle()
        isFollower = Boolean(followRecord)
      }
    }

    const canViewFull = !isPrivate || isSelf || isFollower
    if (!canViewFull) return NextResponse.json(EMPTY_PAGE(offset, limit))

    const { data: rawLoops, error: loopsError, count } = await supabase
      .from("loops")
      .select(PROFILE_LOOP_SELECT, { count: "exact" })
      .eq("author_id", profile.id)
      .is("parent_loop_id", null)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (loopsError) {
      console.error("Profile posts query error:", loopsError)
      return NextResponse.json({ error: "Could not load profile posts" }, { status: 500 })
    }

    const rows = rawLoops || []
    const followingIds = await getFollowingIds(supabase, authedUser?.id || null)
    const visibleAuthors = await filterPrivateContent(
      supabase,
      rows,
      authedUser?.id || null,
      followingIds,
    )
    const visibleRows = await filterCircleScopedContent(
      supabase,
      visibleAuthors,
      authedUser?.id || null,
    )

    // A hidden Loop is still visible everywhere else in the app; it only
    // disappears from this profile grid. Filtering after the page query keeps
    // the offset honest for every other post.
    const visibleLoops = (visibleRows || []).filter(
      (loop: any) => !Boolean(loop?.content_metadata?.profile_hidden),
    )

    const enriched = await enrichLoopsWithPollsAndDuels(supabase, visibleLoops)
    await attachParentAuthors(supabase, enriched)
    await applyRealCommentCounts(supabase, enriched)

    const nextOffset = offset + rows.length
    const total = typeof count === "number" ? count : nextOffset + (rows.length === limit ? 1 : 0)

    return NextResponse.json({
      success: true,
      loops: normalizeLoops(enriched),
      pagination: {
        offset,
        limit,
        total,
        next_offset: nextOffset,
        has_more: rows.length === limit && nextOffset < Math.max(total, nextOffset + 1),
      },
    })
  } catch (error) {
    console.error("GET /api/users/profile/posts error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
