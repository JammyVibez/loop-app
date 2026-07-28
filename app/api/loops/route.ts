import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoop, normalizeLoops } from "@/lib/normalize-loop"
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload"
import { isCloudinaryConfigured } from "@/lib/env-check"

async function getUserFromToken(token: string | null) {
  if (!token) return null

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

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

    const supabase = createServerClient()
    let query = supabase
      .from("loops")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .is("parent_loop_id", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (userId) query = query.eq("author_id", userId)
    if (category) query = query.eq("category", category)

    const { data: loops, error } = await query

    if (error) {
      console.error("Supabase GET error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      loops: normalizeLoops(loops || []),
      pagination: { limit, offset, total: loops?.length || 0 },
    })
  } catch (error: any) {
    console.error("Get loops error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    let mediaMetadata: Record<string, unknown> | null = null

    if (headerContentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      contentText = String(formData.get("content_text") || formData.get("content") || "")
      contentTitle = (formData.get("content_title") || formData.get("title") || null) as string | null
      file = (formData.get("media") || formData.get("file")) as File | null
      loopType = String(formData.get("content_type") || formData.get("type") || "text")
      category = String(formData.get("category") || "general")
      hashtags = parseHashtags(formData.get("hashtags"))
      parentLoopId = (formData.get("parent_loop_id") as string | null) || null
      visibility = String(formData.get("visibility") || (formData.get("is_public") === "false" ? "private" : "public"))
      const rawMeta = formData.get("media_metadata") || formData.get("content_metadata")
      mediaMetadata = rawMeta ? JSON.parse(String(rawMeta)) : null
    } else {
      const body = await request.json().catch(() => ({}))
      contentText = String(body.content_text ?? body.content ?? "")
      contentTitle = body.content_title ?? body.title ?? null
      loopType = body.content_type ?? body.type ?? "text"
      category = body.category ?? "general"
      hashtags = parseHashtags(body.hashtags)
      parentLoopId = body.parent_loop_id ?? null
      visibility = body.visibility ?? (body.is_public === false ? "private" : "public")
      mediaMetadata = body.content_metadata ?? body.media_metadata ?? null
    }

    hashtags = hashtags.map((tag) => String(tag).replace(/^#/, "").toLowerCase().trim()).filter(Boolean)

    if (!contentText.trim() && (!file || file.size === 0)) {
      return NextResponse.json({ error: "Either text content or media is required" }, { status: 400 })
    }

    const supabase = createServerClient()
    let mediaUrl: string | null = null
    let mediaType = loopType || "text"
    let treeDepth = 0

    if (parentLoopId) {
      const { data: parent } = await supabase
        .from("loops")
        .select("id, tree_depth")
        .eq("id", parentLoopId)
        .maybeSingle()

      if (!parent) {
        return NextResponse.json({ error: "Parent loop not found" }, { status: 404 })
      }
      treeDepth = (parent.tree_depth ?? 0) + 1
    }

    if (file && file.size > 0) {
      if (!isCloudinaryConfigured()) {
        return NextResponse.json(
          { error: "Media uploads are not configured. Add Cloudinary env vars on Vercel." },
          { status: 503 },
        )
      }

      if (file.type.startsWith("image/")) mediaType = "image"
      else if (file.type.startsWith("video/")) mediaType = "video"
      else if (file.type.startsWith("audio/")) mediaType = "audio"
      else mediaType = "file"

      const uploadResult = await uploadFileToCloudinary(file, "loops")
      mediaUrl = uploadResult.secure_url
    }

    const textContent = contentText.trim()
    // Live DB has NOT NULL `content` (text) plus normalized content_* columns.
    const payload: Record<string, unknown> = {
      author_id: user.id,
      content: textContent || (mediaUrl ? `Shared a ${mediaType}` : ""),
      content_text: textContent || null,
      content_title: contentTitle || textContent.slice(0, 80) || null,
      content_media_url: mediaUrl,
      media_url: mediaUrl,
      content_type: mediaType,
      media_type: mediaType,
      category,
      hashtags,
      parent_loop_id: parentLoopId,
      visibility,
      tree_depth: treeDepth,
      content_metadata: mediaMetadata || {},
    }

    let { data: loop, error } = await supabase
      .from("loops")
      .insert(payload)
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .single()

    // Retry without optional columns if PostgREST schema cache rejects any of them.
    if (error?.code === "PGRST204") {
      const optional = ["category", "content_metadata", "media_url", "media_type", "visibility"]
      for (const col of optional) {
        if (error?.code === "PGRST204" && String(error.message || "").includes(col)) {
          delete payload[col]
          ;({ data: loop, error } = await supabase
            .from("loops")
            .insert(payload)
            .select(`
              *,
              author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
              loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
            `)
            .single())
        }
      }
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

    for (const tag of hashtags) {
      await supabase.from("hashtags").upsert({ tag, usage_count: 1 }, { onConflict: "tag", ignoreDuplicates: false })
    }

    return NextResponse.json({ success: true, loop: normalizeLoop(loop) })
  } catch (error: any) {
    console.error("Create loop error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
