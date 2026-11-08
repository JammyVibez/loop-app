import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { mapEpisodeRow, sortEpisodes } from "@/lib/channels-library"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EPISODE_COLUMNS = "id, title_id, season, episode, name, synopsis, video_url, duration_seconds"

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function positiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.trunc(parsed)
  return rounded > 0 && rounded < 10000 ? rounded : fallback
}

function episodesOf(rows: unknown[]) {
  return sortEpisodes(
    rows
      .map((row) => mapEpisodeRow(row))
      .filter((episode): episode is NonNullable<ReturnType<typeof mapEpisodeRow>> => episode !== null),
  )
}

/** GET ?titleId= — the episode list for one show. */
export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const titleId = request.nextUrl.searchParams.get("titleId") ?? ""
  if (!UUID_RE.test(titleId)) {
    return NextResponse.json({ error: "A valid titleId is required" }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("channel_episodes")
      .select(EPISODE_COLUMNS)
      .eq("title_id", titleId)
      .order("season", { ascending: true })
      .order("episode", { ascending: true })

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, data: { episodes: episodesOf(data ?? []) } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load episodes"
    console.error("[admin/channels] episodes list failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

/**
 * POST — add an episode, or replace the file of an existing episode.
 * Season/episode pairs are unique per show, so re-submitting one updates it.
 */
export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  const titleId = typeof body.titleId === "string" ? body.titleId : ""
  const videoUrl = text(body.videoUrl ?? body.video_url, 2048)
  if (!UUID_RE.test(titleId)) {
    return NextResponse.json({ error: "A valid titleId is required" }, { status: 400 })
  }
  if (!videoUrl) {
    return NextResponse.json({ error: "An episode needs a video file or URL" }, { status: 400 })
  }

  const season = positiveInt(body.season, 1)
  const episode = positiveInt(body.episode, 1)

  try {
    const supabase = createServerClient()

    const { data: title, error: titleError } = await supabase
      .from("channel_titles")
      .select("id, kind")
      .eq("id", titleId)
      .maybeSingle()

    if (titleError) throw new Error(titleError.message)
    if (!title) return NextResponse.json({ error: "Title not found" }, { status: 404 })
    if (title.kind !== "series") {
      return NextResponse.json({ error: "Episodes can only be added to a series" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("channel_episodes")
      .upsert(
        {
          title_id: titleId,
          season,
          episode,
          name: text(body.name, 200),
          synopsis: text(body.synopsis, 2000),
          video_url: videoUrl,
          duration_seconds: body.durationSeconds ? positiveInt(body.durationSeconds, 0) || null : null,
        },
        { onConflict: "title_id,season,episode" },
      )
      .select(EPISODE_COLUMNS)
      .single()

    if (error) throw new Error(error.message)
    const mapped = mapEpisodeRow(data)
    return NextResponse.json({ ok: true, data: { episode: mapped } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the episode"
    console.error("[admin/channels] episode save failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

/** DELETE ?id= — remove one episode. */
export async function DELETE(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const id = request.nextUrl.searchParams.get("id") ?? ""
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Episode not found" }, { status: 404 })

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from("channel_episodes").delete().eq("id", id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the episode"
    console.error("[admin/channels] episode delete failed:", message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
