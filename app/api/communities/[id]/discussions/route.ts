import { type NextRequest, NextResponse } from "next/server"
import { communityClient } from "@/lib/community-engine"
import { checkCirclePrivateAccess } from "@/lib/circle-access"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/communities/[id]/discussions
 *
 * The community home is a list of persistent discussions. A discussion is
 * either a community post (circle_posts — the thread with real replies) or a
 * Loop created inside the community (a Duel, a published Co-Loop). Both are
 * returned in one normalized shape so the home reads as one place instead of
 * two disconnected feeds.
 *
 * Posts that were explicitly shared to the Loop feed are excluded from the
 * Loop side of the list (they are the same discussion) so nothing renders
 * twice.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = communityClient()

    const { data: circle } = await sb
      .from("circles")
      .select("id, name, handle, is_private, is_active")
      .eq("id", id)
      .maybeSingle()

    if (!circle) return NextResponse.json({ error: "Community not found" }, { status: 404 })

    // Private communities keep discussions behind approval.
    const access = await checkCirclePrivateAccess(id, request.headers.get("authorization"))
    if (access.isPrivate && !access.canView) {
      return NextResponse.json({ error: "This community is private", locked: true }, { status: 403 })
    }

    const user = await getUserFromRequest(request)

    let membershipRole: string | null = null
    let membershipStatus: string | null = null
    if (user) {
      const { data: membership } = await sb
        .from("circle_members")
        .select("role, status")
        .eq("circle_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
      membershipRole = membership?.role || null
      membershipStatus = membership?.status || null
    }
    const isMember = Boolean(user) && (membershipStatus === "active" || membershipStatus === "approved")
    const isStaff = ["owner", "admin", "moderator"].includes(membershipRole || "")

    const { searchParams } = new URL(request.url)
    const topic = searchParams.get("topic") || "all"
    const sort = searchParams.get("sort") || "active"
    const q = (searchParams.get("q") || "").trim()
    // A term PostgREST's `or`/`ilike` string cannot digest is left out rather
    // than breaking the whole list.
    const safeQ = q.replace(/[%,()]/g, " ").trim()
    const limit = Math.min(60, Math.max(1, Number(searchParams.get("limit") || 30) || 30))
    const offset = Math.max(0, Number(searchParams.get("offset") || 0) || 0)

    // ── Community posts (the discussions with real reply threads) ──
    let postQuery = sb
      .from("circle_posts")
      .select(
        `id, author_id, content, media_url, media_urls, media_type, post_type, content_metadata,
         space_id, is_pinned, comment_count, like_count, share_count, status, comments_locked,
         created_at, updated_at, last_activity_at, feed_loop_id,
         author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, badge_id, equipped_frame_id),
         space:community_spaces!space_id(id, name, icon, type)`,
      )
      .eq("circle_id", id)

    if (!isStaff) postQuery = postQuery.or("status.is.null,status.eq.published")
    if (topic === "general") postQuery = postQuery.is("space_id", null)
    else if (topic !== "all") postQuery = postQuery.eq("space_id", Number(topic))
    if (safeQ) postQuery = postQuery.ilike("content", `%${safeQ}%`)

    const { data: postRows, error: postError } = await postQuery
      .order("is_pinned", { ascending: false })
      .order("last_activity_at", { ascending: false })
      .limit(limit + offset)

    if (postError) {
      console.error("[discussions] posts error:", postError.message)
      return NextResponse.json({ error: "Failed to load discussions" }, { status: 500 })
    }

    // ── Loops born inside this community (duels, Co-Loops, shared posts) ──
    // Posts shared to the feed are the same discussion, so their mirror Loop is
    // filtered out below via content_metadata.mirror_post_id.
    // Loops carried no topic of their own when they were created from a space,
    // so they surface in All / General and stay out of a named space.
    const includeLoops = topic === "all" || topic === "general"

    let loopQuery = sb
      .from("loops")
      .select(
        `id, author_id, content, content_text, content_title, media_url, media_urls, content_type, post_type,
         visibility, created_at, updated_at, content_metadata,
         author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium, badge_id),
         loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)`,
      )
      .eq("circle_id", id)

    if (safeQ) loopQuery = loopQuery.ilike("content_text", `%${safeQ}%`)

    const { data: loopRows } = includeLoops
      ? await loopQuery.order("created_at", { ascending: false }).limit(limit + offset)
      : { data: [] }

    type Item = {
      key: string
      source: "post" | "loop"
      id: string
      title: string
      excerpt: string
      post_type: string
      author: any
      space: { id: string | number; name: string; icon?: string | null } | null
      created_at: string
      last_activity_at: string
      reply_count: number
      like_count: number
      is_pinned: boolean
      locked: boolean
      shared_to_feed: boolean
      can_manage_share: boolean
      href: string
      media_url: string | null
      media_type: string | null
      status: string | null
    }

    const items: Item[] = []

    for (const p of postRows || []) {
      const author = Array.isArray(p.author) ? p.author[0] : p.author
      const space = Array.isArray(p.space) ? p.space[0] : p.space
      const content = String(p.content || "").trim()
      items.push({
        key: `post:${p.id}`,
        source: "post",
        id: String(p.id),
        title: content.split("\n")[0].slice(0, 140) || "Untitled discussion",
        excerpt: content.length > 140 ? content.slice(0, 280) : content,
        post_type: String(p.post_type || "discussion"),
        author,
        space: space || null,
        created_at: p.created_at,
        last_activity_at: p.last_activity_at || p.updated_at || p.created_at,
        reply_count: Number(p.comment_count || 0),
        like_count: Number(p.like_count || 0),
        is_pinned: Boolean(p.is_pinned),
        locked: Boolean(p.comments_locked),
        shared_to_feed: Boolean(p.feed_loop_id),
        // A private community can never reach the public feed, so it offers no
        // share control even to its own author.
        can_manage_share: Boolean(user && !circle.is_private && (p.author_id === user.id || isStaff)),
        href: `/communities/${id}/posts/${p.id}`,
        media_url: p.media_url || (Array.isArray(p.media_urls) ? p.media_urls[0] : null) || null,
        media_type: p.media_type || null,
        status: p.status || null,
      })
    }

    for (const l of loopRows || []) {
      const meta = (l.content_metadata || {}) as Record<string, any>
      if (meta.mirror_post_id) continue // same discussion as a community post
      const author = Array.isArray(l.author) ? l.author[0] : l.author
      const stats = Array.isArray(l.loop_stats) ? l.loop_stats[0] : l.loop_stats
      const text = String(l.content_text || l.content || "").trim()
      const title = String(l.content_title || text.split("\n")[0] || "").slice(0, 140)
      const isCoLoop = Boolean(meta.is_co_loop) || (Array.isArray(meta.co_authors) && meta.co_authors.length > 0)
      const type = isCoLoop ? "coloop" : String(l.post_type || l.content_type || "discussion")
      items.push({
        key: `loop:${l.id}`,
        source: "loop",
        id: String(l.id),
        title: title || "Untitled",
        excerpt: text.length > 160 ? text.slice(0, 280) : text,
        post_type: type === "standard" ? "discussion" : type,
        author,
        space: null,
        created_at: l.created_at,
        last_activity_at: l.updated_at || l.created_at,
        reply_count: Number(stats?.comments_count || 0) + Number(stats?.branches_count || 0),
        like_count: Number(stats?.likes_count || 0),
        is_pinned: false,
        locked: false,
        shared_to_feed: String(l.visibility || "public") === "public",
        can_manage_share: Boolean(user && !circle.is_private && l.author_id === user.id),
        href: `/loop/${l.id}`,
        media_url: l.media_url || (Array.isArray(l.media_urls) ? l.media_urls[0] : null) || null,
        media_type: l.content_type || null,
        status: null,
      })
    }

    // Pinned first, then the chosen ordering.
    const time = (v: string | null | undefined) => new Date(v || 0).getTime()
    items.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
      if (sort === "recent") return time(b.created_at) - time(a.created_at)
      if (sort === "replies") return b.reply_count - a.reply_count
      if (sort === "unanswered") {
        const aEmpty = a.reply_count === 0 ? 0 : 1
        const bEmpty = b.reply_count === 0 ? 0 : 1
        if (aEmpty !== bEmpty) return aEmpty - bEmpty
        return time(b.created_at) - time(a.created_at)
      }
      return time(b.last_activity_at) - time(a.last_activity_at)
    })

    const page = items.slice(offset, offset + limit)

    // Topic areas are the community's existing spaces, with real counts.
    const { data: spaces } = await sb
      .from("community_spaces")
      .select("id, name, icon, type, sort_order")
      .eq("circle_id", id)
      .eq("is_archived", false)
      .order("sort_order")

    const countsBySpace = new Map<string, number>()
    let generalCount = 0
    for (const p of postRows || []) {
      const key = p.space_id == null ? "general" : String(p.space_id)
      if (key === "general") generalCount += 1
      else countsBySpace.set(key, (countsBySpace.get(key) || 0) + 1)
    }

    const topics = [
      { id: "all", name: "All discussions", icon: "messages-square", type: "discussion", count: items.length },
      { id: "general", name: "General", icon: "hash", type: "discussion", count: generalCount },
      ...(spaces || []).map((s: any) => ({
        id: String(s.id),
        name: s.name,
        icon: s.icon || "hash",
        type: s.type || "discussion",
        count: countsBySpace.get(String(s.id)) || 0,
      })),
    ]

    const replyTotal = page.reduce((n, i) => n + i.reply_count, 0)
    const unanswered = page.filter((i) => i.reply_count === 0).length

    return NextResponse.json({
      discussions: page,
      topics,
      hasMore: items.length > offset + limit,
      total: items.length,
      counts: {
        discussions: items.length,
        replies: replyTotal,
        unanswered,
        shared_to_feed: items.filter((i) => i.shared_to_feed).length,
      },
      can_post: isMember,
      can_share_to_feed: !circle.is_private,
      is_member: isMember,
      is_staff: isStaff,
      role: membershipRole,
    })
  } catch (e: any) {
    console.error("[discussions] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load discussions" }, { status: 500 })
  }
}
