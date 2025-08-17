import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient()
    const parentReelId = params.id

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
    const { type, title, content_url, description } = body

    if (!title?.trim() || !content_url?.trim() || !type) {
      return NextResponse.json(
        {
          error: "Title, content_url, and type are required",
        },
        { status: 400 },
      )
    }

    // Validate content type
    const validTypes = ["video", "image", "audio", "text"]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: "Invalid content type",
        },
        { status: 400 },
      )
    }

    // Check if parent reel exists and allows duets/branches
    const { data: parentReel } = await supabase
      .from("reels")
      .select("id, allows_duets, branch_count")
      .eq("id", parentReelId)
      .single()

    if (!parentReel) {
      return NextResponse.json({ error: "Parent reel not found" }, { status: 404 })
    }

    if (!parentReel.allows_duets) {
      return NextResponse.json({ error: "Branching is disabled for this reel" }, { status: 403 })
    }

    // Create branch reel
    const { data: branch, error } = await supabase
      .from("reels")
      .insert({
        author_id: user.id,
        title: title.trim(),
        description: description?.trim(),
        content_type: type,
        content_url: content_url.trim(),
        parent_reel_id: parentReelId,
        visibility: "public",
        allows_comments: true,
        allows_duets: true,
        allows_downloads: false,
      })
      .select(`
        *,
        author:profiles!author_id (
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          is_premium
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update parent reel branch count
    await supabase
      .from("reels")
      .update({ branch_count: parentReel.branch_count + 1 })
      .eq("id", parentReelId)

    // Create notification for parent reel author
    await supabase.from("notifications").insert({
      user_id: parentReel.id, // This should be the parent reel author_id
      type: "reel_branched",
      title: "New Branch Created",
      message: `Someone created a branch of your reel: "${title}"`,
      data: {
        reel_id: parentReelId,
        branch_id: branch.id,
        user_id: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        branch: {
          ...branch,
          like_count: 0,
          comment_count: 0,
          share_count: 0,
          view_count: 0,
          branch_count: 0,
          is_liked: false,
          is_saved: false,
          hashtags: [],
        },
      },
    })
  } catch (error) {
    console.error("Create reel branch error:", error)
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 })
  }
}
