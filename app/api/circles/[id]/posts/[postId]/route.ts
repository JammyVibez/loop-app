import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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

// Get post details with comments
export async function GET(request: NextRequest, { params }: { params: { id: string, postId: string } }) {
  try {
    const circleId = params.id
    const postId = params.postId

    // Fetch post with author info
    const { data: post, error: postError } = await supabase
      .from("circle_posts")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .eq("id", postId)
      .eq("circle_id", circleId)
      .single()

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

    // Get comments
    const { data: comments } = await supabase
      .from("comments")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .eq("loop_id", postId) // Using loop_id to reference the post
      .order("created_at", { ascending: true })

    return NextResponse.json({
      success: true,
      post: {
        ...post,
        like_count: likes,
        share_count: shares,
        comment_count: comments?.length || 0
      },
      comments: comments || []
    })
  } catch (error) {
    console.error("Error fetching post details:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Handle post interactions (like, share, etc.)
export async function POST(request: NextRequest, { params }: { params: { id: string, postId: string } }) {
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

    const circleId = params.id
    const postId = params.postId
    const { action } = await request.json() // like, share, save, etc.

    // Check if post exists
    const { data: post } = await supabase
      .from("circle_posts")
      .select("id")
      .eq("id", postId)
      .eq("circle_id", circleId)
      .single()

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
      .single()

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
          .single()

        if (existingLike) {
          // Remove like
          await supabase
            .from("circle_post_interactions")
            .delete()
            .eq("id", existingLike.id)
          
          return NextResponse.json({
            success: true,
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
          
          return NextResponse.json({
            success: true,
            message: "Post liked"
          })
        }

      case "share":
        // Add share interaction
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

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error interacting with post:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Add a comment to a post
export async function PUT(request: NextRequest, { params }: { params: { id: string, postId: string } }) {
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

    const circleId = params.id
    const postId = params.postId
    const { content, media_url, media_type } = await request.json()

    // Check if post exists
    const { data: post } = await supabase
      .from("circle_posts")
      .select("id")
      .eq("id", postId)
      .eq("circle_id", circleId)
      .single()

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
      .single()

    if (!member) {
      return NextResponse.json({ error: "You must be a member to comment" }, { status: 403 })
    }

    // Validate content
    if (!content?.trim() && !media_url) {
      return NextResponse.json({ error: "Content or media is required" }, { status: 400 })
    }

    // Create comment
    const { data: comment, error: insertError } = await supabase
      .from("comments")
      .insert({
        author_id: user.id,
        loop_id: postId, // Using loop_id to reference the post
        content: content?.trim() || "",
        media_url,
        media_type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
    }

    // Update post comment count
    await supabase.rpc('increment_circle_post_comment_count', { post_id: postId })

    return NextResponse.json({
      success: true,
      comment,
      message: "Comment added successfully"
    })
  } catch (error) {
    console.error("Error adding comment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
