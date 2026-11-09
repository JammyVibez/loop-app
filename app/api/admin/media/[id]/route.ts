import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { createServerClient } from "@/lib/supabase"
import { getMediaPolicy } from "@/lib/media/policy"
import {
  deleteMediaAsset,
  getMediaById,
  replaceMediaFile,
  resolveUploadActor,
} from "@/lib/media/upload-service"
import { retryMediaJob } from "@/lib/media/queue"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Delete one media file (409 with references unless `?confirm=1`). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response || !user) return response!

    const { id } = await params
    const confirm = request.nextUrl.searchParams.get("confirm") === "1"
    const actor = await resolveUploadActor(user.id, createServerClient())

    const result = await deleteMediaAsset({
      actor,
      id,
      confirmReferenced: confirm,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent"),
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code, references: result.references },
        { status: result.status },
      )
    }
    return NextResponse.json({ success: true, warnings: result.warnings })
  } catch (error) {
    console.error("[admin/media] delete failed:", error)
    return NextResponse.json({ error: "Could not delete media" }, { status: 500 })
  }
}

/** Replace the bytes behind an existing URL (badges, frames, ad creatives). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response || !user) return response!

    const { id } = await params
    const supabase = createServerClient()
    const asset = await getMediaById(id)
    if (!asset) return NextResponse.json({ error: "Media not found" }, { status: 404 })

    const actor = await resolveUploadActor(user.id, supabase)
    const policy = await getMediaPolicy(supabase)

    const result = await replaceMediaFile({
      actor,
      policy,
      asset,
      body: request.body,
      contentLength: Number(request.headers.get("content-length") || 0) || undefined,
      mimeHint: request.headers.get("content-type"),
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent"),
    })

    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status })
    return NextResponse.json({ success: true, url: result.url })
  } catch (error) {
    console.error("[admin/media] replace failed:", error)
    return NextResponse.json({ error: "Could not replace media" }, { status: 500 })
  }
}

/** Re-run a failed transcode. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response
    const { id } = await params
    const result = await retryMediaJob(id)
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/media] retry failed:", error)
    return NextResponse.json({ error: "Could not retry processing" }, { status: 500 })
  }
}
