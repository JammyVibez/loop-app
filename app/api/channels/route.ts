import { NextRequest, NextResponse } from "next/server"
import {
  normalizeChannels,
  normalizeDramaProviders,
  normalizeNovelChapter,
  normalizeNovelDetails,
  normalizeNovels,
  normalizeResolvedStream,
} from "@/lib/channels"

/**
 * Server-side bridge to the UltraSrc API.
 *
 * The API key is read from the server environment only — the browser talks to
 * this route and never receives the key or an arbitrary upstream URL. Only the
 * documented endpoints below can be reached, so the route cannot be used as an
 * open proxy.
 *
 * Configure with:
 *   ULTRASRC_API_URL=https://your-ultrasrc-instance
 *   ULTRASRC_API_KEY=...
 */

export const dynamic = "force-dynamic"

const API_BASE = (process.env.ULTRASRC_API_URL ?? "").trim().replace(/\/+$/, "")
const API_KEY = (process.env.ULTRASRC_API_KEY ?? "").trim()

class ChannelApiError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

function upstreamOrigin(): string | null {
  if (!API_BASE) return null
  try {
    const url = new URL(API_BASE)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return API_BASE
  } catch {
    return null
  }
}

function encodePath(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function requireParam(value: string | null, name: string): string {
  const trimmed = value?.trim()
  if (!trimmed) throw new ChannelApiError(`${name} is required`, 400)
  if (trimmed.includes("..") || /[\u0000-\u001f]/.test(trimmed)) {
    throw new ChannelApiError(`Invalid ${name}`, 400)
  }
  return trimmed
}

function field(payload: unknown, keys: string[]): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null
  const record = payload as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function messageFrom(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback
  const record = payload as Record<string, unknown>
  const error = record.error
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message
    if (typeof message === "string" && message) return message
  }
  if (typeof error === "string" && error) return error
  if (typeof record.message === "string" && record.message) return record.message
  return fallback
}

async function readUpstream(
  path: string,
  search: Record<string, string | null | undefined>,
  revalidate: number,
): Promise<unknown> {
  const origin = upstreamOrigin()
  if (!origin) throw new ChannelApiError("UltraSrc API is not configured", 503)

  const url = new URL(`${origin}${path}`)
  for (const [key, value] of Object.entries(search)) {
    if (value) url.searchParams.set(key, value)
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      signal: AbortSignal.timeout(15000),
      ...(revalidate > 0 ? { next: { revalidate } } : { cache: "no-store" }),
    })
  } catch {
    throw new ChannelApiError("UltraSrc API did not respond", 504)
  }

  const raw = await response.text()
  let payload: unknown = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = { message: raw.slice(0, 300) }
    }
  }

  if (!response.ok) {
    const fallback =
      response.status === 401 || response.status === 403
        ? "UltraSrc API rejected the configured credentials"
        : `UltraSrc API returned ${response.status}`
    throw new ChannelApiError(messageFrom(payload, fallback), response.status === 401 ? 502 : response.status)
  }

  return payload
}

export async function GET(request: NextRequest) {
  const origin = upstreamOrigin()
  if (!origin) {
    return NextResponse.json({ ok: true, configured: false, data: null })
  }

  const params = request.nextUrl.searchParams
  const kind = params.get("kind") ?? "live"
  const src = params.get("src")

  try {
    switch (kind) {
      case "live": {
        const payload = await readUpstream(
          "/api/v1/live/channels",
          { src, group: params.get("group") },
          300,
        )
        const channels = normalizeChannels(payload)
        return NextResponse.json({
          ok: true,
          configured: true,
          data: { channels, total: channels.length },
        })
      }

      case "live-search": {
        const q = requireParam(params.get("q"), "q")
        const payload = await readUpstream("/api/v1/live/search", { q, src }, 300)
        const channels = normalizeChannels(payload)
        return NextResponse.json({
          ok: true,
          configured: true,
          data: { channels, total: channels.length },
        })
      }

      case "live-watch": {
        const id = requireParam(params.get("id"), "channel id")
        const payload = await readUpstream(`/api/v1/live/watch/${encodePath(id)}`, { src }, 0)
        const stream = normalizeResolvedStream(payload, origin)
        return NextResponse.json({
          ok: true,
          configured: true,
          data: {
            ...stream,
            title: stream.title ?? id,
            group: field(payload, ["group", "category", "country"]),
            // The documented, auth-exempt HLS route works even when the watch
            // payload exposes no direct URL.
            playbackUrl: stream.playbackUrl ?? `${origin}/api/v1/live/play/${encodePath(id)}.m3u8`,
          },
        })
      }

      case "dramas": {
        const payload = await readUpstream("/api/v1/drama/providers", {}, 86400)
        return NextResponse.json({
          ok: true,
          configured: true,
          data: { providers: normalizeDramaProviders(payload) },
        })
      }

      case "drama-watch": {
        const id = requireParam(params.get("id"), "drama")
        const episodeParam = params.get("episode") ?? "1"
        if (!/^\d+$/.test(episodeParam) || Number(episodeParam) < 1) {
          throw new ChannelApiError("episode must be a positive integer", 400)
        }
        const payload = await readUpstream(
          `/api/v1/drama/watch/${encodePath(id)}/${episodeParam}`,
          { src },
          0,
        )
        return NextResponse.json({
          ok: true,
          configured: true,
          data: normalizeResolvedStream(payload, origin),
        })
      }

      case "novels": {
        const q = requireParam(params.get("q"), "q")
        const payload = await readUpstream(
          "/api/v1/novel/search",
          { q, src, page: params.get("page") },
          300,
        )
        return NextResponse.json({
          ok: true,
          configured: true,
          data: { novels: normalizeNovels(payload) },
        })
      }

      case "novel": {
        const id = requireParam(params.get("id"), "novel id")
        const payload = await readUpstream(`/api/v1/novel/info/${encodePath(id)}`, { src }, 600)
        const novel = normalizeNovelDetails(payload)
        if (!novel) throw new ChannelApiError("Novel details were not available", 404)
        return NextResponse.json({ ok: true, configured: true, data: novel })
      }

      case "novel-read": {
        const chapter = requireParam(params.get("chapter"), "chapter id")
        const novel = params.get("novel")?.trim()
        // Some providers return a full chapter path, others only the chapter
        // slug under the novel id. Accept both without doubling the prefix.
        const path = chapter.includes("/")
          ? `/api/v1/novel/read/${encodePath(chapter)}`
          : novel
            ? `/api/v1/novel/read/${encodePath(novel)}/${encodePath(chapter)}`
            : `/api/v1/novel/read/${encodePath(chapter)}`
        const payload = await readUpstream(path, { src }, 600)
        return NextResponse.json({
          ok: true,
          configured: true,
          data: normalizeNovelChapter(payload),
        })
      }

      default:
        throw new ChannelApiError(`Unknown channel resource: ${kind}`, 400)
    }
  } catch (error) {
    const status = error instanceof ChannelApiError ? error.status : 502
    const message = error instanceof Error ? error.message : "Channel request failed"
    console.error(`[channels] ${kind} failed:`, message)
    return NextResponse.json({ ok: false, configured: true, error: message }, { status })
  }
}
