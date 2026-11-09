import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"
import { enforceUserRateLimit } from "@/lib/rate-limit-settings"
import { getMediaPolicy } from "@/lib/media/policy"
import {
  UploadError,
  resolveUploadActor,
  saveUpload,
  type UploadFamily,
} from "@/lib/media/upload-service"

/**
 * The one upload endpoint.
 *
 * Files arrive as the raw request body (not multipart) so a 500MB video can be
 * streamed to disk without buffering it in memory, and large uploads can be
 * sent in sequential chunks with `Content-Range` + `X-Upload-Id` — one dropped
 * chunk retries instead of restarting the whole file. Authentication, limits
 * and type detection all happen server-side in `saveUpload`.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function decodeHeader(value: string | null): string | undefined {
  if (!value) return undefined
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseContentRange(value: string | null): { start: number; end: number; total: number } | null {
  if (!value) return null
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(value.trim())
  if (!match) return null
  return { start: Number(match[1]), end: Number(match[2]), total: Number(match[3]) }
}

function normalizeFamily(value: string | null | undefined): UploadFamily {
  if (value === "video" || value === "audio" || value === "image" || value === "file") return value
  return "file"
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUser(request)
    if (response || !user) return response!

    const supabase = createServerClient()
    const actor = await resolveUploadActor(user.id, supabase)
    const policy = await getMediaPolicy(supabase)

    if (!actor.isAdmin) {
      const rate = await enforceUserRateLimit(supabase, "upload", user.id)
      if (!rate.ok) {
        return NextResponse.json(
          {
            error: "You're uploading too quickly. Please wait a moment and try again.",
            code: "rate_limited",
            retry_after: rate.retryAfter,
          },
          { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
        )
      }
    }

    const contentTypeFamily = normalizeFamily(request.headers.get("x-media-type"))
    const declaredFamily: UploadFamily =
      contentTypeFamily === "file"
        ? ((request.headers.get("x-media-family") as UploadFamily | null) ||
          (request.headers.get("content-type")?.startsWith("video/")
            ? "video"
            : request.headers.get("content-type")?.startsWith("audio/")
              ? "audio"
              : request.headers.get("content-type")?.startsWith("image/")
                ? "image"
                : "file"))
        : contentTypeFamily

    const rawLength = request.headers.get("content-length")
    const contentLength = rawLength ? Number(rawLength) : undefined
    const contentRange = parseContentRange(request.headers.get("content-range"))
    const uploadId = request.headers.get("x-upload-id") || undefined

    const originalQuality =
      request.headers.get("x-media-quality") === "original" || request.headers.get("x-media-quality") === "1"

    const chunk =
      contentRange && uploadId
        ? { uploadId: uploadId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64), ...contentRange }
        : undefined

    const result = await saveUpload({
      actor,
      policy,
      body: request.body,
      contentLength,
      declaredFamily,
      folder: decodeHeader(request.headers.get("x-media-folder")),
      purpose: decodeHeader(request.headers.get("x-media-purpose")),
      originalFilename: decodeHeader(request.headers.get("x-media-name")),
      mimeHint: request.headers.get("x-media-mime") || request.headers.get("content-type"),
      originalQuality,
      chunk,
      supabase,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent"),
    })

    // Intermediate chunk — nothing stored yet.
    if (!result.id) {
      return NextResponse.json(
        { success: true, partial: true, received: result.size },
        { status: 202 },
      )
    }

    return NextResponse.json({
      success: true,
      partial: false,
      ...result,
      // Legacy field names kept so older clients keep working unchanged.
      public_id: result.storage_path,
      media_type: result.media_type,
      url: result.url,
      provider: "vps",
    })
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error("[media] upload failed:", error)
    return NextResponse.json(
      { error: "Upload failed. Please try again.", code: "upload_failed" },
      { status: 500 },
    )
  }
}

/** Pre-flight: what can this account upload right now? */
export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireUser(request)
    if (response || !user) return response!

    const supabase = createServerClient()
    const actor = await resolveUploadActor(user.id, supabase)
    const policy = await getMediaPolicy(supabase)
    const disk = await import("@/lib/media/storage").then((m) => m.getDiskUsage())

    return NextResponse.json({
      success: true,
      tier: actor.isAdmin ? "admin" : actor.isPro ? "pro" : "free",
      is_admin: actor.isAdmin,
      original_quality_allowed: actor.isAdmin,
      limits: {
        hard_max_mb: policy.hard_max_mb,
        image_max_mb: actor.isAdmin ? policy.admin_image_max_mb : policy.image_max_mb,
        video_max_mb: actor.isAdmin ? policy.video_pro_mb : actor.isPro ? policy.video_pro_mb : policy.video_free_mb,
        voice_max_mb: policy.voice_max_mb,
        post_files: actor.isAdmin ? 50 : actor.isPro ? policy.post_files_pro : policy.post_files_free,
        quota_mb: actor.isPro ? policy.quota_pro_mb : policy.quota_free_mb,
        daily_upload_mb: actor.isPro ? policy.daily_upload_mb_pro : policy.daily_upload_mb_free,
        uploads_per_hour: policy.uploads_per_hour,
      },
      disk: {
        used_percent: disk.usedPercent,
        free_bytes: disk.freeBytes,
        warn: disk.usedPercent >= policy.disk_warn_percent,
        blocked: disk.usedPercent >= policy.disk_block_percent,
      },
      accepts: actor.isAdmin
        ? ["image/*", "video/*", "audio/*", "image/svg+xml", "application/lottie+json"]
        : ["image/*", "video/*", "audio/*"],
    })
  } catch (error) {
    console.error("[media] upload limits failed:", error)
    return NextResponse.json({ error: "Could not read upload limits" }, { status: 500 })
  }
}
