import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { mapEpisodeRow, mapTitleRow, sortEpisodes } from "@/lib/channels-library"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** One published title, with its episode list when it is a series. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, configured: true, error: "Title not found" }, { status: 404 })
  }

  try {
    const supabase = createServerClient()

    const { data: row, error } = await supabase
      .from("channel_titles")
      .select(
        "id, kind, title, synopsis, poster_url, backdrop_url, video_url, year, country, language, genres, runtime_minutes, featured, published, created_at",
      )
      .eq("id", id)
      .eq("published", true)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!row) {
      return NextResponse.json({ ok: false, configured: true, error: "Title not found" }, { status: 404 })
    }

    const title = mapTitleRow(row)
    if (!title) {
      return NextResponse.json({ ok: false, configured: true, error: "Title not found" }, { status: 404 })
    }

    let episodes: ReturnType<typeof mapEpisodeRow>[] = []
    if (title.kind === "series") {
      const { data: episodeRows, error: episodeError } = await supabase
        .from("channel_episodes")
        .select("id, title_id, season, episode, name, synopsis, video_url, duration_seconds")
        .eq("title_id", id)
        .order("season", { ascending: true })
        .order("episode", { ascending: true })

      if (episodeError) throw new Error(episodeError.message)
      episodes = (episodeRows ?? []).map((episode) => mapEpisodeRow(episode))
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      data: {
        ...title,
        videoUrl: typeof row.video_url === "string" ? row.video_url : null,
        episodes: sortEpisodes(
          episodes.filter((episode): episode is NonNullable<typeof episode> => episode !== null),
        ),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "The title is unavailable"
    console.error("[channels/library] detail failed:", message)
    return NextResponse.json({ ok: false, configured: true, error: message }, { status: 502 })
  }
}
