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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const loopId = params.id
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const { data: comments, error } = await supabase
      .from("comments")
      .select(`
        *,
        author:profiles(id, username, display_name, avatar_url, is_verified),
        replies:comments!parent_comment_id(
          *,
          author:profiles(id, username, display_name, avatar_url, is_verified)
        )
      `)
      .eq("loop_id", loopId)
      .is("parent_comment_id", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      comments: comments || [],
      hasMore: comments?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    const loopId = params.id
    const { content, parent_comment_id } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 })
    }

    // Insert comment
    const { data: comment, error: insertError } = await supabase
      .from("comments")
      .insert({
        loop_id: loopId,
        author_id: user.id,
        content: content.trim(),
        parent_comment_id: parent_comment_id || null,
      })
      .select(`
        *,
        author:profiles(id, username, display_name, avatar_url, is_verified)
      `)
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
    }

    // Update loop comment count
    await supabase.rpc("increment_loop_comments", { loop_id: loopId })

    return NextResponse.json({
      success: true,
      comment,
    })
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
