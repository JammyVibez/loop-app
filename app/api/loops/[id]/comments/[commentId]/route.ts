import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

async function getAuthUser(request: NextRequest) {
  return getUserFromRequest(request)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { commentId } = await params
    const { content } = await request.json()
    if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 })

    const supabase = createServerClient()
    const { data: existing } = await supabase.from("comments").select("id, author_id").eq("id", commentId).maybeSingle()
    if (!existing) return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    if (existing.author_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data: comment, error } = await supabase
      .from("comments")
      .update({
        content: content.trim(),
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commentId)
      .select(`*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium)`)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, comment })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { commentId } = await params
    const supabase = createServerClient()
    const { data: existing } = await supabase.from("comments").select("id, author_id").eq("id", commentId).maybeSingle()
    if (!existing) return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    if (existing.author_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id: loopId } = await params
    const { error } = await supabase.from("comments").delete().eq("id", commentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Keep the comment counter accurate after deletes.
    try {
      const { data: current } = await supabase
        .from("loop_stats")
        .select("comments_count")
        .eq("loop_id", loopId)
        .maybeSingle()
      if (current) {
        await supabase
          .from("loop_stats")
          .update({ comments_count: Math.max(0, Number(current.comments_count || 0) - 1) })
          .eq("loop_id", loopId)
      }
      const { data: loopRow } = await supabase.from("loops").select("comment_count").eq("id", loopId).maybeSingle()
      if (loopRow) {
        await supabase
          .from("loops")
          .update({ comment_count: Math.max(0, Number((loopRow as any).comment_count || 0) - 1) })
          .eq("id", loopId)
      }
    } catch (statsErr) {
      console.warn("Comment count decrement failed:", statsErr)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { commentId } = await params
    const body = await request.json().catch(() => ({}))
    const action = body.action || "like"
    const supabase = createServerClient()

    if (action !== "like") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from("comment_likes")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existing) {
      await supabase.from("comment_likes").delete().eq("id", existing.id)
      const { data: comment } = await supabase.from("comments").select("like_count").eq("id", commentId).maybeSingle()
      if (comment) {
        await supabase
          .from("comments")
          .update({ like_count: Math.max((comment.like_count || 1) - 1, 0) })
          .eq("id", commentId)
      }
      return NextResponse.json({ success: true, is_active: false })
    }

    const { error } = await supabase.from("comment_likes").insert({
      comment_id: commentId,
      user_id: user.id,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: comment } = await supabase.from("comments").select("like_count").eq("id", commentId).maybeSingle()
    await supabase
      .from("comments")
      .update({ like_count: (comment?.like_count || 0) + 1 })
      .eq("id", commentId)

    return NextResponse.json({ success: true, is_active: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
