import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity } from "@/lib/community-engine"
import { can, viewerAbilities } from "@/lib/community-permissions"
import { getUserFromRequest } from "@/lib/server-auth"

const THREAD_KINDS = new Set(["make", "decide", "ask", "show"])
const THREAD_STATES = new Set(["open", "decided", "archived"])

/**
 * GET /api/communities/[id]/threads?state=open&space_id=1&q=&limit=30
 *
 * Threads are the community's unit of work: every one has a lifecycle, so the
 * list is filtered by state rather than paged forever.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    const sb = communityClient()

    const { data: circle } = await sb.from("circles").select("id, is_private").eq("id", id).maybeSingle()
    if (!circle) return NextResponse.json({ error: "Community not found" }, { status: 404 })

    const abilities = await viewerAbilities(sb, id, user?.id || null)
    if (circle.is_private && !abilities.is_member) {
      return NextResponse.json({ error: "This community is private", locked: true }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const rawState = searchParams.get("state") || "all"
    const state = THREAD_STATES.has(rawState) ? rawState : "all"
    const spaceId = searchParams.get("space_id")
    const q = (searchParams.get("q") || "").trim()
    const limit = Math.min(60, Math.max(1, Number(searchParams.get("limit") || 30) || 30))

    let query = sb
      .from("community_threads")
      .select(`
        *,
        creator:profiles!created_by(id, username, display_name, avatar_url, is_verified, is_premium),
        decider:profiles!decided_by(id, username, display_name),
        space:community_spaces!space_id(id, name, icon, type)
      `)
      .eq("circle_id", id)
      .order("is_pinned", { ascending: false })
      .order("last_activity_at", { ascending: false })
      .limit(limit)

    if (state !== "all") query = query.eq("state", state)
    if (spaceId) query = query.eq("space_id", spaceId)
    if (q) query = query.ilike("title", `%${q.replace(/[%,]/g, "")}%`)

    const { data: threads, error } = await query
    if (error) return NextResponse.json({ error: "Failed to load threads" }, { status: 500 })

    // What the viewer is following, so the bell icon can render correctly.
    let follows: Record<string, string> = {}
    if (user && (threads || []).length) {
      const { data } = await sb
        .from("community_thread_follows")
        .select("thread_id, mode")
        .eq("user_id", user.id)
        .in(
          "thread_id",
          (threads || []).map((t: any) => t.id),
        )
      follows = Object.fromEntries((data || []).map((f: any) => [String(f.thread_id), f.mode]))
    }

    const list = (threads || []).map((t: any) => ({ ...t, follow_mode: follows[String(t.id)] || null }))

    return NextResponse.json({
      threads: list,
      counts: {
        open: list.filter((t: any) => t.state === "open").length,
        decided: list.filter((t: any) => t.state === "decided").length,
        archived: list.filter((t: any) => t.state === "archived").length,
      },
      can_manage: can(abilities.permissions, "thread.manage"),
      can_create: can(abilities.permissions, "thread.create") || can(abilities.permissions, "thread.manage"),
    })
  } catch (e: any) {
    console.error("[threads] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load threads" }, { status: 500 })
  }
}

/** POST — open a thread. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to open a thread" }, { status: 401 })
    const sb = communityClient()

    const abilities = await viewerAbilities(sb, id, user.id)
    if (!abilities.is_member) return NextResponse.json({ error: "Join this community first" }, { status: 403 })
    if (!can(abilities.permissions, "thread.create") && !can(abilities.permissions, "thread.manage")) {
      return NextResponse.json({ error: "You don't have the Open threads Power" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const title = String(body.title || "").trim().slice(0, 120)
    if (title.length < 3) return NextResponse.json({ error: "Give the thread a title" }, { status: 400 })

    const kind = THREAD_KINDS.has(body.kind) ? body.kind : "make"
    let spaceId: number | null = body.space_id ? Number(body.space_id) : null
    if (spaceId) {
      const { data: space } = await sb
        .from("community_spaces")
        .select("id")
        .eq("id", spaceId)
        .eq("circle_id", id)
        .maybeSingle()
      if (!space) spaceId = null
    }

    const { data: thread, error } = await sb
      .from("community_threads")
      .insert({
        circle_id: Number(id),
        space_id: spaceId,
        title,
        prompt: String(body.prompt || "").trim().slice(0, 600),
        kind,
        state: "open",
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !thread) {
      return NextResponse.json({ error: "Failed to open thread: " + (error?.message || "") }, { status: 500 })
    }

    // The author follows what they opened, by default.
    await sb
      .from("community_thread_follows")
      .upsert({ thread_id: thread.id, user_id: user.id, mode: "all" }, { onConflict: "thread_id,user_id" })

    await logCommunityActivity(sb, id, user.id, "thread_opened", "thread", thread.id, { title: thread.title, kind })
    return NextResponse.json({ thread: { ...thread, follow_mode: "all" } }, { status: 201 })
  } catch (e: any) {
    console.error("[threads] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to open thread" }, { status: 500 })
  }
}
