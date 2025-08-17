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

// Get circle posts (admin view)
export async function GET(request: NextRequest, { params }: { params: { circleId: string } }) {
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

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!adminProfile || !adminProfile.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const search = searchParams.get("search")
    const authorId = searchParams.get("authorId")
    const sortBy = searchParams.get("sort") || "created_at"
    const order = searchParams.get("order") || "desc"

    const circleId = params.circleId

    // Check if circle exists
    const { data: circle } = await supabase
      .from("circles")
      .select("id")
      .eq("id", circleId)
      .single()

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    let query = supabase
      .from("circle_posts")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .eq("circle_id", circleId)
      .order(sortBy, { ascending: order === "asc" })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.ilike("content", `%${search}%`)
    }

    if (authorId) {
      query = query.eq("author_id", authorId)
    }

    const { data: posts, error } = await query

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

// Delete a post (admin override)
export async function DELETE(request: NextRequest, { params }: { params: { circleId: string } }) {
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

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!adminProfile || !adminProfile.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const circleId = params.circleId
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get("postId")

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
    }

    // Check if circle exists
    const { data: circle } = await supabase
      .from("circles")
      .select("id")
      .eq("id", circleId)
      .single()

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

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

    // Delete post
    const { error: deleteError } = await supabase
      .from("circle_posts")
      .delete()
      .eq("id", postId)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete post" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Post deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting post:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
