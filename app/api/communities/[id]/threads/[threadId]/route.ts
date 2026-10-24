import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity } from "@/lib/community-engine"
import { loadRoleBadges } from "@/lib/community-permissions"
import { checkCirclePrivateAccess } from "@/lib/circle-access"
import { canComment, canMention, extractMentions, mentionableRoles, readPolicy } from "@/lib/community-policy"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const STAFF_ROLES = new Set(["owner", "admin", "moderator"])

/** `{ "🔥": [user_id, …] }` on the row → grouped chips for the message list. */
function groupCommentReactions(raw: unknown, viewerId: string | null) {
  let map: Record<string, unknown> = {}
  if (raw && typeof raw === "object" && !Array.isArray(raw)) map = raw as Record<string, unknown>
  else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) map = parsed
    } catch {
      /* a malformed map never breaks the thread */
    }
  }
  return Object.entries(map)
    .filter(([emoji, users]) => Boolean(emoji) && Array.isArray(users) && users.length > 0)
    .map(([emoji, users]) => {
      const ids = (users as unknown[]).map((u) => String(u))
      return {
        emoji,
        count: ids.length,
        users: ids.slice(0, 12),
        reacted: Boolean(viewerId && ids.includes(viewerId)),
      }
    })
    .filter((r) => r.count > 0)
}

async function loadMembership(sb: any, circleId: string, userId?: string | null) {
  if (!userId) return null
  const { data } = await sb
    .from("circle_members")
    .select("role, status")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle()
  return (data as { role: string | null; status: string | null } | null) || null
}

/**
 * GET /api/communities/[id]/threads/[threadId]
 * The discussion itself plus every visible reply, the viewer's permissions and
 * whether they already voted.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  try {
    const { id, threadId } = await params
    const sb = communityClient()

    const access = await checkCirclePrivateAccess(id, request.headers.get("authorization"))
    if (access.isPrivate && !access.canView) {
      return NextResponse.json({ error: "This community is private", locked: true }, { status: 403 })
    }

    const user = await getUserFromRequest(request)
    const membership = await loadMembership(sb, id, user?.id)
    const isMember = Boolean(membership && ["active", "approved"].includes(String(membership.status || "")))
    const isStaff = Boolean(membership?.role && STAFF_ROLES.has(membership.role))

    const { data: post, error } = await sb
      .from("circle_posts")
      .select(
        `id, circle_id, author_id, content, content_metadata, tags, media_url, media_urls, media_type,
         post_type, space_id, is_pinned, comments_locked, comment_count, like_count, view_count,
         status, created_at, updated_at, last_activity_at, feed_loop_id,
         author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, badge_id, equipped_frame_id),
         space:community_spaces!space_id(id, name, icon, type)`,
      )
      .eq("id", threadId)
      .eq("circle_id", id)
      .maybeSingle()

    if (error) {
      console.error("[thread] load error:", error.message)
      return NextResponse.json({ error: "Failed to load thread" }, { status: 500 })
    }
    if (!post) return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    if (String(post.status || "") === "hidden" && !isStaff) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const meta = (post.content_metadata || {}) as Record<string, any>
    const body = String(post.content || "")
    const hasOwnTitle = Boolean(meta.title)
    const firstLine = body.split("\n")[0] || ""
    const rawTitle = hasOwnTitle ? String(meta.title) : firstLine
    const clipped = rawTitle.length > 96 ? `${rawTitle.slice(0, 96).replace(/\s+\S*$/, "")}…` : rawTitle
    const title = String(clipped || "Untitled thread").slice(0, 160)

    // Views are a soft signal — never let a failed bump break the page.
    void sb
      .from("circle_posts")
      .update({ view_count: Number(post.view_count || 0) + 1 })
      .eq("id", threadId)
      .then(() => {})

    const { data: commentRows } = await sb
      .from("circle_post_comments")
      .select(
        `id, post_id, author_id, content, media_url, media_type, parent_comment_id, created_at, updated_at, hidden_at, reactions,
         author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, badge_id, equipped_frame_id)`,
      )
      .eq("post_id", threadId)
      .order("created_at", { ascending: true })
      .limit(400)

    const visible = (commentRows || []).filter((c: any) => !c.hidden_at || isStaff)
    const byId = new Map(visible.map((c: any) => [String(c.id), c]))

    // Role chips: the OP's and every replier's chip in one pass.
    const badges = await loadRoleBadges(
      sb,
      id,
      [post.author_id, ...visible.map((c: any) => c.author_id)].filter(Boolean),
    )

    const replies = visible.map((c: any) => {
      const rawAuthor = Array.isArray(c.author) ? c.author[0] : c.author
      const author = rawAuthor ? { ...rawAuthor, role_badge: badges[String(c.author_id)] || null } : null
      const parent = c.parent_comment_id ? byId.get(String(c.parent_comment_id)) : null
      const parentAuthorRaw = parent ? (Array.isArray(parent.author) ? parent.author[0] : parent.author) : null
      return {
        id: String(c.id),
        content: String(c.content || ""),
        media_url: c.media_url || null,
        media_type: c.media_type || null,
        created_at: c.created_at,
        hidden: Boolean(c.hidden_at),
        reactions: groupCommentReactions(c.reactions, user?.id || null),
        author,
        is_author: Boolean(user && c.author_id === user.id),
        parent: parent
          ? {
              id: String(parent.id),
              content: String(parent.content || "").slice(0, 180),
              author_name: parentAuthorRaw?.display_name || parentAuthorRaw?.username || "Member",
            }
          : null,
      }
    })

    // Upvotes: total + whether the viewer is one of them.
    const { data: votes } = await sb
      .from("circle_post_interactions")
      .select("user_id")
      .eq("post_id", threadId)
      .eq("interaction_type", "upvote")
    const voteCount = votes?.length || 0
    const viewerVoted = Boolean(user && votes?.some((v: any) => v.user_id === user.id))

    const rawAuthor = Array.isArray(post.author) ? post.author[0] : post.author
    const author = rawAuthor ? { ...rawAuthor, role_badge: badges[String(post.author_id)] || null } : null
    const space = Array.isArray(post.space) ? post.space[0] : post.space

    return NextResponse.json({
      thread: {
        id: String(post.id),
        title,
        body,
        tags: Array.isArray(post.tags) ? post.tags : [],
        media_url: post.media_url || (Array.isArray(post.media_urls) ? post.media_urls[0] : null) || null,
        media_type: post.media_type || null,
        author: author || null,
        forum: space ? { id: String(space.id), name: space.name, icon: space.icon } : null,
        pinned: Boolean(post.is_pinned),
        locked: Boolean(post.comments_locked),
        hidden: String(post.status || "") === "hidden",
        created_at: post.created_at,
        last_activity_at: post.last_activity_at || post.updated_at || post.created_at,
        replies_count: replies.length,
        votes: voteCount || Number(post.like_count || 0),
        views: Number(post.view_count || 0) + 1,
        shared_to_feed: Boolean(post.feed_loop_id),
      },
      replies,
      viewer: {
        is_member: isMember,
        is_staff: isStaff,
        can_manage: Boolean(isStaff || (user && String(post.author_id) === user.id)),
        is_author: Boolean(user && String(post.author_id) === user.id),
        voted: viewerVoted,
        role: membership?.role || null,
      },
    })
  } catch (e: any) {
    console.error("[thread] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load thread" }, { status: 500 })
  }
}

/** POST a reply to the thread. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  try {
    const { id, threadId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to reply" }, { status: 401 })

    const sb = communityClient()
    const membership = await loadMembership(sb, id, user.id)
    if (!membership || !["active", "approved"].includes(String(membership.status || ""))) {
      return NextResponse.json({ error: "Join this community to reply" }, { status: 403 })
    }

    const { data: post } = await sb
      .from("circle_posts")
      .select("id, author_id, comments_locked, comment_count, status")
      .eq("id", threadId)
      .eq("circle_id", id)
      .maybeSingle()

    if (!post) return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    if (post.comments_locked) return NextResponse.json({ error: "This thread is locked" }, { status: 403 })
    if (String(post.status || "") === "hidden") return NextResponse.json({ error: "Thread not found" }, { status: 404 })

    // House policy: which roles may comment here. Staff keep their powers.
    const { data: circleRow } = await sb
      .from("circles")
      .select("moderation_settings")
      .eq("id", id)
      .maybeSingle()
    const policy = readPolicy(circleRow?.moderation_settings)
    if (!canComment(membership.role, policy)) {
      return NextResponse.json({ error: "Only certain roles can comment in this community" }, { status: 403 })
    }

    const body = await request.json()
    const content = String(body.content || "").trim().slice(0, 8000)
    const mediaUrl = typeof body.media_url === "string" && body.media_url ? body.media_url.slice(0, 600) : null
    const mediaType = mediaUrl ? (body.media_type === "video" ? "video" : "image") : null
    // A reply can be media-only — a screenshot answers plenty of threads.
    if (!content && !mediaUrl) return NextResponse.json({ error: "Write a reply first" }, { status: 400 })

    let parentId: number | null = null
    const parentRaw = body.parent_comment_id ?? body.parent_id
    if (parentRaw != null) {
      const { data: parent } = await sb
        .from("circle_post_comments")
        .select("id")
        .eq("id", Number(parentRaw))
        .eq("post_id", threadId)
        .maybeSingle()
      if (parent) parentId = Number(parent.id)
    }

    const now = new Date().toISOString()
    const { data: reply, error } = await sb
      .from("circle_post_comments")
      .insert({
        circle_id: id,
        post_id: threadId,
        author_id: user.id,
        content,
        media_url: mediaUrl,
        media_type: mediaType,
        parent_comment_id: parentId,
        created_at: now,
        updated_at: now,
      })
      .select(
        `id, content, created_at, media_url, media_type, parent_comment_id,
         author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium, badge_id, equipped_frame_id)`,
      )
      .single()

    if (error || !reply) {
      console.error("[thread] reply error:", error?.message)
      return NextResponse.json({ error: error?.message || "Failed to post reply" }, { status: 500 })
    }

    // The message list renders the chip and the (empty) reaction row straight
    // from this payload, so a new reply looks like every other row.
    const badges = await loadRoleBadges(sb, id, [user.id])
    const replyAuthor = Array.isArray(reply.author) ? reply.author[0] : reply.author
    const shapedReply = {
      ...reply,
      reactions: [] as unknown[],
      author: replyAuthor ? { ...replyAuthor, role_badge: badges[user.id] || null } : null,
    }

    await sb
      .from("circle_posts")
      .update({ comment_count: Number(post.comment_count || 0) + 1, last_activity_at: now, updated_at: now })
      .eq("id", threadId)

    await logCommunityActivity(sb, id, user.id, "reply_posted", "post", threadId, { reply_id: String(reply.id) })

    // Notify the thread author (and the person being replied to) by name.
    try {
      const { notifyUser } = await import("@/lib/notifications")
      const { data: me } = await sb
        .from("profiles")
        .select("display_name, username")
        .eq("id", user.id)
        .maybeSingle()
      const myName = me?.display_name || me?.username || "A member"
      const recipients = new Set<string>()
      if (post.author_id && post.author_id !== user.id) recipients.add(String(post.author_id))
      if (parentId) {
        const { data: parent } = await sb
          .from("circle_post_comments")
          .select("author_id")
          .eq("id", parentId)
          .maybeSingle()
        if (parent?.author_id && parent.author_id !== user.id) recipients.add(String(parent.author_id))
      }
      await Promise.all(
        [...recipients].map((rid) =>
          notifyUser(sb, {
            userId: rid,
            type: "circle_post_comment",
            title: `${myName} replied in your community`,
            message: content.slice(0, 120),
            actorId: user.id,
            actionUrl: `/communities/${id}/posts/${threadId}`,
            data: { circle_id: id, post_id: threadId },
            pushCategory: "social",
          }),
        ),
      )
    } catch {
      /* notifications are best-effort */
    }

    // @mentions: the people named are told directly; naming a role fans the
    // notification out to everyone holding it (capped, so it stays a ping and
    // not a broadcast storm).
    try {
      if (content.includes("@") && canMention(membership.role, policy)) {
        const { notifyUser } = await import("@/lib/notifications")
        const { usernames, roles } = extractMentions(content)
        const mentioned = new Set<string>()

        if (usernames.length) {
          const { data: people } = await sb.from("profiles").select("id, username").in("username", usernames)
          for (const person of people || []) if (String(person.id) !== user.id) mentioned.add(String(person.id))
        }

        for (const role of mentionableRoles(roles, policy)) {
          const { data: holders } = await sb
            .from("circle_members")
            .select("user_id")
            .eq("circle_id", id)
            .eq("role", role)
            .in("status", ["active", "approved"])
            .limit(50)
          for (const holder of holders || []) if (String(holder.user_id) !== user.id) mentioned.add(String(holder.user_id))
        }

        if (mentioned.size) {
          await Promise.all(
            [...mentioned].map((rid) =>
              notifyUser(sb, {
                userId: rid,
                type: "community_mention",
                title: "You were mentioned in a community",
                message: (content || "Shared media in a reply").slice(0, 120),
                actorId: user.id,
                actionUrl: `/communities/${id}/posts/${threadId}`,
                data: { circle_id: id, post_id: threadId, reply_id: String(reply.id) },
                pushCategory: "social",
              }),
            ),
          )
        }
      }
    } catch {
      /* mentions are best-effort */
    }

    return NextResponse.json({
      reply: {
        id: String(reply.id),
        content: reply.content,
        created_at: reply.created_at,
        media_url: reply.media_url || null,
        media_type: reply.media_type || null,
        reactions: [],
        author: shapedReply.author,
        parent: null,
        hidden: false,
        is_author: true,
      },
    })
  } catch (e: any) {
    console.error("[thread] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to reply" }, { status: 500 })
  }
}

/** Moderation: pin / lock / hide / restore. Authors may delete their own thread. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  try {
    const { id, threadId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sb = communityClient()
    const membership = await loadMembership(sb, id, user.id)
    const isStaff = Boolean(membership?.role && STAFF_ROLES.has(membership.role))

    const { data: post } = await sb
      .from("circle_posts")
      .select("id, author_id")
      .eq("id", threadId)
      .eq("circle_id", id)
      .maybeSingle()
    if (!post) return NextResponse.json({ error: "Thread not found" }, { status: 404 })

    const body = await request.json()
    const action = String(body.action || "")
    const isAuthor = String(post.author_id) === user.id
    if (!isStaff && !isAuthor) return NextResponse.json({ error: "Not allowed" }, { status: 403 })

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    switch (action) {
      case "pin":
      case "unpin":
        if (!isStaff) return NextResponse.json({ error: "Only moderators can pin threads" }, { status: 403 })
        updates.is_pinned = action === "pin"
        break
      case "lock":
      case "unlock":
        if (!isStaff) return NextResponse.json({ error: "Only moderators can lock threads" }, { status: 403 })
        updates.comments_locked = action === "lock"
        break
      case "hide":
        if (!isStaff) return NextResponse.json({ error: "Only moderators can hide threads" }, { status: 403 })
        updates.status = "hidden"
        updates.hidden_at = new Date().toISOString()
        updates.hidden_by = user.id
        break
      case "restore":
        if (!isStaff) return NextResponse.json({ error: "Only moderators can restore threads" }, { status: 403 })
        updates.status = "published"
        updates.hidden_at = null
        updates.hidden_by = null
        break
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    const { error } = await sb.from("circle_posts").update(updates).eq("id", threadId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
      await sb.from("community_moderation_logs").insert({
        circle_id: id,
        moderator_id: user.id,
        action: `thread_${action}`,
        target_type: "post",
        target_id: String(threadId),
        details: {},
      })
    } catch {
      /* log is best-effort */
    }

    return NextResponse.json({ success: true, thread: { id: String(threadId), ...updates } })
  } catch (e: any) {
    console.error("[thread] PATCH error:", e)
    return NextResponse.json({ error: e.message || "Failed to update thread" }, { status: 500 })
  }
}

/** Delete a thread (author or staff). Replies cascade with the post. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  try {
    const { id, threadId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sb = communityClient()
    const membership = await loadMembership(sb, id, user.id)
    const isStaff = Boolean(membership?.role && STAFF_ROLES.has(membership.role))

    const { data: post } = await sb
      .from("circle_posts")
      .select("id, author_id")
      .eq("id", threadId)
      .eq("circle_id", id)
      .maybeSingle()
    if (!post) return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    if (!isStaff && String(post.author_id) !== user.id) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 })
    }

    await sb.from("circle_post_comments").delete().eq("post_id", threadId)
    await sb.from("circle_post_interactions").delete().eq("post_id", threadId)
    const { error } = await sb.from("circle_posts").delete().eq("id", threadId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[thread] DELETE error:", e)
    return NextResponse.json({ error: e.message || "Failed to delete thread" }, { status: 500 })
  }
}
