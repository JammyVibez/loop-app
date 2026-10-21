import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { normalizeLoop } from "@/lib/normalize-loop";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload";
import { isCloudinaryConfigured } from "@/lib/env-check";
import { getUserFromRequest } from "@/lib/server-auth";
import {
  countBranchesByUser,
  exceedsDepthLimit,
  exceedsPerUserLimit,
  resolveBranchLimits,
} from "@/lib/branch-limits";

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
    const quotedLoopId = String(formData.get("quoted_loop_id") || formData.get("quote_loop_id") || "")
    const file = (formData.get("file") || formData.get("media")) as File | null

    if (!content.trim() && !file) {
      return NextResponse.json({ error: "Content or file is required" }, { status: 400 })
    }

    if (!parentId && !quotedLoopId) {
      return NextResponse.json({ error: "Parent loop ID is required" }, { status: 400 })
    }

    /* ----------------------------------------------------------------
     * Quote rebranch — a top-level post by this user that embeds the
     * quoted post by reference. The quoted post is never copied or
     * modified; its text lives only in its own row.
     * ---------------------------------------------------------------- */
    if (quotedLoopId) {
      const quoteText = content.trim()
      if (!quoteText) {
        return NextResponse.json({ error: "Add a comment to quote this post" }, { status: 400 })
      }

      const { data: quoted, error: quotedError } = await supabase
        .from("loops")
        .select("id, author_id, visibility, circle_id, quote_count")
        .eq("id", quotedLoopId)
        .maybeSingle()

      if (quotedError) {
        return NextResponse.json({ error: quotedError.message }, { status: 500 })
      }
      if (!quoted) {
        return NextResponse.json({ error: "The post you are quoting no longer exists" }, { status: 404 })
      }

      // Respect the quoted post's privacy: public is open to everyone, circle
      // posts only to members of that circle, private posts only to the author.
      if (quoted.visibility === "private" && quoted.author_id !== user.id) {
        return NextResponse.json({ error: "You cannot quote this post" }, { status: 403 })
      }
      if (quoted.visibility === "circle" && quoted.circle_id && quoted.author_id !== user.id) {
        const { data: membership } = await supabase
          .from("circle_members")
          .select("id")
          .eq("circle_id", quoted.circle_id)
          .eq("user_id", user.id)
          .in("status", ["active", "approved"])
          .maybeSingle()
        if (!membership) {
          return NextResponse.json({ error: "You cannot quote this post" }, { status: 403 })
        }
      }

      const { data: quoteBranch, error: quoteInsertError } = await supabase
        .from("loops")
        .insert({
          author_id: user.id,
          content: quoteText,
          content_text: quoteText,
          content_type: "text",
          media_type: "text",
          parent_loop_id: null,
          tree_depth: 0,
          quoted_loop_id: quotedLoopId,
          visibility: "public",
          hashtags: [],
        })
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .single()

      if (quoteInsertError || !quoteBranch) {
        console.error("Quote rebranch insert error:", quoteInsertError)
        return NextResponse.json(
          { error: quoteInsertError?.message || "Failed to quote this post" },
          { status: 500 },
        )
      }

      await supabase.from("loop_stats").upsert(
        { loop_id: quoteBranch.id, likes_count: 0, comments_count: 0, branches_count: 0, shares_count: 0, views_count: 0 },
        { onConflict: "loop_id", ignoreDuplicates: true },
      )

      // The quoted post's counter tracks quotes separately from branches.
      await supabase
        .from("loops")
        .update({ quote_count: Number(quoted.quote_count || 0) + 1 })
        .eq("id", quotedLoopId)

      return NextResponse.json({ success: true, branch: normalizeLoop(quoteBranch), quoted: true })
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

    // The post owner decides how deep their tree may grow and how many
    // branches one account may add. Limits are read from the top-most post
    // of the tree (see lib/branch-limits.ts).
    const limits = await resolveBranchLimits(supabase, parentId)
    if (exceedsDepthLimit(parentDepth, limits.maxDepth)) {
      return NextResponse.json(
        { error: `This post allows branches up to ${limits.maxDepth} levels deep.`, code: "BRANCH_DEPTH_LIMIT" },
        { status: 400 },
      )
    }
    if (limits.rootId && limits.maxPerUser != null) {
      const used = await countBranchesByUser(supabase, limits.rootId, user.id)
      if (exceedsPerUserLimit(used, limits.maxPerUser)) {
        return NextResponse.json(
          { error: `You've reached the branch limit (${limits.maxPerUser}) for this post.`, code: "BRANCH_USER_LIMIT" },
          { status: 400 },
        )
      }
    }

    // Rebranch passthrough: if parent has media, carry it forward
    const parentMediaUrl = String(formData.get("parent_media_url") || "")
    const parentMediaType = String(formData.get("parent_media_type") || "")
    const parentDuelRaw = String(formData.get("parent_duel") || "")
    const parentPollRaw = String(formData.get("parent_poll") || "")
    const parentMetadataRaw = String(formData.get("content_metadata") || "")

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

    // For rebranches, use parent media if no new file uploaded
    if (!mediaUrl && parentMediaUrl) {
      mediaUrl = parentMediaUrl
      mediaType = parentMediaType || type || "text"
    }

    // Multi-media: check if parent had media_urls
    let mediaUrls: string[] | null = null
    try {
      const parentMediaUrlsRaw = String(formData.get("parent_media_urls") || "")
      if (parentMediaUrlsRaw) mediaUrls = JSON.parse(parentMediaUrlsRaw)
    } catch { /* intentionally silent */ }
    if (!mediaUrls && mediaUrl) mediaUrls = [mediaUrl]

    // Parse optional parent metadata
    let contentMetadata: Record<string, any> = {}
    try { if (parentMetadataRaw) contentMetadata = JSON.parse(parentMetadataRaw) } catch { /* intentionally silent */ }

    const payload: Record<string, any> = {
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
      content_metadata: contentMetadata,
      ...(mediaUrls && mediaUrls.length > 1 ? { media_urls: mediaUrls } : {}),
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
