import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

interface MomentCommentRow {
  id: string
  moment_id: string
  user_id: string
  content: string
  parent_comment_id: string | null
  created_at: string
  author?: Array<{
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    is_verified: boolean | null
  }>
}

/** GET — fetch threaded comments for a moment (flat list; client builds the tree). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = createServerClient()

    // Ensure the moment still exists and hasn't expired.
    const { data: moment } = await supabase
      .from("moments")
      .select("id")
      .eq("id", id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()
    if (!moment) return NextResponse.json({ error: "Moment not found or expired" }, { status: 404 })

    const { data: comments, error } = await supabase
      .from("moment_comments")
      .select(
        `*,
         author:profiles!user_id(id, username, display_name, avatar_url, is_verified)`,
      )
      .eq("moment_id", id)
      .order("created_at", { ascending: true })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const flat = (comments || []).map((comment: MomentCommentRow) => ({
      id: comment.id,
      moment_id: comment.moment_id,
      user_id: comment.user_id,
      content: comment.content,
      parent_comment_id: comment.parent_comment_id,
      created_at: comment.created_at,
      author: Array.isArray(comment.author) ? comment.author[0] : comment.author,
    }))

    return NextResponse.json({ success: true, comments: flat })
  } catch (error: any) {
    console.error("Moment comments GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST — add a comment (or reply) to a moment. Body: { content, parent_comment_id? } */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const content = String(body.content || "").trim().slice(0, 500)
    const parentCommentId = body.parent_comment_id ? String(body.parent_comment_id) : null

    if (!content) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 })

    const supabase = createServerClient()

    // Moment must exist and still be live.
    const { data: moment } = await supabase
      .from("moments")
      .select("id")
      .eq("id", id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()
    if (!moment) return NextResponse.json({ error: "Moment not found or expired" }, { status: 404 })

    // Parent must belong to the same moment (thread integrity).
    if (parentCommentId) {
      const { data: parent } = await supabase
        .from("moment_comments")
        .select("id")
        .eq("id", parentCommentId)
        .eq("moment_id", id)
        .maybeSingle()
      if (!parent) return NextResponse.json({ error: "Parent comment not found" }, { status: 400 })
    }

    const { data: comment, error } = await supabase
      .from("moment_comments")
      .insert({
        moment_id: id,
        user_id: user.id,
        content,
        parent_comment_id: parentCommentId,
      })
      .select(`*, author:profiles!user_id(id, username, display_name, avatar_url, video_avatar_url, is_verified)`)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const author = Array.isArray((comment as MomentCommentRow).author)
      ? (comment as MomentCommentRow).author?.[0]
      : (comment as MomentCommentRow).author

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        moment_id: comment.moment_id,
        user_id: comment.user_id,
        content: comment.content,
        parent_comment_id: comment.parent_comment_id,
        created_at: comment.created_at,
        author,
      },
    })
  } catch (error: any) {
    console.error("Moment comments POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — remove a comment (author or moment author or admin). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const url = new URL(request.url)
    const commentId = url.searchParams.get("comment_id")
    if (!commentId) return NextResponse.json({ error: "comment_id required" }, { status: 400 })

    const supabase = createServerClient()

    const { data: comment } = await supabase
      .from("moment_comments")
      .select("id, user_id, moment_id")
      .eq("id", commentId)
      .eq("moment_id", id)
      .maybeSingle()
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })

    const { data: moment } = await supabase
      .from("moments")
      .select("user_id")
      .eq("id", id)
      .maybeSingle()

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()

    const canDelete =
      comment.user_id === user.id ||
      moment?.user_id === user.id ||
      Boolean(profile?.is_admin)
    if (!canDelete) {
      return NextResponse.json({ error: "You can only delete your own comments" }, { status: 403 })
    }

    const { error } = await supabase.from("moment_comments").delete().eq("id", commentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Moment comments DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
