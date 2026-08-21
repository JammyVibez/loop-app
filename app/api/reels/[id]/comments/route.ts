import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest, requireUser } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: reelId } = await params
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const { data: comments, error } = await supabase
      .from("reel_comments")
      .select(`
        *,
        author:profiles!user_id (
          id, username, display_name, avatar_url, video_avatar_url, is_verified
        )
      `)
      .eq("reel_id", reelId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Which of these comments did the viewer like?
    const likedIds = new Set<string>()
    if (user && comments?.length) {
      const { data: likes } = await supabase
        .from("reel_comment_likes")
        .select("comment_id")
        .eq("user_id", user.id)
        .in(
          "comment_id",
          comments.map((c: any) => c.id),
        )
      for (const like of likes || []) likedIds.add(like.comment_id)
    }

    const withLikes = (comment: any) => ({
      ...comment,
      like_count: Number(comment.like_count || 0),
      is_liked: likedIds.has(comment.id),
    })

    const roots: any[] = []
    const byParent = new Map<string, any[]>()
    for (const comment of comments || []) {
      if (comment.parent_comment_id) {
        const list = byParent.get(comment.parent_comment_id) || []
        list.push(withLikes(comment))
        byParent.set(comment.parent_comment_id, list)
      } else {
        roots.push(withLikes(comment))
      }
    }

    const nested = roots.map((comment) => ({
      ...comment,
      replies: byParent.get(comment.id) || [],
    }))

    return NextResponse.json({
      success: true,
      comments: nested,
      data: { comments: nested, page, limit, has_more: (comments || []).length === limit },
    })
  } catch (error) {
    console.error("Get reel comments error:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: reelId } = await params
    const supabase = createServerClient()
    const { user, response } = await requireUser(request)
    if (!user) return response

    const body = await request.json()
    const content = String(body.content || "").trim()
    const parentCommentId = body.parent_comment_id || null
    if (!content) return NextResponse.json({ error: "Comment content is required" }, { status: 400 })

    const { data: reel } = await supabase
      .from("reels")
      .select("id, allows_comments, comment_count")
      .eq("id", reelId)
      .single()

    if (!reel) return NextResponse.json({ error: "Reel not found" }, { status: 404 })
    if (!reel.allows_comments) return NextResponse.json({ error: "Comments are disabled for this reel" }, { status: 403 })

    if (parentCommentId) {
      const { data: parent } = await supabase
        .from("reel_comments")
        .select("id, reel_id")
        .eq("id", parentCommentId)
        .maybeSingle()
      if (!parent || parent.reel_id !== reelId) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 })
      }
    }

    const { data: comment, error } = await supabase
      .from("reel_comments")
      .insert({
        reel_id: reelId,
        user_id: user.id,
        content,
        parent_comment_id: parentCommentId,
      })
      .select(`
        *,
        author:profiles!user_id (
          id, username, display_name, avatar_url, video_avatar_url, is_verified
        )
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const nextCount = Number(reel.comment_count || 0) + 1
    await supabase.from("reels").update({ comment_count: nextCount }).eq("id", reelId)

    try {
      const { processMentions, extractMentions } = await import("@/lib/mentions")
      if (extractMentions(content).length) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", user.id)
          .maybeSingle()
        await processMentions(supabase, content, {
          source: "reel_comment",
          reel_id: reelId,
          comment_id: comment.id,
          actor_id: user.id,
          actor_username: profile?.username,
          actor_display_name: profile?.display_name,
        })
      }
    } catch (err) {
      console.error("reel comment mentions:", err)
    }

    try {
      await supabase.channel("reels:public").send({
        type: "broadcast",
        event: "reel:commented",
        payload: { reel_id: reelId, comment_count: nextCount, comment },
      })
    } catch {}

    return NextResponse.json({
      success: true,
      comment,
      data: { comment, comment_count: nextCount },
    })
  } catch (error) {
    console.error("Create reel comment error:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
