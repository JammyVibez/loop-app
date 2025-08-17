import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient()
    const reelId = params.id
    const { searchParams } = new URL(request.url)

    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = (page - 1) * limit

    const { data: comments, error } = await supabase
      .from("reel_comments")
      .select(`
        *,
        author:profiles!user_id (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .eq("reel_id", reelId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        comments,
        page,
        limit,
        has_more: comments?.length === limit,
      },
    })
  } catch (error) {
    console.error("Get reel comments error:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient()
    const reelId = params.id

    // Get user from session
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    const body = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 })
    }

    // Check if reel exists and allows comments
    const { data: reel } = await supabase
      .from("reels")
      .select("id, allows_comments, comment_count")
      .eq("id", reelId)
      .single()

    if (!reel) {
      return NextResponse.json({ error: "Reel not found" }, { status: 404 })
    }

    if (!reel.allows_comments) {
      return NextResponse.json({ error: "Comments are disabled for this reel" }, { status: 403 })
    }

    // Create comment
    const { data: comment, error } = await supabase
      .from("reel_comments")
      .insert({
        reel_id: reelId,
        user_id: user.id,
        content: content.trim(),
      })
      .select(`
        *,
        author:profiles!user_id (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update reel comment count
    await supabase
      .from("reels")
      .update({ comment_count: reel.comment_count + 1 })
      .eq("id", reelId)

    return NextResponse.json({
      success: true,
      data: {
        comment,
        comment_count: reel.comment_count + 1,
      },
    })
  } catch (error) {
    console.error("Create reel comment error:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
