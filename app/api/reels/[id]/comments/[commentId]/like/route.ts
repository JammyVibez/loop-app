import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const { id: reelId, commentId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

    const supabase = createServerClient()

    // Make sure the comment actually belongs to this reel
    const { data: comment, error: commentError } = await supabase
      .from("reel_comments")
      .select("id, reel_id, like_count")
      .eq("id", commentId)
      .maybeSingle()

    if (commentError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }
    if (comment.reel_id !== reelId) {
      return NextResponse.json({ error: "Comment does not belong to this reel" }, { status: 400 })
    }

    // Existing like?
    const { data: existing } = await supabase
      .from("reel_comment_likes")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .maybeSingle()

    let liked: boolean
    if (existing) {
      liked = false
      await supabase.from("reel_comment_likes").delete().eq("id", existing.id)
      await supabase
        .from("reel_comments")
        .update({ like_count: Math.max(0, Number(comment.like_count || 0) - 1) })
        .eq("id", commentId)
    } else {
      liked = true
      await supabase.from("reel_comment_likes").insert({ comment_id: commentId, user_id: user.id })
      await supabase
        .from("reel_comments")
        .update({ like_count: Number(comment.like_count || 0) + 1 })
        .eq("id", commentId)
    }

    const { data: updated } = await supabase
      .from("reel_comments")
      .select("like_count")
      .eq("id", commentId)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      liked,
      like_count: Number(updated?.like_count || 0),
    })
  } catch (error) {
    console.error("Reel comment like error:", error)
    return NextResponse.json({ error: "Failed to toggle comment like" }, { status: 500 })
  }
}
