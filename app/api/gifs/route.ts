import { NextRequest, NextResponse } from "next/server"

// Merged GIF search endpoint — queries Tenor and Giphy (when API keys are available)
// Returns a normalized list of GIFs: { id, title, preview_url, gif_url, width?, height?, source }

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || ""
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 24), 48)
    const source = (req.nextUrl.searchParams.get("source") || "all").toLowerCase()

    if (!q) {
      return NextResponse.json({ success: true, results: [] })
    }

    const TENOR_KEY = process.env.TENOR_API_KEY || null
    const GIPHY_KEY = process.env.GIPHY_API_KEY || null

    const results: any[] = []

    // Helper to dedupe by gif_url
    const seen = new Set<string>()
    function pushIfNew(item: any) {
      if (!item.gif_url) return
      if (seen.has(item.gif_url)) return
      seen.add(item.gif_url)
      results.push(item)
    }

    // Query Tenor if allowed
    if ((source === "all" || source === "tenor") && TENOR_KEY) {
      try {
        const tRes = await fetch(
          `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${encodeURIComponent(TENOR_KEY)}&limit=${Math.min(limit, 24)}`,
        )
        if (tRes.ok) {
          const data = await tRes.json()
          const items = data.results || []
          for (const it of items) {
            const gif = {
              id: it.id || it.content_description || `${Date.now()}-t-${Math.random()}`,
              title: it.content_description || it.title || q,
              preview_url: it.media_formats?.tinygif?.url || it.media_formats?.nanogif?.url || it.media_formats?.gif?.url || null,
              gif_url: it.media_formats?.gif?.url || it.url || null,
              width: it.media_formats?.gif?.dims?.[0] || null,
              height: it.media_formats?.gif?.dims?.[1] || null,
              source: "tenor",
            }
            pushIfNew(gif)
          }
        }
      } catch (err) {
        console.error("Tenor search error:", err)
      }
    }

    // Query Giphy if allowed
    if ((source === "all" || source === "giphy") && GIPHY_KEY) {
      try {
        const gRes = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(q)}&limit=${Math.min(limit, 24)}&rating=pg-13&lang=en`,
        )
        if (gRes.ok) {
          const data = await gRes.json()
          const items = data.data || []
          for (const it of items) {
            const gif = {
              id: it.id,
              title: it.title || q,
              preview_url: it.images?.preview_gif?.url || it.images?.downsized_small?.mp4 || it.images?.downsized?.url || it.images?.original?.url,
              gif_url: it.images?.original?.url || it.url || null,
              width: it.images?.original?.width || null,
              height: it.images?.original?.height || null,
              source: "giphy",
            }
            pushIfNew(gif)
          }
        }
      } catch (err) {
        console.error("Giphy search error:", err)
      }
    }

    // If no keys were provided or results are empty, fallback to a small set of sample GIFs
    if (!results.length) {
      const sample = [
        { title: "Mind Blown", url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif" },
        { title: "Celebration", url: "https://media.giphy.com/media/l0AM41lC46985qEww/giphy.gif" },
        { title: "Applause", url: "https://media.giphy.com/media/3o7qDEq2bMbcbPRQ2c/giphy.gif" },
        { title: "Cat Vibe", url: "https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif" },
      ]
      for (const s of sample) {
        pushIfNew({ id: s.url, title: s.title, preview_url: s.url, gif_url: s.url, source: "sample" })
      }
    }

    // Trim to requested limit
    const trimmed = results.slice(0, limit)

    return NextResponse.json({ success: true, results: trimmed })
  } catch (err: any) {
    console.error("/api/gifs error:", err)
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 })
  }
}
