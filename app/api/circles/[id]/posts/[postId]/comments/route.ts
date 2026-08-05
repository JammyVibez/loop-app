import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { notifyUser } from "@/lib/notifications"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder")

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
      .select("id, comment_count, author_id")
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

    // Commenting counts toward the circle leaderboard.
    await supabase.rpc("increment_circle_contribution", { p_circle_id: circleId, p_user_id: user.id, p_amount: 2 })

    if (post.author_id && post.author_id !== user.id) {
      const commenterName = comment.author?.display_name || comment.author?.username || "Someone"
      await notifyUser(supabase, {
        userId: post.author_id,
        type: "circle_post_comment",
        title: "New comment on your post",
        message: `${commenterName} commented: "${content.slice(0, 80)}"`,
        actionUrl: `/circles/${circleId}`,
        actorId: user.id,
        pushCategory: "social",
        data: { circleId, postId },
      })
    }

    try {
      const { processMentions, extractMentions } = await import("@/lib/mentions")
      if (extractMentions(content).length) {
        await processMentions(supabase, content, {
          source: "circle_comment",
          circle_id: circleId,
          post_id: postId,
          comment_id: comment.id,
          actor_id: user.id,
          actor_username: user.user_metadata?.username,
          actor_display_name: user.user_metadata?.display_name || user.email,
          href: `/circles/${circleId}`,
        })
      }
    } catch (mentionError) {
      console.error("Circle comment mention error:", mentionError)
    }

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
