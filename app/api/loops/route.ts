import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoop, normalizeLoops } from "@/lib/normalize-loop"

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

async function uploadToCloudinary(file: File, resourceType: "image" | "video" | "raw" = "raw") {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET!)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", body: formData as any },
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error("Cloudinary upload error details:", errorData)
    throw new Error("Failed to upload file")
  }

  return response.json()
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
    let scheduledFor: string | null = null
    let pollOptions: any = null
    let mediaMetadata: any = null

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
      scheduledFor = (formData.get("scheduled_for") as string | null) || null
      pollOptions = formData.get("poll_options") ? JSON.parse(String(formData.get("poll_options"))) : null
      mediaMetadata = formData.get("media_metadata") ? JSON.parse(String(formData.get("media_metadata"))) : null
    } else {
      const body = await request.json().catch(() => ({}))
      contentText = String(body.content_text ?? body.content ?? "")
      contentTitle = body.content_title ?? body.title ?? null
      loopType = body.content_type ?? body.type ?? "text"
      category = body.category ?? "general"
      hashtags = parseHashtags(body.hashtags)
      parentLoopId = body.parent_loop_id ?? null
      visibility = body.visibility ?? (body.is_public === false ? "private" : "public")
      scheduledFor = body.scheduled_for ?? null
      pollOptions = body.poll_options ?? null
      mediaMetadata = body.media_metadata ?? null
    }

    hashtags = hashtags.map((tag) => String(tag).replace(/^#/, "").toLowerCase().trim()).filter(Boolean)

    if (!contentText.trim() && (!file || file.size === 0)) {
      return NextResponse.json({ error: "Either text content or media is required" }, { status: 400 })
    }

    const supabase = createServerClient()
    let mediaUrl: string | null = null
    let mediaType = loopType || "text"

    if (file && file.size > 0) {
      let resourceType: "image" | "video" | "raw" = "raw"
      if (file.type.startsWith("image/")) {
        resourceType = "image"
        mediaType = "image"
      } else if (file.type.startsWith("video/")) {
        resourceType = "video"
        mediaType = "video"
      } else if (file.type.startsWith("audio/")) {
        resourceType = "video"
        mediaType = "audio"
      } else {
        mediaType = "file"
      }

      const uploadResult = await uploadToCloudinary(file, resourceType)
      mediaUrl = uploadResult.secure_url
    }

    const { data: loop, error } = await supabase
      .from("loops")
      .insert({
        author_id: user.id,
        content_text: contentText.trim(),
        content_title: contentTitle || contentText.trim().slice(0, 80) || null,
        content_media_url: mediaUrl,
        content_type: mediaType,
        category,
        hashtags,
        parent_loop_id: parentLoopId,
        visibility,
        scheduled_for: scheduledFor,
        poll_options: pollOptions,
        media_metadata: mediaMetadata,
      })
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .single()

    if (error) {
      console.error("Supabase POST error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from("loop_stats").insert({
      loop_id: loop.id,
      likes_count: 0,
      comments_count: 0,
      shares_count: 0,
      views_count: 0,
      branches_count: 0,
    })

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
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
