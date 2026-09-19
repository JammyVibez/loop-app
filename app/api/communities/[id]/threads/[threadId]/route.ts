import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity } from "@/lib/community-engine"
import { can, viewerAbilities } from "@/lib/community-permissions"
import { getUserFromRequest } from "@/lib/server-auth"

const FOLLOW_MODES = new Set(["all", "mentions", "none"])
const THREAD_STATES = new Set(["open", "decided", "archived"])
const THREAD_KINDS = new Set(["make", "decide", "ask", "show"])

async function loadThread(sb: any, circleId: string, threadId: string) {
  const { data } = await sb
    .from("community_threads")
    .select(
      `*,
       creator:profiles!created_by(id, username, display_name, avatar_url, is_verified, is_premium),
       decider:profiles!decided_by(id, username, display_name),
       space:community_spaces!space_id(id, name, icon, type)`,
    )
    .eq("id", threadId)
    .eq("circle_id", circleId)
    .maybeSingle()
  return data
}

/** GET — the thread plus the posts that landed in it. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  try {
    const { id, threadId } = await params
    const user = await getUserFromRequest(request)
    const sb = communityClient()

    const abilities = await viewerAbilities(sb, id, user?.id || null)
    const thread = await loadThread(sb, id, threadId)
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    if (thread.state === "archived" && !abilities.is_member) {
      return NextResponse.json({ error: "This thread is archived" }, { status: 403 })
    }

    const { data: posts } = await sb
      .from("circle_posts")
      .select(
        `id, content, media_urls, media_url, media_type, created_at, author_id, is_pinned,
         author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium, badge_id)`,
      )
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(60)

    let followMode: string | null = null
    if (user) {
      const { data: f } = await sb
        .from("community_thread_follows")
        .select("mode")
        .eq("thread_id", threadId)
        .eq("user_id", user.id)
        .maybeSingle()
      followMode = f?.mode || null
    }

    return NextResponse.json({
      thread: { ...thread, follow_mode: followMode },
      contributions: posts || [],
      can_manage: can(abilities.permissions, "thread.manage"),
      is_author: user ? thread.created_by === user.id : false,
      is_member: abilities.is_member,
    })
  } catch (e: any) {
    console.error("[thread] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load thread" }, { status: 500 })
  }
}

/**
 * PATCH — lifecycle + follow.
 *
 * `follow_mode` alone is a self-service preference any member can change;
 * everything else needs the Run any thread Power (or ownership of an open
 * thread's own title/prompt).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  try {
    const { id, threadId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const abilities = await viewerAbilities(sb, id, user.id)
    if (!abilities.is_member) return NextResponse.json({ error: "Join this community first" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const thread = await loadThread(sb, id, threadId)
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 })

    const isAuthor = thread.created_by === user.id
    const canManage = can(abilities.permissions, "thread.manage")
    const keys = Object.keys(body).filter((k) => body[k] !== undefined)
    const followOnly = keys.length > 0 && keys.every((k) => k === "follow_mode")

    // ── Follow preference: any member, for themselves ──
    if (followOnly) {
      const mode = FOLLOW_MODES.has(body.follow_mode) ? body.follow_mode : "all"
      await sb
        .from("community_thread_follows")
        .upsert({ thread_id: threadId, user_id: user.id, mode }, { onConflict: "thread_id,user_id" })
      return NextResponse.json({ ok: true, follow_mode: mode })
    }

    if (!canManage && !isAuthor) {
      return NextResponse.json({ error: "You don't have the Run any thread Power" }, { status: 403 })
    }

    const patch: Record<string, any> = { updated_at: new Date().toISOString() }

    if (body.title !== undefined) {
      const title = String(body.title).trim().slice(0, 120)
      if (title.length < 3) return NextResponse.json({ error: "Give the thread a title" }, { status: 400 })
      patch.title = title
    }
    if (body.prompt !== undefined) patch.prompt = String(body.prompt).trim().slice(0, 600)
    if (body.kind !== undefined && THREAD_KINDS.has(body.kind)) patch.kind = body.kind
    if (body.space_id !== undefined) patch.space_id = body.space_id ? Number(body.space_id) : null

    // Lifecycle: closing a thread records who decided it and when.
    if (body.state !== undefined) {
      if (!THREAD_STATES.has(body.state)) return NextResponse.json({ error: "Unknown thread state" }, { status: 400 })
      if (!canManage) return NextResponse.json({ error: "Only thread managers can move a thread" }, { status: 403 })
      patch.state = body.state
      if (body.state === "open") {
        patch.decided_at = null
        patch.archived_at = null
        patch.decided_by = null
      } else if (body.state === "decided") {
        patch.decided_at = new Date().toISOString()
        patch.archived_at = null
        patch.decided_by = user.id
      } else {
        patch.archived_at = new Date().toISOString()
      }
    }
    if (body.outcome !== undefined) patch.outcome = String(body.outcome).trim().slice(0, 600)
    if (body.is_pinned !== undefined) {
      if (!canManage) return NextResponse.json({ error: "Only thread managers can pin" }, { status: 403 })
      patch.is_pinned = Boolean(body.is_pinned)
    }

    // Live toggle — thread managers can start or end a live room.
    // Going live creates a REAL live_streams row so the thread reuses the
    // existing /streams/[id] WebRTC room (signaling, chat, viewers, media)
    // instead of a second, dead-end stack.
    if (body.is_live !== undefined && typeof body.is_live === "boolean") {
      if (!canManage)
        return NextResponse.json({ error: "Only thread managers can go live" }, { status: 403 })
      patch.is_live = body.is_live
      if (body.is_live) {
        patch.live_started_at = new Date().toISOString()
        patch.live_viewer_count = 0
        // Reuse an existing room row while it's still live; otherwise spin up
        // a fresh one owned by the thread manager.
        let streamId: string | null = thread.live_stream_id || null
        if (streamId) {
          const { data: existing } = await sb
            .from("live_streams")
            .select("id, status")
            .eq("id", streamId)
            .maybeSingle()
          if (!existing || existing.status === "ended") streamId = null
        }
        if (!streamId) {
          const { data: created, error: createErr } = await sb
            .from("live_streams")
            .insert({
              streamer_id: user.id,
              title: `Thread: ${thread.title}`.slice(0, 120),
              description: thread.prompt ? String(thread.prompt).slice(0, 500) : null,
              category: "community",
              stream_key: crypto.randomUUID(),
              status: "live",
              chat_enabled: true,
            })
            .select("id")
            .single()
          if (createErr || !created) {
            return NextResponse.json(
              { error: "Couldn't open the live room: " + (createErr?.message || "unknown") },
              { status: 500 },
            )
          }
          streamId = created.id
        }
        patch.live_stream_id = streamId
        patch.live_room_id = streamId
        if (body.live_stream_url !== undefined)
          patch.live_stream_url = String(body.live_stream_url || "").slice(0, 500)
      } else {
        patch.live_started_at = null
        patch.live_viewer_count = 0
        patch.live_stream_url = null
        // End the underlying room row so /streams/[id] shows "live has ended".
        if (thread.live_stream_id) {
          await sb
            .from("live_streams")
            .update({ status: "ended", ended_at: new Date().toISOString() })
            .eq("id", thread.live_stream_id)
            .eq("status", "live")
        }
      }
    } else if (body.live_stream_url !== undefined) {
      // Update the live stream URL without toggling the state.
      patch.live_stream_url = String(body.live_stream_url || "").slice(0, 500)
    }

    const { data: updated, error } = await sb
      .from("community_threads")
      .update(patch)
      .eq("id", threadId)
      .eq("circle_id", id)
      .select()
      .single()
    if (error || !updated) {
      return NextResponse.json({ error: "Failed to update thread: " + (error?.message || "") }, { status: 500 })
    }

    if (patch.state && patch.state !== thread.state) {
      await logCommunityActivity(sb, id, user.id, "thread_" + patch.state, "thread", threadId, {
        title: updated.title,
        outcome: updated.outcome || "",
      })
    }

    return NextResponse.json({ thread: updated })
  } catch (e: any) {
    console.error("[thread] PATCH error:", e)
    return NextResponse.json({ error: e.message || "Failed to update thread" }, { status: 500 })
  }
}

/** DELETE — thread managers only. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  try {
    const { id, threadId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const abilities = await viewerAbilities(sb, id, user.id)
    if (!can(abilities.permissions, "thread.manage")) {
      return NextResponse.json({ error: "You don't have the Run any thread Power" }, { status: 403 })
    }

    const { error } = await sb.from("community_threads").delete().eq("id", threadId).eq("circle_id", id)
    if (error) return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 })
    await logCommunityActivity(sb, id, user.id, "thread_deleted", "thread", threadId, {})
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[thread] DELETE error:", e)
    return NextResponse.json({ error: e.message || "Failed to delete thread" }, { status: 500 })
  }
}
