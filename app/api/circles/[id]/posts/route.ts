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

// Get circle posts
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const sortBy = searchParams.get("sort") || "created_at"
    const order = searchParams.get("order") || "desc"

    const circleId = params.id

    // Fetch posts with author info
    const { data: posts, error } = await supabase
      .from("circle_posts")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .eq("circle_id", circleId)
      .order(sortBy, { ascending: order === "asc" })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 })
    }

    // Get interaction counts for each post
    const postIds = posts?.map(post => post.id) || []
    if (postIds.length > 0) {
      const { data: interactions } = await supabase
        .from("circle_post_interactions")
        .select("post_id, interaction_type")
        .in("post_id", postIds)

      // Add interaction counts to posts
      const postsWithCounts = posts?.map(post => {
        const postInteractions = interactions?.filter(interaction => interaction.post_id === post.id) || []
        const likes = postInteractions.filter(i => i.interaction_type === "like").length
        const shares = postInteractions.filter(i => i.interaction_type === "share").length
        
        return {
          ...post,
          like_count: likes,
          share_count: shares
        }
      }) || []

      return NextResponse.json({
        success: true,
        posts: postsWithCounts,
        hasMore: posts?.length === limit,
      })
    }

    return NextResponse.json({
      success: true,
      posts: posts || [],
      hasMore: posts?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching circle posts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Create a new circle post
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { content, media_url, media_type, hashtags } = await request.json()

    // Check if user is a member of the circle
    const { data: member } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    if (!member) {
      return NextResponse.json({ error: "You must be a member to post" }, { status: 403 })
    }

    // Validate content
    if (!content?.trim() && !media_url) {
      return NextResponse.json({ error: "Content or media is required" }, { status: 400 })
    }

    // Create post
    const { data: post, error: insertError } = await supabase
      .from("circle_posts")
      .insert({
        circle_id: circleId,
        author_id: user.id,
        content: content?.trim() || "",
        media_url,
        media_type,
        hashtags: hashtags || [],
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
      return NextResponse.json({ error: "Failed to create post" }, { status: 500 })
    }

    // Update circle post count
    await supabase.rpc('increment_circle_post_count', { circle_id: circleId })

    return NextResponse.json({
      success: true,
      post,
      message: "Post created successfully"
    })
  } catch (error) {
    console.error("Error creating circle post:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update a circle post
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { postId, content, media_url, media_type, hashtags } = await request.json()

    // Check if post exists and user is the author
    const { data: post } = await supabase
      .from("circle_posts")
      .select("author_id")
      .eq("id", postId)
      .eq("circle_id", circleId)
      .single()

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    if (post.author_id !== user.id) {
      return NextResponse.json({ error: "You can only edit your own posts" }, { status: 403 })
    }

    // Update post
    const { data: updatedPost, error: updateError } = await supabase
      .from("circle_posts")
      .update({
        content: content?.trim() || "",
        media_url,
        media_type,
        hashtags: hashtags || [],
        updated_at: new Date().toISOString()
      })
      .eq("id", postId)
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .single()

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update post" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      post: updatedPost,
      message: "Post updated successfully"
    })
  } catch (error) {
    console.error("Error updating circle post:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Delete a circle post
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get("postId")

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
    }

    // Check if post exists and user is the author or has admin permissions
    const { data: post } = await supabase
      .from("circle_posts")
      .select("author_id")
      .eq("id", postId)
      .eq("circle_id", circleId)
      .single()

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Check if user is author or has admin/moderator permissions
    let hasPermission = post.author_id === user.id
    
    if (!hasPermission) {
      const { data: member } = await supabase
        .from("circle_members")
        .select("role")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .in("role", ["admin", "moderator"])
        .single()
      
      hasPermission = !!member
    }

    if (!hasPermission) {
      return NextResponse.json({ error: "You can only delete your own posts or posts in circles where you have moderator permissions" }, { status: 403 })
    }

    // Delete post
    const { error: deleteError } = await supabase
      .from("circle_posts")
      .delete()
      .eq("id", postId)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete post" }, { status: 500 })
    }

    // Update circle post count
    await supabase.rpc('decrement_circle_post_count', { circle_id: circleId })

    return NextResponse.json({
      success: true,
      message: "Post deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting circle post:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
