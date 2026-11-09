import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/server-auth"
import { saveBundle } from "@/lib/media/bundles"
import { UploadError } from "@/lib/media/upload-service"
import { createServerClient } from "@/lib/supabase"
import { enforceUserRateLimit } from "@/lib/rate-limit-settings"

/**
 * Storage for developer-project source files and ZIP archives.
 *
 * These are code, not media, so they are never written under `/media` and never
 * served as anything a browser could execute. Uploads require a session; reads
 * go through `/api/media/bundle/[token]`, which always answers as a plain-text
 * attachment.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUser(request)
    if (response || !user) return response!

    const rate = await enforceUserRateLimit(createServerClient(), "upload", user.id)
    if (!rate.ok) {
      return NextResponse.json(
        { error: "You're uploading too quickly. Please wait a moment.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      )
    }

    const filename = decodeURIComponent(request.headers.get("x-bundle-name") || "file")
    const result = await saveBundle(request.body, {
      filename,
      contentLength: Number(request.headers.get("content-length") || 0) || undefined,
    })

    return NextResponse.json({ success: true, url: result.url, token: result.token, size: result.size })
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error("[media] bundle upload failed:", error)
    return NextResponse.json({ error: "Could not store the project file" }, { status: 500 })
  }
}
