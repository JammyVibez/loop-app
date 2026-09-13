import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireUser } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/** Recount a reel's comment_count from the reel_comments table. */
async function recountCommentCount(supabase: any, reelId: string) {
  const { count } = await supabase
    .from("reel_comments")
    .select("id", { count: "exact", head: true })
    .eq("reel_id", reelId)
  await supabase.from("reels").update({ comment_count: count || 0 }).eq("id", reelId)
  return count || 0
}

/** Edit a comment — only the author (or an admin) may change it. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  try {
    const { id: reelId, commentId } = await params
    const supabase = createServerClient()
    const { user, response } = await requireUser(request)
    if (!user) return response

    const body = await request.json().catch(() => ({}))
    const content = String(body.content || "").trim()
    if (!content) return NextResponse.json({ error: "Comment content is required" }, { status: 400 })
    if (content.length > 1000) return NextResponse.json({ error: "Comments are limited to 1000 characters" }, { status: 400 })

    const { data: existing, error: fetchError } = await supabase
      .from("reel_comments")
      .select("id, user_id")
      .eq("id", commentId)
      .eq("reel_id", reelId)
      .maybeSingle()
    if (fetchError || !existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "You can only edit your own comments" }, { status: 403 })
    }

    const { data: comment, error } = await supabase
      .from("reel_comments")
      .update({ content, edited_at: new Date().toISOString() })
      .eq("id", commentId)
      .select(`
        *,
        author:profiles!user_id (
          id, username, display_name, avatar_url, video_avatar_url, is_verified
        )
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      comment,
      data: { comment },
    })
  } catch (error: any) {
    console.error("Edit reel comment error:", error)
    return NextResponse.json({ error: error?.message || "Failed to edit comment" }, { status: 500 })
  }
}

/** Delete a comment (and any replies beneath it). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  try {
    const { id: reelId, commentId } = await params
    const supabase = createServerClient()
    const { user, response } = await requireUser(request)
    if (!user) return response

    const { data: existing, error: fetchError } = await supabase
      .from("reel_comments")
      .select("id, user_id")
      .eq("id", commentId)
      .eq("reel_id", reelId)
      .maybeSingle()
    if (fetchError || !existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }
    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: "You can only delete your own comments" }, { status: 403 })
    }

    // Delete the comment plus any replies nested under it.
    const childIds: string[] = []
    const collect = async (parentId: string) => {
      const { data: children } = await supabase
        .from("reel_comments")
        .select("id")
        .eq("parent_comment_id", parentId)
      for (const child of children || []) {
        childIds.push(child.id)
        await collect(child.id)
      }
    }
    await collect(commentId)

    const idsToDelete = [commentId, ...childIds]
    await supabase.from("reel_comment_likes").delete().in("comment_id", idsToDelete)
    const { error } = await supabase.from("reel_comments").delete().in("id", idsToDelete)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const comment_count = await recountCommentCount(supabase, reelId)

    try {
      await supabase.channel("reels:public").send({
        type: "broadcast",
        event: "reel:commented",
        payload: { reel_id: reelId, comment_count, deleted_comment_id: commentId },
      })
    } catch { /* intentionally silent */ }

    return NextResponse.json({ success: true, deleted_comment_id: commentId, comment_count })
  } catch (error: any) {
    console.error("Delete reel comment error:", error)
    return NextResponse.json({ error: error?.message || "Failed to delete comment" }, { status: 500 })
  }
}
