import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: reelId } = await params
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    const { data: comments, error } = await supabase
      .from("reel_comments")
      .select(`
        *,
        author:profiles!user_id (
          id, username, display_name, avatar_url, is_verified
        )
      `)
      .eq("reel_id", reelId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const roots: any[] = []
    const byParent = new Map<string, any[]>()
    for (const comment of comments || []) {
      if (comment.parent_comment_id) {
        const list = byParent.get(comment.parent_comment_id) || []
        list.push(comment)
        byParent.set(comment.parent_comment_id, list)
      } else {
        roots.push(comment)
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
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })

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
          id, username, display_name, avatar_url, is_verified
        )
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const nextCount = Number(reel.comment_count || 0) + 1
    await supabase.from("reels").update({ comment_count: nextCount }).eq("id", reelId)

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
