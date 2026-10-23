import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { maskAuthor } from "@/lib/user-status"
import { getUserFromRequest } from "@/lib/server-auth"
import { realQuoteCounts } from "@/lib/loop-stats"

export const dynamic = "force-dynamic"

/**
 * GET /api/loops/quotes?ids=id1,id2
 *
 * Quote posts only store `quoted_loop_id`. The feed renders the embedded
 * original by asking for it here, so the quoted post is always read live from
 * its own row — never duplicated into the quote, and never stale.
 *
 * Visibility follows the quoted post: private posts are never returned, and a
 * community post is only returned to its members or its author.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ids = Array.from(
      new Set(
        (searchParams.get("ids") || "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ).slice(0, 24)

    if (ids.length === 0) return NextResponse.json({ success: true, quotes: [] })

    const supabase = createServerClient()
    const user = await getUserFromRequest(request)

    const { data, error } = await supabase
      .from("loops")
      .select(`
        id, author_id, content_text, content_title, content_type, content_media_url, media_url, media_type,
        visibility, circle_id, created_at, hashtags, quote_count, content_metadata,
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count),
        author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, is_team_member, is_deleted, deletion_executed_at, is_banned)
      `)
      .in("id", ids)

    if (error) {
      console.error("[loops/quotes] lookup failed:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Recompute each quoted post's rebranch count from live quote rows so the
    // card never shows a stale denormalized counter.
    const quoteCounts = await realQuoteCounts(supabase, (data || []).map((r: any) => r.id))

    // Membership, per community, for the ones the viewer is not the author of.
    const circleIds = Array.from(
      new Set((data || []).map((r: any) => r.circle_id).filter(Boolean).map(String)),
    )
    const memberOf = new Set<string>()
    if (user && circleIds.length) {
      const { data: memberships } = await supabase
        .from("circle_members")
        .select("circle_id, status")
        .eq("user_id", user.id)
        .in("circle_id", circleIds)
      for (const m of memberships || []) {
        if (m.status === "active" || m.status === "approved") memberOf.add(String(m.circle_id))
      }
    }

    const quotes = (data || []).map((row: any) => {
      const author = maskAuthor(row.author) || {}
      const isAuthor = user?.id === row.author_id
      const visible =
        row.visibility !== "private" &&
        (row.visibility !== "circle" || isAuthor || memberOf.has(String(row.circle_id)))

      if (!visible) {
        // Returned as a tombstone so the card can say why, without leaking a
        // single character of the post.
        return { id: row.id, restricted: true }
      }

      // Multi-media lives either in content_metadata.media_urls or on the
      // single media column; the card renders whichever set the post has.
      const metadataUrls = Array.isArray(row.content_metadata?.media_urls)
        ? row.content_metadata.media_urls.filter((u: unknown) => typeof u === "string" && u)
        : []
      const primaryMedia = row.content_media_url || row.media_url || null
      const mediaUrls: string[] =
        metadataUrls.length > 0 ? metadataUrls : primaryMedia ? [primaryMedia] : []

      const stats = Array.isArray(row.loop_stats) ? row.loop_stats[0] : row.loop_stats

      return {
        id: row.id,
        author_id: row.author_id,
        restricted: false,
        text: row.content_text || "",
        title: row.content_title || null,
        media_url: primaryMedia,
        media_type: row.content_type || row.media_type || "text",
        media_urls: mediaUrls,
        created_at: row.created_at,
        hashtags: Array.isArray(row.hashtags)
          ? row.hashtags.filter((tag: unknown) => typeof tag === "string" && tag).slice(0, 6)
          : [],
        stats: {
          likes: Number(stats?.likes_count || 0),
          comments: Number(stats?.comments_count || 0),
          branches: Number(stats?.branches_count || 0),
          views: Number(stats?.views_count || 0),
          quotes: Number(quoteCounts.get(row.id) ?? row.quote_count ?? 0),
        },
        author: {
          username: author.username || "unknown",
          display_name: author.display_name || author.username || "Unknown",
          avatar_url: author.avatar_url || null,
          is_verified: Boolean(author.is_verified),
          is_premium: Boolean(author.is_premium),
          is_team_member: Boolean(author.is_team_member),
          is_deleted: Boolean(author.is_deleted || author.deletion_executed_at),
        },
      }
    })

    return NextResponse.json({ success: true, quotes })
  } catch (error: any) {
    console.error("[loops/quotes] GET error:", error)
    return NextResponse.json({ error: error?.message || "Failed to load quoted posts" }, { status: 500 })
  }
}
