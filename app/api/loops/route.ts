import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoop, normalizeLoops } from "@/lib/normalize-loop"
import { uploadFileToStorage } from "@/lib/cloudinary-upload"
import { checkPostMediaCount, resolveUploadActor } from "@/lib/media/upload-service"
import { getMediaPolicy, MB } from "@/lib/media/policy"
import { filterPrivateContent, getFollowingIds } from "@/lib/privacy"
import { applyRealCommentCounts, applyRealBranchCounts } from "@/lib/loop-stats"
import { getUserFromRequest } from "@/lib/server-auth";
import { enforceUserRateLimit } from "@/lib/rate-limit-settings"
import {
  countBranchesByUser,
  exceedsDepthLimit,
  exceedsPerUserLimit,
  resolveBranchLimits,
} from "@/lib/branch-limits"


function parseHashtags(value: unknown) {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      return value.split(/[ ,#]+/)
    }
  }
  return []
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const userId = searchParams.get("user_id")
    const category = searchParams.get("category")

    const viewer = await getUserFromRequest(request)
    const following = await getFollowingIds(createServerClient(), viewer?.id || null)

    const supabase = createServerClient()
    let query = supabase
      .from("loops")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id),
        parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url, video_avatar_url, is_verified)),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (userId) query = query.eq("author_id", userId)
    if (category) query = query.eq("category", category)

    const { data: loops, error } = await query

    if (error) {
      console.error("Supabase GET error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Private/followers-only profiles' loops don't surface in this raw listing
    // unless the viewer follows the author (or is the author).
    const visible = await filterPrivateContent(supabase, loops || [], viewer?.id || null, following)
    await applyRealCommentCounts(supabase, visible)
    await applyRealBranchCounts(supabase, visible)

    return NextResponse.json({
      success: true,
      loops: normalizeLoops(visible),
      pagination: { limit, offset, total: visible.length },
    })
  } catch (error: any) {
    console.error("Get loops error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Admin-tuneable posting throttle (see /loopadmin → Rate limits).
    const rlSupabase = createServerClient()
    const guard = await enforceUserRateLimit(rlSupabase, "post", user.id)
    if (!guard.ok) {
      return NextResponse.json(
        {
          error: "Slow down — you're posting too fast",
          message: `You've hit the posting limit. Try again in ${guard.retryAfter} seconds.`,
          retryAfter: guard.retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(guard.retryAfter) } },
      )
    }

    const headerContentType = request.headers.get("content-type") || ""
    let contentText = ""
    let contentTitle: string | null = null
    let file: File | null = null
    let loopType = "text"
    let category = "general"
    let hashtags: string[] = []
    let parentLoopId: string | null = null
    let visibility = "public"
    // Whether the caller actually chose a visibility, versus inheriting the
    // default. Community content defaults to community-only.
    let visibilityChosen = false
    // When a Loop is created from inside a community, the community id travels
    // with it so the community home can list it and the feed can attribute it.
    let communityCircleId: string | number | null = null
    let mediaMetadata: Record<string, unknown> | null = null
    // Already-uploaded media (e.g. Co-Loop Studio, which uploads to
    // Cloudinary during the session and publishes a JSON payload with the
    // resulting URLs rather than re-uploading files here).
    let preUploadedMediaUrl: string | null = null
    let preUploadedMediaUrls: string[] = []
    let isSpoiler = false

    const isMultipart = headerContentType.includes("multipart/form-data")
    let formDataObj: FormData | null = null

    if (isMultipart) {
      const formData = await request.formData()
      formDataObj = formData
      contentText = String(formData.get("content_text") || formData.get("content") || "")
      contentTitle = (formData.get("content_title") || formData.get("title") || null) as string | null
      file = (formData.get("media") || formData.get("file")) as File | null
      loopType = String(formData.get("content_type") || formData.get("type") || "text")
      category = String(formData.get("category") || "general")
      hashtags = parseHashtags(formData.get("hashtags"))
      parentLoopId = (formData.get("parent_loop_id") as string | null) || null
      visibilityChosen = formData.get("visibility") != null || formData.get("is_public") != null
      visibility = String(formData.get("visibility") || (formData.get("is_public") === "false" ? "private" : "public"))
      const rawMeta = formData.get("media_metadata") || formData.get("content_metadata")
      mediaMetadata = rawMeta ? JSON.parse(String(rawMeta)) : null
      isSpoiler = formData.get("is_spoiler") === "true"
    } else {
      const body = await request.json().catch(() => ({}))
      communityCircleId = body.circle_id ?? body.circleId ?? null
      contentText = String(body.content_text ?? body.content ?? "")
      contentTitle = body.content_title ?? body.title ?? null
      loopType = body.content_type ?? body.type ?? body.media_type ?? "text"
      category = body.category ?? "general"
      hashtags = parseHashtags(body.hashtags)
      parentLoopId = body.parent_loop_id ?? null
      visibilityChosen = body.visibility != null || body.is_public != null
      visibility = body.visibility ?? (body.is_public === false ? "private" : "public")
      mediaMetadata = body.content_metadata ?? body.media_metadata ?? null
      isSpoiler = Boolean(body.is_spoiler)

      if (Array.isArray(body.media_urls)) {
        preUploadedMediaUrls = body.media_urls.filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
      }
      if (typeof body.media_url === "string" && body.media_url) {
        preUploadedMediaUrl = body.media_url
        if (!preUploadedMediaUrls.length) preUploadedMediaUrls = [body.media_url]
      } else if (preUploadedMediaUrls.length) {
        preUploadedMediaUrl = preUploadedMediaUrls[0]
      }

      if (preUploadedMediaUrls.length > 1) {
        const policy = await getMediaPolicy(createServerClient())
        const actor = await resolveUploadActor(user.id, createServerClient())
        const check = checkPostMediaCount(preUploadedMediaUrls, actor, policy)
        if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 })
      }
    }

    hashtags = hashtags.map((tag) => String(tag).replace(/^#/, "").toLowerCase().trim()).filter(Boolean)

    if (!contentText.trim() && (!file || file.size === 0) && !preUploadedMediaUrl) {
      return NextResponse.json({ error: "Either text content or media is required" }, { status: 400 })
    }

    const supabase = createServerClient()
    let mediaUrl: string | null = preUploadedMediaUrl
    let mediaType = loopType || "text"
    let treeDepth = 0

    // ── Community context ──
    // Only real members can attach a Loop to a community, and community
    // content is community-only (private Loop visibility) unless the author
    // explicitly publishes it publicly. A private community can never
    // produce a public Loop.
    let community: { id: string | number; name?: string | null; handle?: string | null } | null = null
    if (communityCircleId) {
      const { data: circleRow } = await supabase
        .from("circles")
        .select("id, name, handle, is_private")
        .eq("id", communityCircleId)
        .maybeSingle()
      if (circleRow) {
        const { data: membership } = await supabase
          .from("circle_members")
          .select("status")
          .eq("circle_id", circleRow.id)
          .eq("user_id", user.id)
          .maybeSingle()
        const isMember = Boolean(membership && ["active", "approved"].includes(String(membership.status)))
        if (isMember) {
          community = { id: circleRow.id, name: circleRow.name, handle: circleRow.handle }
          // Community-only by default; an explicit choice can still publish it.
          if (!visibilityChosen) visibility = "private"
          // A private community's content never becomes a public Loop.
          if (circleRow.is_private) visibility = "private"
        }
      }
    }

    if (parentLoopId) {
      const { data: parent } = await supabase
        .from("loops")
        .select("id, tree_depth")
        .eq("id", parentLoopId)
        .maybeSingle()

      if (!parent) {
        return NextResponse.json({ error: "Parent loop not found" }, { status: 404 })
      }

      // Honour the root post's branch limits instead of an arbitrary fixed cap.
      const limits = await resolveBranchLimits(supabase, parentLoopId)
      if (exceedsDepthLimit(parent.tree_depth ?? 0, limits.maxDepth)) {
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

      treeDepth = (parent.tree_depth ?? 0) + 1
    }

    let mediaUrls: string[] = preUploadedMediaUrls
    let uploadedFiles: File[] = []

    if (isMultipart && formDataObj) {
      const rawMediaList = formDataObj.getAll("media").concat(formDataObj.getAll("file"))
      uploadedFiles = rawMediaList.filter((item): item is File => item instanceof File && item.size > 0)
    }

    if (uploadedFiles.length > 0) {
      const mediaPolicy = await getMediaPolicy(supabase)
      const uploadActor = await resolveUploadActor(user.id, supabase)
      const countCheck = checkPostMediaCount(uploadedFiles, uploadActor, mediaPolicy)
      if (!countCheck.ok) {
        return NextResponse.json({ error: countCheck.message }, { status: 400 })
      }
      const oversized = uploadedFiles.find((f) => f.size > mediaPolicy.hard_max_mb * MB)
      if (oversized) {
        return NextResponse.json(
          { error: `Files are capped at ${mediaPolicy.hard_max_mb}MB.` },
          { status: 413 },
        )
      }

      const firstFile = uploadedFiles[0]
      if (firstFile.type.startsWith("image/")) mediaType = "image"
      else if (firstFile.type.startsWith("video/")) mediaType = "video"
      else if (firstFile.type.startsWith("audio/")) mediaType = "audio"
      else mediaType = "file"

      for (const f of uploadedFiles) {
        const uploadResult = await uploadFileToStorage(f, "loops", user.id)
        if (uploadResult?.secure_url) {
          mediaUrls.push(uploadResult.secure_url)
        }
      }

      mediaUrl = mediaUrls[0] || null
    }

    const textContent = contentText.trim()
    const wordCount = textContent ? textContent.split(/\s+/).filter(Boolean).length : 0

    const { data: authorProfile } = await supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle()
    const isPro = Boolean(authorProfile?.is_premium)
    const maxWords = isPro ? 1800 : 500

    if (wordCount > maxWords) {
      return NextResponse.json({
        error: isPro
          ? `Pro posts are limited to ${maxWords} words (${wordCount} entered).`
          : `Standard accounts are limited to ${maxWords} words per post (${wordCount} entered). Upgrade to Pro for up to 1,800 words!`
      }, { status: 400 })
    }
    const isCodePost =
      loopType === "code" ||
      category === "code" ||
      Boolean((mediaMetadata as any)?.is_code)

    if (isCodePost) {
      mediaType = "code"
      category = "code"
      mediaMetadata = {
        ...(mediaMetadata || {}),
        is_code: true,
        language: (mediaMetadata as any)?.language || "other",
        forks_count: Number((mediaMetadata as any)?.forks_count || 0),
      }
    }

    const mergedMetadata = {
      ...(mediaMetadata || {}),
      media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      ...(community
        ? {
            community: { id: community.id, name: community.name || null, handle: community.handle || null },
          }
        : {}),
    }

    // Live DB has NOT NULL `content` (text) plus normalized content_* columns.
    const payload: Record<string, unknown> = {
      author_id: user.id,
      content: textContent || (mediaUrl ? `Shared a ${mediaType}` : ""),
      content_text: textContent || null,
      content_title: (contentTitle && contentTitle.trim()) || null,
      content_media_url: mediaUrl,
      media_url: mediaUrl,
      media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      content_type: mediaType,
      media_type: mediaType,
      category,
      hashtags,
      parent_loop_id: parentLoopId,
      ...(community ? { circle_id: community.id } : {}),
      visibility,
      tree_depth: treeDepth,
      content_metadata: mergedMetadata,
      is_spoiler: isSpoiler || undefined,
    }

    let { data: loop, error } = await supabase
      .from("loops")
      .insert(payload)
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .single()

    // Retry without optional columns if PostgREST schema cache rejects any of them.
    // Also fall back content_type "code" → "text" when CHECK constraint rejects it.
    if (error?.code === "PGRST204" || (error && /content_type|check|code/i.test(error.message || ""))) {
      if (/content_type|check|code/i.test(error.message || "")) {
        payload.content_type = "text"
        payload.media_type = "text"
        payload.content_metadata = {
          ...(typeof payload.content_metadata === "object" ? (payload.content_metadata as object) : {}),
          is_code: true,
        }
      }
      const optional = ["category", "content_metadata", "media_url", "media_type", "visibility", "is_spoiler"]
      for (const col of optional) {
        if (error?.code === "PGRST204" && String(error.message || "").includes(col)) {
          delete payload[col]
        }
      }
      ;({ data: loop, error } = await supabase
        .from("loops")
        .insert(payload)
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .single())
    }

    if (error) {
      console.error("Supabase POST error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // loop_stats row is created by DB trigger; upsert is safe if trigger is missing.
    await supabase.from("loop_stats").upsert(
      {
        loop_id: loop.id,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        views_count: 0,
        branches_count: 0,
      },
      { onConflict: "loop_id", ignoreDuplicates: true },
    )

    if (parentLoopId) {
      const { error: rpcError } = await supabase.rpc("increment_loop_branches", { loop_id: parentLoopId })
      if (rpcError) console.error("Error calling increment_loop_branches:", rpcError.message)
    }

    // Tagging @loopai on a new Loop gets an answer in its comments, the same way
    // tagging an account would. No provider or a failed call simply leaves the
    // Loop unanswered.
    let aiReply: any = null
    try {
      const { LOOP_AI_BOT_ID, buildLoopAiReply, ensureLoopAiBot, mentionsLoopAi } = await import(
        "@/lib/loop-ai/mentions"
      )
      if (textContent && mentionsLoopAi(textContent) && (await ensureLoopAiBot())) {
        const answer = await buildLoopAiReply({
          question: textContent,
          context: "The person just published this Loop and tagged you in it.",
        })
        if (answer) {
          const { data: aiComment } = await supabase
            .from("comments")
            .insert({
              loop_id: loop.id,
              author_id: LOOP_AI_BOT_ID,
              content: answer.text,
            })
            .select(
              `*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url, is_verified)`
            )
            .single()
          if (aiComment) {
            aiReply = aiComment
            await supabase
              .from("loop_stats")
              .update({ comments_count: 1 })
              .eq("loop_id", loop.id)
          }
        }
      }
    } catch (aiError) {
      console.warn("Loop AI mention reply failed:", aiError)
    }

    for (const tag of hashtags) {
      const { data: existingTag } = await supabase.from("hashtags").select("tag, usage_count").eq("tag", tag).maybeSingle()
      if (existingTag) {
        await supabase
          .from("hashtags")
          .update({
            usage_count: Number(existingTag.usage_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("tag", tag)
      } else {
        await supabase.from("hashtags").insert({ tag, usage_count: 1 })
      }
      await supabase.from("hashtag_usage").insert({
        hashtag: tag,
        loop_id: loop.id,
        user_id: user.id,
        created_at: new Date().toISOString(),
      })
    }

    try {
      const { awardXp } = await import("@/lib/xp")
      await awardXp(
        supabase,
        user.id,
        parentLoopId ? "create_branch" : "create_loop",
        parentLoopId ? "Created a branch" : "Created a loop",
      )
    } catch (xpError) {
      console.error("Loop XP award error:", xpError)
    }

    try {
      const { processMentions, extractMentions, attachMentionsColumn } = await import("@/lib/mentions")
      const usernames = extractMentions(textContent)
      if (usernames.length) {
        await attachMentionsColumn(supabase, "loops", loop.id, usernames)
        const { data: actorProfile } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", user.id)
          .maybeSingle()
        await processMentions(supabase, textContent, {
          source: "loop",
          loop_id: loop.id,
          actor_id: user.id,
          actor_username: actorProfile?.username || user.user_metadata?.username,
          actor_display_name: actorProfile?.display_name || user.user_metadata?.display_name,
        })
      }
    } catch (mentionError) {
      console.error("Loop mention processing error:", mentionError)
    }

    // Quest tracking: native "create_loop" quests progress here (non-fatal).
    try {
      const { trackQuestAction } = await import("@/lib/quest-tracker")
      await trackQuestAction(supabase, user.id, "create_loop")
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({ success: true, loop: normalizeLoop(loop), ai_reply: aiReply })
  } catch (error: any) {
    console.error("Create loop error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
