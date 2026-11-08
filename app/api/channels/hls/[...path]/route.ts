import { NextRequest } from "next/server"
import { rewriteHlsPlaylist } from "@/lib/channels-hls"

/**
 * Same-origin playback bridge for Channels.
 *
 * `ULTRASRC_API_URL` may point at a loopback address (the API runs next to the
 * app and is not exposed publicly). The manifests and media tickets it returns
 * are absolute URLs on that private origin, so the browser cannot fetch them
 * and cannot send the bearer key. This route forwards manifests and segments on
 * the app's own origin, keeps the key server-side, and rewrites playlist
 * references into proxy paths.
 *
 * Only paths under the configured API are reachable here — this is not an open
 * proxy, and traversal segments are rejected.
 */

export const dynamic = "force-dynamic"

const API_BASE = (process.env.ULTRASRC_API_URL ?? "").trim().replace(/\/+$/, "")
const API_KEY = (process.env.ULTRASRC_API_KEY ?? "").trim()

function isInvalidSegment(segment: string): boolean {
  return segment === ".." || segment.includes("\\") || /[\u0000-\u001f]/.test(segment)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!API_BASE) {
    return new Response("UltraSrc API is not configured", { status: 503 })
  }

  const { path } = await params
  const segments = (path ?? []).filter((segment) => segment.length > 0)
  if (!segments.length || segments.some(isInvalidSegment)) {
    return new Response("Invalid media path", { status: 400 })
  }

  const upstreamPath = `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`
  const target = new URL(`${API_BASE}${upstreamPath}`)
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value))

  const headers: Record<string, string> = { Accept: "*/*" }
  const range = request.headers.get("range")
  if (range) headers.Range = range
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`

  let upstream: Response
  try {
    upstream = await fetch(target, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    })
  } catch {
    return new Response("UltraSrc API did not respond", { status: 504 })
  }

  if (!upstream.ok && upstream.status !== 206) {
    console.error(`[channels] playback proxy failed: ${upstream.status} ${upstreamPath}`)
    return new Response(`UltraSrc API returned ${upstream.status}`, { status: upstream.status })
  }

  const contentType = upstream.headers.get("content-type") ?? ""
  if (/mpegurl/i.test(contentType)) {
    const text = await upstream.text()
    const directory = upstreamPath.slice(0, upstreamPath.lastIndexOf("/") + 1)
    return new Response(rewriteHlsPlaylist(text, { upstreamOrigin: API_BASE, directory }), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }

  // Segments are streamed rather than buffered so playback starts immediately
  // and long channels do not sit in memory.
  const passthrough = new Headers()
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(key)
    if (value) passthrough.set(key, value)
  }
  passthrough.set("Cache-Control", "no-store")

  return new Response(upstream.body, { status: upstream.status, headers: passthrough })
}
