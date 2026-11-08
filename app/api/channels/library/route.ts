import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { isChannelTitleKind, mapTitleRow } from "@/lib/channels-library"

export const dynamic = "force-dynamic"

/**
 * Public catalogue of movies and shows uploaded by staff.
 *
 * Only published rows are ever returned, and the service-role client stays on
 * the server so the browser cannot read drafts or write anything.
 */

const TITLE_COLUMNS =
  "id, kind, title, synopsis, poster_url, backdrop_url, year, country, language, genres, runtime_minutes, featured, published, created_at"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const kind = params.get("kind")
  const q = (params.get("q") ?? "").trim()
  const requested = Number(params.get("limit"))
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 200) : 60

  try {
    const supabase = createServerClient()

    let query = supabase
      .from("channel_titles")
      .select(TITLE_COLUMNS)
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit)

    if (isChannelTitleKind(kind)) query = query.eq("kind", kind)
    if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const titles = (data ?? [])
      .map((row) => mapTitleRow(row))
      .filter((title): title is NonNullable<ReturnType<typeof mapTitleRow>> => title !== null)

    // Episode counts are a separate cheap query rather than an embedded select,
    // which keeps the typed Supabase client happy on this schema.
    const seriesIds = titles.filter((title) => title.kind === "series").map((title) => title.id)
    if (seriesIds.length) {
      const { data: episodeRows } = await supabase
        .from("channel_episodes")
        .select("title_id")
        .in("title_id", seriesIds)
      const counts = new Map<string, number>()
      for (const row of episodeRows ?? []) {
        counts.set(row.title_id, (counts.get(row.title_id) ?? 0) + 1)
      }
      for (const title of titles) {
        if (title.kind === "series") title.episodeCount = counts.get(title.id) ?? 0
      }
    }

    return NextResponse.json({ ok: true, configured: true, data: { titles } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "The channel library is unavailable"
    console.error("[channels/library] list failed:", message)
    return NextResponse.json({ ok: false, configured: true, error: message }, { status: 502 })
  }
}
