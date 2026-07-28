import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getUserFromToken(token: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  try {
    const { id: circleId, postId } = await params
    const { data: comments, error } = await supabase
      .from("circle_post_comments")
      .select(
        `
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `,
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true })

    if (error) {
      // Fallback empty if table missing mid-deploy
      console.error("circle_post_comments GET:", error)
      return NextResponse.json({ success: true, comments: [] })
    }

    return NextResponse.json({ success: true, circle_id: circleId, comments: comments || [] })
  } catch (error) {
    console.error("Error fetching circle comments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; postId: string }> }) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = await getUserFromToken(authHeader.replace("Bearer ", ""))
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { id: circleId, postId } = await params
    const body = await request.json().catch(() => ({}))
    const content = String(body.content || "").trim()
    const parentCommentId = body.parent_comment_id || null

    if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 })

    const { data: post } = await supabase
      .from("circle_posts")
      .select("id, comment_count")
      .eq("id", postId)
      .eq("circle_id", circleId)
      .maybeSingle()
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

    const { data: member } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("status", ["active", "approved"])
      .maybeSingle()
    if (!member) return NextResponse.json({ error: "Join the circle to comment" }, { status: 403 })

    const { data: comment, error } = await supabase
      .from("circle_post_comments")
      .insert({
        circle_id: circleId,
        post_id: postId,
        author_id: user.id,
        content,
        parent_comment_id: parentCommentId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `,
      )
      .single()

    if (error) {
      console.error("circle comment insert:", error)
      return NextResponse.json({ error: error.message || "Failed to create comment" }, { status: 500 })
    }

    await supabase
      .from("circle_posts")
      .update({ comment_count: Number(post.comment_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", postId)

    try {
      await supabase.channel(`circle:${circleId}`).send({
        type: "broadcast",
        event: "post_comment",
        payload: { post_id: postId, comment },
      })
    } catch {
      /* ignore */
    }

    return NextResponse.json({ success: true, comment })
  } catch (error) {
    console.error("Error creating circle comment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
