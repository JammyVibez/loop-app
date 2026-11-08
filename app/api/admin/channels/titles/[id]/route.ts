import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { mapTitleRow } from "@/lib/channels-library"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ADMIN_COLUMNS =
  "id, kind, title, synopsis, poster_url, backdrop_url, video_url, year, country, language, genres, runtime_minutes, featured, published, created_by, created_at, updated_at"

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function integer(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return null
  const rounded = Math.trunc(parsed)
  return rounded >= min && rounded <= max ? rounded : null
}

/** PATCH — edit a title, publish/unpublish it, or change its artwork. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Title not found" }, { status: 404 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.title !== undefined) {
    const title = text(body.title, 160)
    if (!title) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 })
    update.title = title
  }
  if (body.synopsis !== undefined) update.synopsis = text(body.synopsis, 4000)
  if (body.posterUrl !== undefined || body.poster_url !== undefined) {
    update.poster_url = text(body.posterUrl ?? body.poster_url, 2048)
  }
  if (body.backdropUrl !== undefined || body.backdrop_url !== undefined) {
    update.backdrop_url = text(body.backdropUrl ?? body.backdrop_url, 2048)
  }
  if (body.videoUrl !== undefined || body.video_url !== undefined) {
    update.video_url = text(body.videoUrl ?? body.video_url, 2048)
  }
  if (body.year !== undefined) update.year = integer(body.year, 1888, 2200)
  if (body.country !== undefined) update.country = text(body.country, 80)
  if (body.language !== undefined) update.language = text(body.language, 80)
  if (body.runtimeMinutes !== undefined || body.runtime_minutes !== undefined) {
    update.runtime_minutes = integer(body.runtimeMinutes ?? body.runtime_minutes, 1, 6000)
  }
  if (body.genres !== undefined) {
    const raw = Array.isArray(body.genres)
      ? body.genres
      : typeof body.genres === "string"
        ? body.genres.split(",")
        : []
    update.genres = raw
      .map((entry) => (typeof entry === "string" ? entry.trim().slice(0, 40) : ""))
      .filter(Boolean)
      .slice(0, 12)
  }
  if (body.featured !== undefined) update.featured = Boolean(body.featured)
  if (body.published !== undefined) update.published = Boolean(body.published)

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("channel_titles")
      .update(update)
      .eq("id", id)
      .select(ADMIN_COLUMNS)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: "Title not found" }, { status: 404 })

    const mapped = mapTitleRow(data)
    return NextResponse.json({ ok: true, data: { title: mapped && { ...mapped, videoUrl: data.video_url } } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the title"
    console.error("[admin/channels] update failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

/** DELETE — remove a title (episodes cascade). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Title not found" }, { status: 404 })

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from("channel_titles").delete().eq("id", id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the title"
    console.error("[admin/channels] delete failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
