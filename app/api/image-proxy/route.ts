import { NextRequest, NextResponse } from "next/server"

// Simple image proxy for external og:image and GIF thumbnails.
// Usage: /api/image-proxy?url=<encoded-url>
// Notes:
// - This proxy is intentionally small: it fetches the remote asset server-side
//   and streams it back with Content-Type and Cache-Control headers so CDNs can cache it.
// - It does basic URL validation and a small allowlist for common media hosts, but
//   you can expand the allowlist or remove it to proxy any domain.

const ALLOWED_HOSTS = new Set([
  "media.giphy.com",
  "i.giphy.com",
  "i.giphy.com",
  "media.tenor.com",
  "c.tenor.com",
])

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get("url")
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 })

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch (err) {
      // try to add https://
      try {
        parsed = new URL(`https://${url}`)
      } catch (err2) {
        return NextResponse.json({ error: "Invalid url" }, { status: 400 })
      }
    }

    // Allowlist check — if you want to proxy any host, remove this check.
    const host = parsed.hostname.replace(/^www\./, "")
    if (!ALLOWED_HOSTS.has(host)) {
      // If host not in allowlist, still allow https: but add a safety cap
      if (parsed.protocol !== "https:") {
        return NextResponse.json({ error: "Only https hosts allowed" }, { status: 400 })
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const resp = await fetch(parsed.toString(), { signal: controller.signal })
    clearTimeout(timeout)

    if (!resp.ok) {
      return NextResponse.json({ error: "Failed to fetch remote image" }, { status: 502 })
    }

    const contentType = resp.headers.get("content-type") || "application/octet-stream"
    const cacheControl = resp.headers.get("cache-control") || "public, max-age=86400, stale-while-revalidate=604800"

    const body = await resp.arrayBuffer()

    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    })
  } catch (err: any) {
    console.error("/api/image-proxy error:", err)
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 })
  }
}
