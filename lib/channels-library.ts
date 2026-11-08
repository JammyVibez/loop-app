/**
 * First-party channel library: movies and shows that staff upload themselves.
 *
 * These rows live in Supabase (`channel_titles` / `channel_episodes`) rather
 * than coming from UltraSrc, so the types here are shape-stable and only need
 * defensive mapping for values PostgREST may hand back loosely.
 */

export type ChannelTitleKind = "movie" | "series"

export interface ChannelTitle {
  id: string
  kind: ChannelTitleKind
  title: string
  synopsis: string | null
  poster: string | null
  backdrop: string | null
  year: number | null
  country: string | null
  language: string | null
  genres: string[]
  runtimeMinutes: number | null
  featured: boolean
  published: boolean
  episodeCount: number
  createdAt: string | null
}

export interface ChannelEpisode {
  id: string
  titleId: string
  season: number
  episode: number
  name: string | null
  synopsis: string | null
  videoUrl: string
  durationSeconds: number | null
}

export interface ChannelTitleDetails extends ChannelTitle {
  videoUrl: string | null
  episodes: ChannelEpisode[]
}

type Row = Record<string, unknown>

function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function str(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") return value === "true"
  return fallback
}

function genres(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(str).filter((entry): entry is string => Boolean(entry))
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

export function isChannelTitleKind(value: unknown): value is ChannelTitleKind {
  return value === "movie" || value === "series"
}

/** Map a `channel_titles` row (optionally with embedded episodes) to the app model. */
export function mapTitleRow(row: unknown): ChannelTitle | null {
  if (!isRecord(row)) return null
  const id = str(row.id)
  const title = str(row.title)
  const kind = isChannelTitleKind(row.kind) ? row.kind : null
  if (!id || !title || !kind) return null

  const embedded = Array.isArray(row.channel_episodes) ? row.channel_episodes : []

  return {
    id,
    kind,
    title,
    synopsis: str(row.synopsis),
    poster: str(row.poster_url),
    backdrop: str(row.backdrop_url),
    year: num(row.year),
    country: str(row.country),
    language: str(row.language),
    genres: genres(row.genres),
    runtimeMinutes: num(row.runtime_minutes),
    featured: bool(row.featured),
    published: bool(row.published, true),
    episodeCount: embedded.length,
    createdAt: str(row.created_at),
  }
}

export function mapEpisodeRow(row: unknown): ChannelEpisode | null {
  if (!isRecord(row)) return null
  const id = str(row.id)
  const titleId = str(row.title_id)
  const videoUrl = str(row.video_url)
  if (!id || !titleId || !videoUrl) return null

  return {
    id,
    titleId,
    season: num(row.season) ?? 1,
    episode: num(row.episode) ?? 1,
    name: str(row.name),
    synopsis: str(row.synopsis),
    videoUrl,
    durationSeconds: num(row.duration_seconds),
  }
}

/** Episodes always read season-first, then episode number. */
export function sortEpisodes(episodes: ChannelEpisode[]): ChannelEpisode[] {
  return [...episodes].sort((a, b) =>
    a.season === b.season ? a.episode - b.episode : a.season - b.season,
  )
}

export function episodeLabel(episode: ChannelEpisode): string {
  return `S${episode.season} · E${episode.episode}`
}

export function runtimeLabel(minutes: number | null): string | null {
  if (!minutes || minutes < 1) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}m`
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}
