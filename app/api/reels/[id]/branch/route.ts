import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: parentReelId } = await params
    const supabase = createServerClient()


    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const title = String(body.title || "").trim()
    const content_url = String(body.content_url || "").trim()
    const type = body.type || body.content_type || "video"
    const description = body.description ? String(body.description).trim() : null

    if (!title || !content_url) {
      return NextResponse.json({ error: "Title and content_url are required" }, { status: 400 })
    }

    const validTypes = ["video", "image", "audio", "text"]
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    }

    const { data: parentReel } = await supabase
      .from("reels")
      .select("id, author_id, allows_duets, branch_count, title")
      .eq("id", parentReelId)
      .maybeSingle()

    if (!parentReel) {
      return NextResponse.json({ error: "Parent reel not found" }, { status: 404 })
    }

    if (parentReel.allows_duets === false) {
      return NextResponse.json({ error: "Duets are disabled for this reel" }, { status: 403 })
    }

    const { data: branch, error } = await supabase
      .from("reels")
      .insert({
        author_id: user.id,
        title,
        description,
        content_type: type,
        content_url,
        parent_reel_id: parentReelId,
        visibility: "public",
        allows_comments: true,
        allows_duets: true,
        allows_downloads: false,
        effects: body.effects || { kind: "duet", parent_reel_id: parentReelId },
        hashtags: body.hashtags || ["duet"],
      })
      .select(`
        *,
        author:profiles!author_id (
          id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase
      .from("reels")
      .update({ branch_count: Number(parentReel.branch_count || 0) + 1 })
      .eq("id", parentReelId)

    if (parentReel.author_id && parentReel.author_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: parentReel.author_id,
        type: "reel_branched",
        title: "New Duet",
        message: `Someone dueted your reel: "${parentReel.title || title}"`,
        data: {
          reel_id: parentReelId,
          branch_id: branch.id,
          user_id: user.id,
        },
        actor_id: user.id,
      })
    }

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
          hashtags: branch.hashtags || ["duet"],
        },
      },
    })
  } catch (error) {
    console.error("Create reel branch error:", error)
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 })
  }
}
