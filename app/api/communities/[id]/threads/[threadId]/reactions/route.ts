import { type NextRequest, NextResponse } from "next/server"
import { communityClient } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/communities/[id]/threads/[threadId]/reactions
 * body: { comment_id, emoji }
 *
 * Toggles one emoji on one reply. The map lives on the comment row as
 * `{ "<emoji>": [user_id, …] }` — the same shape the community room chat uses
 * — so the thread load stays one query and the reply list can render chips
 * inline with the message.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  try {
    const { id, threadId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to react" }, { status: 401 })

    const sb = communityClient()

    const { data: membership } = await sb
      .from("circle_members")
      .select("status")
      .eq("circle_id", id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!membership || !["active", "approved"].includes(String(membership.status || ""))) {
      return NextResponse.json({ error: "Join this community to react" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const emoji = String(body.emoji || "").trim().slice(0, 8)
    const commentId = Number(body.comment_id)
    if (!emoji) return NextResponse.json({ error: "Pick an emoji" }, { status: 400 })
    if (!commentId) return NextResponse.json({ error: "Missing comment" }, { status: 400 })

    // The comment must belong to this thread in this community — a valid id
    // from somewhere else is not enough.
    const { data: comment } = await sb
      .from("circle_post_comments")
      .select("id, reactions")
      .eq("id", commentId)
      .eq("post_id", threadId)
      .eq("circle_id", id)
      .maybeSingle()
    if (!comment) return NextResponse.json({ error: "That reply no longer exists" }, { status: 404 })

    let current: Record<string, unknown> = {}
    const raw = comment.reactions
    if (raw && typeof raw === "object" && !Array.isArray(raw)) current = raw as Record<string, unknown>
    else if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) current = parsed
      } catch {
        /* start from an empty map */
      }
    }

    const users = Array.isArray(current[emoji]) ? (current[emoji] as unknown[]).map((u) => String(u)) : []
    const has = users.includes(user.id)
    const nextUsers = has ? users.filter((u) => u !== user.id) : [...users, user.id]

    const next: Record<string, unknown[]> = { ...current } as Record<string, unknown[]>
    if (nextUsers.length) next[emoji] = nextUsers
    else delete next[emoji]

    const { error } = await sb.from("circle_post_comments").update({ reactions: next }).eq("id", commentId)
    if (error) {
      console.error("[thread reaction] update error:", error.message)
      return NextResponse.json({ error: "Could not save that reaction" }, { status: 500 })
    }

    const reactions = Object.entries(next)
      .filter(([, ids]) => Array.isArray(ids) && ids.length > 0)
      .map(([key, ids]) => {
        const list = (ids as unknown[]).map((u) => String(u))
        return { emoji: key, count: list.length, users: list.slice(0, 12), reacted: list.includes(user.id) }
      })

    return NextResponse.json({ success: true, reactions, reacted: !has })
  } catch (e: any) {
    console.error("[thread reactions] POST error:", e)
    return NextResponse.json({ error: e.message || "Could not save that reaction" }, { status: 500 })
  }
}
