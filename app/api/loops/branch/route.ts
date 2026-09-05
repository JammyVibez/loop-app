import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { normalizeLoop } from "@/lib/normalize-loop";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload";
import { isCloudinaryConfigured } from "@/lib/env-check";
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)


export async function POST(request: NextRequest) {
  try {

    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const formData = await request.formData()
    const content = String(formData.get("content") || formData.get("content_text") || "")
    const title = String(formData.get("title") || formData.get("content_title") || "")
    const type = String(formData.get("type") || formData.get("content_type") || "text")
    const parentId = String(formData.get("parent_id") || formData.get("parent_loop_id") || "")
    const file = (formData.get("file") || formData.get("media")) as File | null

    if (!content.trim() && !file) {
      return NextResponse.json({ error: "Content or file is required" }, { status: 400 })
    }

    if (!parentId) {
      return NextResponse.json({ error: "Parent loop ID is required" }, { status: 400 })
    }

    const { data: parentLoop, error: parentError } = await supabase
      .from("loops")
      .select("id, tree_depth")
      .eq("id", parentId)
      .single()

    if (parentError || !parentLoop) {
      return NextResponse.json({ error: "Parent loop not found" }, { status: 404 })
    }

    const parentDepth = parentLoop.tree_depth ?? 0
    if (parentDepth >= 10) {
      return NextResponse.json({ error: "Maximum branch depth reached" }, { status: 400 })
    }

    let mediaUrl: string | null = null
    let mediaType = type || "text"

    if (file && file.size > 0) {
      if (!isCloudinaryConfigured()) {
        return NextResponse.json(
          { error: "Media uploads are not configured. Add Cloudinary env vars on Vercel." },
          { status: 503 },
        )
      }

      try {
        if (file.type.startsWith("image/")) mediaType = "image"
        else if (file.type.startsWith("video/")) mediaType = "video"
        else if (file.type.startsWith("audio/")) mediaType = "audio"
        else mediaType = "file"

        const uploadResult = await uploadFileToCloudinary(file, "loop-branches")
        mediaUrl = uploadResult.secure_url
      } catch (uploadError) {
        console.error("File upload error:", uploadError)
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
      }
    }

    const textContent = content.trim()
    const payload = {
      author_id: user.id,
      content: textContent || (mediaUrl ? `Shared a ${mediaType}` : ""),
      content_text: textContent || null,
      content_title: title.trim() || null,
      content_media_url: mediaUrl,
      media_url: mediaUrl,
      content_type: mediaType,
      media_type: mediaType,
      parent_loop_id: parentId,
      tree_depth: parentDepth + 1,
      visibility: "public",
      hashtags: [] as string[],
      content_metadata: {},
    }

    const { data: branch, error: insertError } = await supabase
      .from("loops")
      .insert(payload)
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: insertError.message || "Failed to create branch" }, { status: 500 })
    }

    await supabase.from("loop_stats").upsert(
      {
        loop_id: branch.id,
        likes_count: 0,
        comments_count: 0,
        branches_count: 0,
        shares_count: 0,
        views_count: 0,
      },
      { onConflict: "loop_id", ignoreDuplicates: true },
    )

    const { error: rpcError } = await supabase.rpc("increment_loop_branches", { loop_id: parentId })
    if (rpcError) console.error("increment_loop_branches error:", rpcError.message)

    return NextResponse.json({
      success: true,
      branch: normalizeLoop(branch),
    })
  } catch (error) {
    console.error("Error creating branch:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
