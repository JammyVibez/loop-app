import { type NextRequest, NextResponse } from "next/server"
import { communityClient } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const STAFF_ROLES = new Set(["owner", "admin", "moderator"])

/**
 * PATCH /api/communities/[id]/threads/[threadId]/comments/[commentId]
 * body: { content }
 *
 * Only the person who wrote a reply can rewrite it. Moderators get no say
 * here — editing someone's words is not moderation, deleting is.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string; commentId: string }> },
) {
  try {
    const { id, threadId, commentId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to edit a reply" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const content = String(body.content || "").trim()
    if (!content) return NextResponse.json({ error: "A reply cannot be empty" }, { status: 400 })
    if (content.length > 4000) return NextResponse.json({ error: "That reply is too long" }, { status: 400 })

    const sb = communityClient()
    const { data: comment } = await sb
      .from("circle_post_comments")
      .select("id, author_id")
      .eq("id", Number(commentId))
      .eq("post_id", threadId)
      .eq("circle_id", id)
      .maybeSingle()

    if (!comment) return NextResponse.json({ error: "That reply no longer exists" }, { status: 404 })
    if (String(comment.author_id) !== user.id) {
      return NextResponse.json({ error: "You can only edit your own reply" }, { status: 403 })
    }

    const updated_at = new Date().toISOString()
    const { error } = await sb
      .from("circle_post_comments")
      .update({ content, updated_at })
      .eq("id", comment.id)
    if (error) {
      console.error("[comment] PATCH error:", error.message)
      return NextResponse.json({ error: "Could not save that edit" }, { status: 500 })
    }

    return NextResponse.json({ success: true, comment: { id: String(comment.id), content, updated_at } })
  } catch (e: any) {
    console.error("[comment] PATCH error:", e)
    return NextResponse.json({ error: e.message || "Could not save that edit" }, { status: 500 })
  }
}

/**
 * DELETE — the author can remove their own reply; community staff can remove
 * anyone's (moderating a thread is what the role is for).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string; commentId: string }> },
) {
  try {
    const { id, threadId, commentId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to delete a reply" }, { status: 401 })

    const sb = communityClient()
    const [{ data: comment }, { data: membership }] = await Promise.all([
      sb
        .from("circle_post_comments")
        .select("id, author_id, post_id")
        .eq("id", Number(commentId))
        .eq("post_id", threadId)
        .eq("circle_id", id)
        .maybeSingle(),
      sb.from("circle_members").select("role, status").eq("circle_id", id).eq("user_id", user.id).maybeSingle(),
    ])

    if (!comment) return NextResponse.json({ error: "That reply no longer exists" }, { status: 404 })

    const isAuthor = String(comment.author_id) === user.id
    const isStaff = Boolean(membership?.role && STAFF_ROLES.has(membership.role))
    if (!isAuthor && !isStaff) {
      return NextResponse.json({ error: "You can only delete your own reply" }, { status: 403 })
    }

    const { error } = await sb.from("circle_post_comments").delete().eq("id", comment.id)
    if (error) {
      console.error("[comment] DELETE error:", error.message)
      return NextResponse.json({ error: "Could not delete that reply" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[comment] DELETE error:", e)
    return NextResponse.json({ error: e.message || "Could not delete that reply" }, { status: 500 })
  }
}
