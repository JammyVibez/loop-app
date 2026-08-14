import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

// Merged GIF search endpoint — queries Tenor and Giphy (when API keys are
// available) plus the admin-curated library stored in Supabase. Curated GIFs
// are read from the DB on every request, so admins' additions appear in the
// app's GIF pickers in real time.
// Returns a normalized list of GIFs: { id, title, preview_url, gif_url, width?, height?, source }

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || ""
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 24), 48)
    const source = (req.nextUrl.searchParams.get("source") || "all").toLowerCase()

    const results: any[] = []

    // Helper to dedupe by gif_url
    const seen = new Set<string>()
    function pushIfNew(item: any) {
      if (!item.gif_url) return
      if (seen.has(item.gif_url)) return
      seen.add(item.gif_url)
      results.push(item)
    }

    // Admin-curated GIFs first (always fresh from the DB)
    try {
      const supabase = createServerClient()
      const { data: curated, error } = await supabase
        .from("curated_gifs")
        .select("id, title, url, preview_url, tags, source")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(40)

      if (!error && Array.isArray(curated)) {
        for (const g of curated) {
          const haystack = `${g.title} ${(g.tags || []).join(" ")}`.toLowerCase()
          if (q && !haystack.includes(q.toLowerCase())) continue
          pushIfNew({
            id: g.id,
            title: g.title,
            preview_url: g.preview_url || g.url,
            gif_url: g.url,
            width: null,
            height: null,
            source: "curated",
          })
        }
      }
    } catch (err) {
      console.error("Curated GIF fetch error:", err)
    }

    if (!q) {
      return NextResponse.json({ success: true, results: results.slice(0, limit) })
    }

    const TENOR_KEY = process.env.TENOR_API_KEY || null
    const GIPHY_KEY = process.env.GIPHY_API_KEY || null

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

    // If no results at all, fall back to the curated library so the picker is
    // never empty (it's already seeded on first deploy).
    if (!results.length) {
      try {
        const supabase = createServerClient()
        const { data: curated, error } = await supabase
          .from("curated_gifs")
          .select("id, title, url, preview_url")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(12)
        if (!error && Array.isArray(curated)) {
          for (const g of curated) {
            pushIfNew({ id: g.id, title: g.title, preview_url: g.preview_url || g.url, gif_url: g.url, source: "curated" })
          }
        }
      } catch (err) {
        console.error("Curated fallback error:", err)
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
