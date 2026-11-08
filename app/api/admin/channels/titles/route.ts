import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { isChannelTitleKind, mapTitleRow } from "@/lib/channels-library"

export const dynamic = "force-dynamic"

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

function genreList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : []
  return raw
    .map((entry) => (typeof entry === "string" ? entry.trim().slice(0, 40) : ""))
    .filter(Boolean)
    .slice(0, 12)
}

/** GET — every title, drafts included, for the admin library screen. */
export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("channel_titles")
      .select(ADMIN_COLUMNS)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)

    const episodesByTitle = new Map<string, number>()
    const { data: episodeRows } = await supabase.from("channel_episodes").select("title_id")
    for (const row of episodeRows ?? []) {
      episodesByTitle.set(row.title_id, (episodesByTitle.get(row.title_id) ?? 0) + 1)
    }

    const titles = (data ?? []).map((row) => {
      const mapped = mapTitleRow(row)
      if (mapped) mapped.episodeCount = episodesByTitle.get(mapped.id) ?? 0
      return mapped && { ...mapped, videoUrl: row.video_url }
    })

    return NextResponse.json({ ok: true, data: { titles: titles.filter(Boolean) } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the library"
    console.error("[admin/channels] list failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

/** POST — add a movie or show. */
export async function POST(request: NextRequest) {
  const { user, response } = await requireAdmin(request)
  if (response) return response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  const title = text(body.title, 160)
  const kind = isChannelTitleKind(body.kind) ? body.kind : null
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
  if (!kind) return NextResponse.json({ error: "Choose movie or series" }, { status: 400 })

  const videoUrl = text(body.videoUrl ?? body.video_url, 2048)
  if (kind === "movie" && !videoUrl) {
    return NextResponse.json({ error: "A movie needs a video file or URL" }, { status: 400 })
  }

  const insert = {
    kind,
    title,
    synopsis: text(body.synopsis, 4000),
    poster_url: text(body.posterUrl ?? body.poster_url, 2048),
    backdrop_url: text(body.backdropUrl ?? body.backdrop_url, 2048),
    video_url: videoUrl,
    year: integer(body.year, 1888, 2200),
    country: text(body.country, 80),
    language: text(body.language, 80),
    genres: genreList(body.genres),
    runtime_minutes: integer(body.runtimeMinutes ?? body.runtime_minutes, 1, 6000),
    featured: Boolean(body.featured),
    published: body.published === undefined ? true : Boolean(body.published),
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("channel_titles")
      .insert({ ...insert, created_by: user?.id ?? null })
      .select(ADMIN_COLUMNS)
      .single()

    if (error) throw new Error(error.message)
    const mapped = mapTitleRow(data)
    return NextResponse.json(
      { ok: true, data: { title: mapped && { ...mapped, videoUrl: data.video_url } } },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the title"
    console.error("[admin/channels] create failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
