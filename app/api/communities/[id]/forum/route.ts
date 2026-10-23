import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity } from "@/lib/community-engine"
import { checkCirclePrivateAccess } from "@/lib/circle-access"
import { getUserFromRequest } from "@/lib/server-auth"
import { normalizeRules } from "@/lib/community-rules"

export const dynamic = "force-dynamic"

/**
 * The community forum.
 *
 * One thread list built from `circle_posts` (a thread is a post with a title in
 * `content_metadata.title`), one forum list built from `community_spaces`, and
 * the community's live Co-Loops and Duels surfaced beside them so the place
 * reads as one room instead of several disconnected modules.
 */

const STAFF_ROLES = new Set(["owner", "admin", "moderator"])

type MemberRole = { role: string | null; status: string | null } | null

function isActiveMember(m: MemberRole) {
  return Boolean(m && ["active", "approved"].includes(String(m.status || "")))
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = communityClient()

    const { data: circle } = await sb
      .from("circles")
      .select(
        `id, name, handle, description, avatar_url, banner_url, cover_url, category, tags, rules,
         is_private, is_verified, is_active, member_count, post_count, owner_id, creator_id,
         accent_color, created_at, welcome_message, moderation_settings`,
      )
      .eq("id", id)
      .maybeSingle()

    if (!circle) return NextResponse.json({ error: "Community not found" }, { status: 404 })

    const access = await checkCirclePrivateAccess(id, request.headers.get("authorization"))
    if (access.isPrivate && !access.canView) {
      return NextResponse.json({ error: "This community is private", locked: true }, { status: 403 })
    }

    const user = await getUserFromRequest(request)

    let membership: MemberRole = null
    if (user) {
      const { data } = await sb
        .from("circle_members")
        .select("role, status")
        .eq("circle_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
      membership = (data as MemberRole) || null
    }

    const isMember = isActiveMember(membership)
    const role = membership?.role || null
    const isStaff = Boolean(role && STAFF_ROLES.has(role))
    const canManage = Boolean(user && (isStaff || String(circle.owner_id) === user.id || String(circle.creator_id) === user.id))

    const { searchParams } = new URL(request.url)
    const sort = searchParams.get("sort") || "latest"
    const forum = searchParams.get("forum") || "all"
    const q = (searchParams.get("q") || "").trim().replace(/[%,()]/g, " ").trim()
    const limit = Math.min(40, Math.max(1, Number(searchParams.get("limit") || 20) || 20))

    // ── Threads ──
    let threadQuery = sb
      .from("circle_posts")
      .select(
        `id, author_id, content, content_metadata, tags, post_type, space_id, is_pinned,
         comments_locked, comment_count, like_count, view_count, status, created_at, updated_at,
         last_activity_at, feed_loop_id,
         author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, badge_id, equipped_frame_id),
         space:community_spaces!space_id(id, name, icon, type)`,
      )
      .eq("circle_id", id)

    // Hidden threads stay invisible unless a moderator is looking.
    if (!isStaff) threadQuery = threadQuery.or("status.is.null,status.eq.published")

    if (forum === "unanswered") threadQuery = threadQuery.eq("comment_count", 0)
    else if (forum !== "all") threadQuery = threadQuery.eq("space_id", Number(forum))

    if (q) threadQuery = threadQuery.ilike("content", `%${q}%`)

    const orderBy: Record<string, { column: string; ascending: boolean }> = {
      latest: { column: "last_activity_at", ascending: false },
      newest: { column: "created_at", ascending: false },
      top: { column: "like_count", ascending: false },
      views: { column: "view_count", ascending: false },
      oldest: { column: "created_at", ascending: true },
    }
    const order = orderBy[sort] || orderBy.latest

    const { data: threadRows, error: threadError } = await threadQuery
      .order("is_pinned", { ascending: false })
      .order(order.column, { ascending: order.ascending })
      .limit(limit)

    if (threadError) {
      console.error("[forum] threads error:", threadError.message)
      return NextResponse.json({ error: "Failed to load threads" }, { status: 500 })
    }

    const threads = (threadRows || []).map((p: any) => {
      const meta = (p.content_metadata || {}) as Record<string, any>
      const author = Array.isArray(p.author) ? p.author[0] : p.author
      const space = Array.isArray(p.space) ? p.space[0] : p.space
      const body = String(p.content || "").trim()
      const hasOwnTitle = Boolean(meta.title)
      const firstLine = body.split("\n")[0] || ""
      // Threads written before the forum stored no title of their own — give
      // them a readable headline instead of dumping 160 characters of body
      // into the list, and keep the full text as the excerpt.
      const rawTitle = hasOwnTitle ? String(meta.title) : firstLine
      const clipped = rawTitle.length > 96 ? `${rawTitle.slice(0, 96).replace(/\s+\S*$/, "")}…` : rawTitle
      const title = String(clipped || "Untitled thread").slice(0, 160)
      return {
        id: String(p.id),
        title,
        excerpt: (hasOwnTitle ? body : body).trim().slice(0, 220),
        author: author || null,
        forum: space ? { id: String(space.id), name: space.name, icon: space.icon, type: space.type } : null,
        tags: Array.isArray(p.tags) ? p.tags.filter(Boolean).slice(0, 4) : [],
        replies: Number(p.comment_count || 0),
        votes: Number(p.like_count || 0),
        views: Number(p.view_count || 0),
        pinned: Boolean(p.is_pinned),
        locked: Boolean(p.comments_locked),
        post_type: String(p.post_type || "thread"),
        created_at: p.created_at,
        last_activity_at: p.last_activity_at || p.updated_at || p.created_at,
        shared_to_feed: Boolean(p.feed_loop_id),
      }
    })

    // ── Forums (spaces) with live thread counts ──
    const { data: spaceRows } = await sb
      .from("community_spaces")
      .select("id, name, icon, type, description, sort_order, is_archived")
      .eq("circle_id", id)
      .eq("is_archived", false)
      .order("sort_order")

    // One cheap pass over every thread's space_id gives real counts without a
    // query per forum.
    const { data: allThreadSpaces } = await sb
      .from("circle_posts")
      .select("space_id")
      .eq("circle_id", id)
      .limit(2000)

    const countBySpace = new Map<string, number>()
    for (const row of allThreadSpaces || []) {
      const key = row.space_id == null ? "general" : String(row.space_id)
      countBySpace.set(key, (countBySpace.get(key) || 0) + 1)
    }
    const totalThreads = allThreadSpaces?.length || 0

    // Real unanswered count — the tab should not lie about an empty queue.
    const { count: unansweredCount } = await sb
      .from("circle_posts")
      .select("id", { count: "exact", head: true })
      .eq("circle_id", id)
      .eq("comment_count", 0)

    const forums = [
      { id: "all", name: "All threads", icon: "messages-square", type: "forum", description: null, count: totalThreads },
      { id: "unanswered", name: "Unanswered", icon: "circle-help", type: "forum", description: null, count: unansweredCount || 0 },
      ...(spaceRows || []).map((s: any) => ({
        id: String(s.id),
        name: s.name,
        icon: s.icon || "hash",
        type: s.type || "forum",
        description: s.description || null,
        count: countBySpace.get(String(s.id)) || 0,
      })),
    ]

    // ── Staff, members ──
    const { data: staffRows } = await sb
      .from("circle_members")
      .select(`role, user:profiles!user_id(id, username, display_name, avatar_url, is_verified, is_premium)`)
      .eq("circle_id", id)
      .in("role", ["owner", "admin", "moderator"])
      .in("status", ["active", "approved"])
      .limit(12)

    const staff = (staffRows || []).map((m: any) => ({
      role: m.role,
      user: Array.isArray(m.user) ? m.user[0] : m.user,
    })).filter((m) => m.user)

    const { data: memberRows } = await sb
      .from("circle_members")
      .select(`user:profiles!user_id(id, username, display_name, avatar_url, is_verified, is_premium)`)
      .eq("circle_id", id)
      .eq("status", "active")
      .order("joined_at", { ascending: false })
      .limit(14)

    const members = (memberRows || []).map((m: any) => (Array.isArray(m.user) ? m.user[0] : m.user)).filter(Boolean)

    // ── Live Co-Loops ──
    const { data: coloopRows } = await sb
      .from("circle_coloop_sessions")
      .select(`id, session_id, title, description, status, created_by, created_at,
               creator:profiles!created_by(id, username, display_name, avatar_url)`)
      .eq("circle_id", id)
      .order("created_at", { ascending: false })
      .limit(5)

    const coloops = (coloopRows || []).map((c: any) => ({
      id: String(c.id),
      session_id: c.session_id,
      title: c.title,
      description: c.description,
      status: c.status,
      created_at: c.created_at,
      creator: Array.isArray(c.creator) ? c.creator[0] : c.creator,
    }))

    // ── Duels born in this community ──
    const { data: duelRows } = await sb
      .from("loop_duels")
      .select(`id, loop_id, prompt, status, created_at, expires_at, creator_id,
               creator:profiles!creator_id(id, username, display_name, avatar_url),
               entries:loop_duel_entries(id, side, votes_count)`)
      .eq("circle_id", id)
      .order("created_at", { ascending: false })
      .limit(5)

    const duels = (duelRows || []).map((d: any) => {
      const entries = Array.isArray(d.entries) ? d.entries : []
      return {
        id: String(d.id),
        loop_id: d.loop_id ? String(d.loop_id) : null,
        prompt: d.prompt,
        status: d.status,
        created_at: d.created_at,
        expires_at: d.expires_at,
        creator: Array.isArray(d.creator) ? d.creator[0] : d.creator,
        votes: entries.reduce((n: number, e: any) => n + Number(e.votes_count || 0), 0),
        entrants: entries.length,
      }
    })

    return NextResponse.json({
      community: {
        ...circle,
        rules: normalizeRules(circle.rules),
        id: String(circle.id),
        member_count: Number(circle.member_count || 0),
        post_count: Number(circle.post_count || 0),
      },
      viewer: {
        is_member: isMember,
        can_post: isMember,
        is_staff: isStaff,
        can_manage: canManage,
        role,
      },
      threads,
      forums,
      staff,
      members,
      coloops,
      duels,
      hasMore: threads.length >= limit,
      counts: {
        threads: totalThreads,
        replies: threads.reduce((n, t) => n + t.replies, 0),
        members: Number(circle.member_count || 0),
      },
    })
  } catch (e: any) {
    console.error("[forum] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load forum" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to start a thread" }, { status: 401 })

    const sb = communityClient()

    const { data: membership } = await sb
      .from("circle_members")
      .select("role, status")
      .eq("circle_id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    const member = membership as MemberRole
    if (!isActiveMember(member)) {
      return NextResponse.json({ error: "Join this community to start a thread" }, { status: 403 })
    }

    const body = await request.json()
    const title = String(body.title || "").trim().slice(0, 160)
    const content = String(body.content || "").trim()
    const spaceId = body.space_id != null && String(body.space_id) !== "all" ? Number(body.space_id) : null
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: any) => String(t).trim().replace(/^#/, "").slice(0, 24)).filter(Boolean).slice(0, 5)
      : []

    if (title.length < 3) return NextResponse.json({ error: "Give the thread a title (3+ characters)" }, { status: 400 })
    if (!content && !body.media_url) return NextResponse.json({ error: "Write something in the thread" }, { status: 400 })

    if (spaceId != null) {
      const { data: space } = await sb
        .from("community_spaces")
        .select("id")
        .eq("id", spaceId)
        .eq("circle_id", id)
        .maybeSingle()
      if (!space) return NextResponse.json({ error: "That forum does not belong to this community" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data: thread, error } = await sb
      .from("circle_posts")
      .insert({
        circle_id: id,
        author_id: user.id,
        content,
        post_type: "thread",
        space_id: spaceId,
        tags,
        content_metadata: { title },
        status: "published",
        comment_count: 0,
        like_count: 0,
        view_count: 0,
        last_activity_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("id, created_at")
      .single()

    if (error || !thread) {
      console.error("[forum] create thread error:", error?.message)
      return NextResponse.json({ error: error?.message || "Failed to create thread" }, { status: 500 })
    }

    await logCommunityActivity(sb, id, user.id, "thread_created", "post", String(thread.id), { title })

    return NextResponse.json({ thread: { id: String(thread.id), title, href: `/communities/${id}/posts/${thread.id}` } })
  } catch (e: any) {
    console.error("[forum] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to create thread" }, { status: 500 })
  }
}
