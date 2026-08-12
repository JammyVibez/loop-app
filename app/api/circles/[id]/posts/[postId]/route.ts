import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { notifyUser } from "@/lib/notifications";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder")

async function getUserFromToken(token: string) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

// Get post details. Comments live under the dedicated
// /api/circles/[id]/posts/[postId]/comments route (circle_post_comments
// table) — this used to also query `comments` with `loop_id: postId`, which
// pointed at the loop feed's comment table using a circle post id, a
// leftover from an earlier draft that never matched real data.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string, postId: string }> }) {
  try {
    const { id: circleId, postId } = await params

    // Fetch post with author info
    const { data: post, error: postError } = await supabase
      .from("circle_posts")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .eq("id", postId)
      .eq("circle_id", circleId)
      .maybeSingle()

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Get interaction counts
    const { data: interactions } = await supabase
      .from("circle_post_interactions")
      .select("interaction_type")
      .eq("post_id", postId)

    const likes = interactions?.filter(i => i.interaction_type === "like").length || 0
    const shares = interactions?.filter(i => i.interaction_type === "share").length || 0

    return NextResponse.json({
      success: true,
      post: {
        ...post,
        like_count: likes,
        share_count: shares,
      },
    })
  } catch (error) {
    console.error("Error fetching post details:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Handle post interactions (like, share, etc.)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string, postId: string }> }) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { id: circleId, postId } = await params
    const { action } = await request.json() // like, share, save, etc.

    // Check if post exists
    const { data: post } = await supabase
      .from("circle_posts")
      .select("id, author_id")
      .eq("id", postId)
      .eq("circle_id", circleId)
      .maybeSingle()

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Check if user is a member of the circle
    const { data: member } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: "You must be a member to interact with posts" }, { status: 403 })
    }

    // Handle different actions
    switch (action) {
      case "like":
        // Check if user already liked the post
        const { data: existingLike } = await supabase
          .from("circle_post_interactions")
          .select("id")
          .eq("user_id", user.id)
          .eq("post_id", postId)
          .eq("interaction_type", "like")
          .maybeSingle()

        if (existingLike) {
          // Remove like
          await supabase
            .from("circle_post_interactions")
            .delete()
            .eq("id", existingLike.id)

          if (post.author_id) {
            await supabase.rpc("increment_circle_contribution", {
              p_circle_id: circleId,
              p_user_id: post.author_id,
              p_amount: -1,
            })
          }

          return NextResponse.json({
            success: true,
            is_liked: false,
            message: "Like removed"
          })
        } else {
          // Add like
          await supabase
            .from("circle_post_interactions")
            .insert({
              user_id: user.id,
              post_id: postId,
              interaction_type: "like",
              created_at: new Date().toISOString()
            })

          if (post.author_id) {
            await supabase.rpc("increment_circle_contribution", {
              p_circle_id: circleId,
              p_user_id: post.author_id,
              p_amount: 1,
            })
            if (post.author_id !== user.id) {
              const { data: likerProfile } = await supabase
                .from("profiles")
                .select("username, display_name")
                .eq("id", user.id)
                .maybeSingle()
              const likerName = likerProfile?.display_name || likerProfile?.username || "Someone"
              await notifyUser(supabase, {
                userId: post.author_id,
                type: "circle_post_like",
                title: "New like",
                message: `${likerName} liked your post`,
                actionUrl: `/circles/${circleId}`,
                actorId: user.id,
                pushCategory: "social",
                data: { circleId, postId },
              })
            }
          }

          return NextResponse.json({
            success: true,
            is_liked: true,
            message: "Post liked"
          })
        }

      case "share":
        await supabase
          .from("circle_post_interactions")
          .insert({
            user_id: user.id,
            post_id: postId,
            interaction_type: "share",
            created_at: new Date().toISOString()
          })
        
        return NextResponse.json({
          success: true,
          message: "Post shared successfully"
        })

      case "save": {
        const { data: existingSave } = await supabase
          .from("circle_post_interactions")
          .select("id")
          .eq("user_id", user.id)
          .eq("post_id", postId)
          .eq("interaction_type", "save")
          .maybeSingle()

        if (existingSave) {
          await supabase.from("circle_post_interactions").delete().eq("id", existingSave.id)
          return NextResponse.json({ success: true, is_active: false, message: "Save removed" })
        }

        await supabase.from("circle_post_interactions").insert({
          user_id: user.id,
          post_id: postId,
          interaction_type: "save",
          created_at: new Date().toISOString(),
        })
        return NextResponse.json({ success: true, is_active: true, message: "Post saved" })
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error interacting with post:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
