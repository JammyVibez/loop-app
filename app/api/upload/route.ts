import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { enforceUserRateLimit } from "@/lib/rate-limit-settings"
import { getMediaPolicy } from "@/lib/media/policy"
import {
  UploadError,
  deleteMediaAsset,
  resolveUploadActor,
  saveUpload,
  type UploadFamily,
} from "@/lib/media/upload-service"

/**
 * Legacy multipart upload endpoint, kept for older clients.
 *
 * It no longer talks to Cloudinary: every file is validated and stored by the
 * same VPS pipeline as `/api/media/upload`. New code should stream to
 * `/api/media/upload` instead, which supports files larger than a multipart
 * body and reports progress per chunk.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function familyFor(type: string | null, mime: string): UploadFamily {
  if (type === "video" || type === "audio" || type === "image") return type
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.startsWith("image/")) return "image"
  return "file"
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })

    const supabase = createServerClient()
    const actor = await resolveUploadActor(user.id, supabase)
    const policy = await getMediaPolicy(supabase)

    if (!actor.isAdmin) {
      const rate = await enforceUserRateLimit(supabase, "upload", user.id)
      if (!rate.ok) {
        return NextResponse.json(
          { error: "You're uploading too quickly. Please wait a moment.", code: "rate_limited" },
          { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
        )
      }
    }

    const contentType = request.headers.get("content-type") || ""
    let body: ReadableStream<Uint8Array> | null = null
    let declaredFamily: UploadFamily = "file"
    let folder = "general"
    let purpose: string | undefined
    let originalQuality = false
    let originalName = "upload"
    let mimeHint: string | undefined
    let contentLength: number | undefined

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file")
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }
      declaredFamily = familyFor(String(formData.get("type") || "") || null, file.type)
      folder = String(formData.get("folder") || "general")
      purpose = formData.get("purpose") ? String(formData.get("purpose")) : undefined
      originalQuality = String(formData.get("original_quality") || "") === "true"
      originalName = file.name || "upload"
      mimeHint = file.type
      contentLength = file.size
      body = file.stream() as unknown as ReadableStream<Uint8Array>
    } else {
      declaredFamily = familyFor(request.headers.get("x-media-type"), contentType)
      folder = request.headers.get("x-media-folder") || "general"
      purpose = request.headers.get("x-media-purpose") || undefined
      originalQuality = request.headers.get("x-media-quality") === "original"
      originalName = decodeURIComponent(request.headers.get("x-media-name") || "upload")
      mimeHint = contentType
      contentLength = Number(request.headers.get("content-length") || 0) || undefined
      body = request.body
    }

    const result = await saveUpload({
      actor,
      policy,
      body,
      contentLength,
      declaredFamily,
      folder,
      purpose,
      originalFilename: originalName,
      mimeHint,
      originalQuality,
      supabase,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({
      success: true,
      url: result.url,
      public_id: result.storage_path,
      id: result.id,
      media_type: result.media_type,
      width: result.width,
      height: result.height,
      duration: result.duration,
      format: result.format,
      status: result.status,
      thumb_url: result.thumb_url,
      poster_url: result.poster_url,
      variants: result.variants,
      media_record: { id: result.id, url: result.url },
    })
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error("[upload] failed:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const storagePath = searchParams.get("public_id")
    const supabase = createServerClient()

    let mediaId = id
    if (!mediaId && storagePath) {
      const { data } = await supabase
        .from("media_uploads")
        .select("id")
        .eq("storage_path", storagePath)
        .maybeSingle()
      mediaId = data?.id || null
    }

    if (!mediaId) return NextResponse.json({ error: "Media ID required" }, { status: 400 })

    const actor = await resolveUploadActor(user.id, supabase)
    const result = await deleteMediaAsset({ actor, id: mediaId })
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[upload] delete failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
