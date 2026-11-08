/**
 * Channel guide data model.
 *
 * The UltraSrc API is the source of truth for live TV, Asian drama and novel
 * data, but its upstream providers change shape more often than this app ships.
 * Everything here is therefore read defensively: unknown payloads are mapped to
 * one small, stable model at the edge (`/api/channels`), and the UI only ever
 * deals with these types.
 *
 * This module is intentionally free of server imports so both the route handler
 * and client components can use it.
 */

export type ChannelTab = "all" | "live" | "drama" | "novel"

export const CHANNEL_TABS: { id: ChannelTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live TV" },
  { id: "drama", label: "Dramas" },
  { id: "novel", label: "Novels" },
]

export interface LiveChannel {
  id: string
  name: string
  group: string
  logo: string | null
  number: string | null
}

export interface DramaProvider {
  id: string
  name: string
  mirrors: string[]
}

export interface NovelSummary {
  id: string
  title: string
  cover: string | null
  author: string | null
  status: string | null
  chapters: number | null
  description: string | null
  provider: string | null
}

export interface NovelChapterRef {
  id: string
  title: string
  number: number | null
}

export interface NovelDetails extends NovelSummary {
  chapterList: NovelChapterRef[]
}

export interface NovelChapter {
  title: string | null
  paragraphs: string[]
}

export interface ResolvedStream {
  title: string | null
  engine: string | null
  playbackUrl: string | null
  sources: string[]
  subtitles: { label: string; lang: string; url: string }[]
  embedUrl: string | null
  errors: string[]
}

type Json = Record<string, unknown>

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

function pick(record: Json, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && value !== "") return value
  }
  return undefined
}

function pickText(record: Json, keys: readonly string[]): string | null {
  return text(pick(record, keys))
}

function pickNumber(record: Json, keys: readonly string[]): number | null {
  const value = pick(record, keys)
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

/** First array found under one of `keys`, or the payload itself when it is one. */
export function firstList(payload: unknown, keys: readonly string[]): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []
  for (const key of keys) {
    const value = payload[key]
    if (Array.isArray(value)) return value
  }
  return []
}

/** Resolve an API-provided path against the API origin, leaving absolute media URLs alone. */
export function toAbsolute(url: string | null | undefined, baseUrl?: string): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (!baseUrl) return null
  try {
    return new URL(url, baseUrl.replace(/\/+$/, "") + "/").href
  } catch {
    return null
  }
}

export function normalizeChannels(payload: unknown): LiveChannel[] {
  const seen = new Set<string>()
  const channels: LiveChannel[] = []

  for (const entry of firstList(payload, ["channels", "results", "data", "items"])) {
    if (!isRecord(entry)) continue
    const name = pickText(entry, ["name", "title", "channelName", "channel_name"])
    const id =
      pickText(entry, ["id", "channelId", "channel_id", "slug", "code", "tvgId"]) ?? name
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    channels.push({
      id,
      name,
      group: pickText(entry, ["group", "groupTitle", "category", "country", "tvgGroup"]) ?? "Live TV",
      logo: pickText(entry, [
        "logo",
        "tvgLogo",
        "tvg-logo",
        "icon",
        "image",
        "thumbnail",
        "logoUrl",
      ]),
      number: pickText(entry, ["number", "channelNumber", "channel_number", "chno", "tvgChno", "lcn"]),
    })
  }

  return channels
}

export function normalizeDramaProviders(payload: unknown): DramaProvider[] {
  return firstList(payload, ["providers", "results", "data"])
    .map((entry): DramaProvider | null => {
      if (typeof entry === "string") {
        const name = text(entry)
        return name ? { id: name.toLowerCase(), name, mirrors: [] } : null
      }
      if (!isRecord(entry)) return null
      const name = pickText(entry, ["name", "title", "label"])
      const id = pickText(entry, ["id", "slug", "provider"]) ?? name?.toLowerCase()
      if (!id || !name) return null
      return {
        id,
        name,
        mirrors: asArray(pick(entry, ["mirrors", "hosts", "domains"]))
          .map(text)
          .filter((value): value is string => Boolean(value)),
      }
    })
    .filter((provider): provider is DramaProvider => provider !== null)
}

function normalizeNovel(entry: Json, fallbackProvider: string | null): NovelSummary | null {
  const title = pickText(entry, ["title", "name", "novelTitle"])
  const id = pickText(entry, ["id", "slug", "novelId", "novel_id", "url"]) ?? title
  if (!id || !title) return null

  const chapterValue = pick(entry, ["chapters", "chapterList", "chapter_list"])
  const chapterCount =
    pickNumber(entry, ["chapterCount", "totalChapters", "total_chapters", "chapters"]) ??
    (Array.isArray(chapterValue) ? chapterValue.length : null)

  const authorValue = pick(entry, ["author", "authors", "writer"])
  const author = Array.isArray(authorValue)
    ? authorValue.map(text).filter(Boolean).join(", ") || null
    : text(authorValue)

  return {
    id,
    title,
    cover: pickText(entry, ["cover", "image", "poster", "thumbnail", "coverImage", "cover_url"]),
    author,
    status: pickText(entry, ["status", "releaseStatus"]),
    chapters: chapterCount,
    description: pickText(entry, ["description", "synopsis", "summary", "overview"]),
    provider: pickText(entry, ["provider", "src", "source"]) ?? fallbackProvider,
  }
}

export function normalizeNovels(payload: unknown): NovelSummary[] {
  const fallbackProvider = isRecord(payload)
    ? pickText(payload, ["provider", "src", "source"])
    : null
  return firstList(payload, ["results", "novels", "data", "items"])
    .map((entry) => (isRecord(entry) ? normalizeNovel(entry, fallbackProvider) : null))
    .filter((novel): novel is NovelSummary => novel !== null)
}

export function normalizeNovelDetails(payload: unknown): NovelDetails | null {
  if (!isRecord(payload)) return null
  const base = normalizeNovel(payload, pickText(payload, ["provider", "src", "source"]))
  if (!base) return null

  const chapters = asArray(pick(payload, ["chapters", "chapterList", "chapter_list", "episodes"]))
    .map((entry, index): NovelChapterRef | null => {
      if (typeof entry === "string") {
        const title = text(entry)
        return title ? { id: title, title, number: index + 1 } : null
      }
      if (!isRecord(entry)) return null
      const title = pickText(entry, ["title", "name", "chapterTitle"]) ?? `Chapter ${index + 1}`
      const id = pickText(entry, ["id", "chapterId", "chapter_id", "slug", "url"]) ?? title
      return { id, title, number: pickNumber(entry, ["number", "chapterNumber", "index", "order"]) ?? index + 1 }
    })
    .filter((chapter): chapter is NovelChapterRef => chapter !== null)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))

  return { ...base, chapters: base.chapters ?? chapters.length, chapterList: chapters }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&#x27;/gi, "'")
}

function toParagraphs(raw: string): string[] {
  const withBreaks = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")

  return decodeEntities(withBreaks)
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
}

export function normalizeNovelChapter(payload: unknown): NovelChapter {
  if (!isRecord(payload)) return { title: null, paragraphs: [] }
  const title = pickText(payload, ["title", "chapterTitle", "name"])
  const raw = pick(payload, ["paragraphs", "content", "text", "html", "body", "chapter"])
  const listed = Array.isArray(raw) ? raw.map(text).filter((line): line is string => Boolean(line)) : null

  return {
    title,
    paragraphs: listed ?? (typeof raw === "string" ? toParagraphs(raw) : []),
  }
}

export function normalizeResolvedStream(payload: unknown, baseUrl?: string): ResolvedStream {
  const record = isRecord(payload) ? payload : {}
  const playbackList = asArray(record.playback).map(text).filter((url): url is string => Boolean(url))
  const playbackString = typeof record.playback === "string" ? record.playback : null
  const playbackUrls = asArray(record.playbackUrls).map(text).filter((url): url is string => Boolean(url))
  const sources = asArray(record.sources)
    .map((entry) => (isRecord(entry) ? pickText(entry, ["url", "file", "src"]) : text(entry)))
    .filter((url): url is string => Boolean(url))

  const playbackUrl =
    playbackUrls[0] ??
    toAbsolute(playbackList[0] ?? playbackString, baseUrl) ??
    sources[0] ??
    null

  const subtitles = asArray(record.subtitles)
    .map((entry) => {
      if (!isRecord(entry)) return null
      const url = pickText(entry, ["x", "url", "file"])
      if (!url) return null
      const label = pickText(entry, ["label", "language", "lang"]) ?? "Subtitles"
      return {
        label,
        lang: pickText(entry, ["lang", "language", "srclang"]) ?? "en",
        url: toAbsolute(url, baseUrl) ?? url,
      }
    })
    .filter((track): track is { label: string; lang: string; url: string } => track !== null)

  const errors = [
    ...asArray(record.extractionErrors).map(text),
    ...asArray(record.subtitleErrors).map(text),
  ].filter((message): message is string => Boolean(message))

  return {
    title: pickText(record, ["title", "name", "channel"]),
    engine: pickText(record, ["engine", "provider", "src"]),
    playbackUrl,
    sources,
    subtitles,
    embedUrl: toAbsolute(pickText(record, ["embed", "embedUrl"]), baseUrl),
    errors,
  }
}
