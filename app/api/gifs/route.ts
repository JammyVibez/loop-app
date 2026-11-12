import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getIntegrationCredential } from "@/lib/server-settings"

// Merged GIF/sticker search endpoint — queries Tenor, Giphy and Klipy (when
// API keys are available) plus the admin-curated library stored in Supabase.
// Curated GIFs are read from the DB on every request, so admins' additions
// appear in the app's pickers in real time.
// Returns a normalized list: { id, title, preview_url, gif_url, width?, height?, source, kind }

function klipyMedia(item: any, kind: "gif" | "sticker") {
  const file = item?.file || {}
  const full = file.md || file.hd || file.sm || file.xs || {}
  const small = file.sm || file.xs || full
  const gifUrl = full.gif?.url || full.webp?.url || null
  const preview =
    small.webp?.url ||
    small.png?.url ||
    small.gif?.url ||
    full.webp?.url ||
    full.gif?.url ||
    null
  if (!gifUrl) return null
  return {
    id: `${kind}-${item.slug || item.id}`,
    title: item.title || (kind === "sticker" ? "Sticker" : "GIF"),
    preview_url: preview || gifUrl,
    gif_url: gifUrl,
    width: full.gif?.width || null,
    height: full.gif?.height || null,
    source: "klipy",
    kind,
  }
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || ""
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 24), 48)
    const source = (req.nextUrl.searchParams.get("source") || "all").toLowerCase()
    const kind: "gif" | "sticker" = req.nextUrl.searchParams.get("type") === "sticker" ? "sticker" : "gif"

    const results: any[] = []

    // Helper to dedupe by gif_url
    const seen = new Set<string>()
    function pushIfNew(item: any) {
      if (!item.gif_url) return
      if (seen.has(item.gif_url)) return
      seen.add(item.gif_url)
      results.push(item)
    }

    // Admin-curated GIFs first (always fresh from the DB). Stickers come from
    // the provider catalog, never the curated GIF library.
    if (kind === "gif" && source === "all") {
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
              kind: "gif",
            })
          }
        }
      } catch (err) {
        console.error("Curated GIF fetch error:", err)
      }
    }

    // Environment first, then admin_settings — lets keys be rotated from the
    // database without a redeploy.
    const TENOR_KEY = await getIntegrationCredential("TENOR_API_KEY", "tenor_api_key")
    const GIPHY_KEY = await getIntegrationCredential("GIPHY_API_KEY", "giphy_api_key")
    const KLIPY_KEY = await getIntegrationCredential("KLIPY_API_KEY", "klipy_api_key")

    const fetchKlipy = async () => {
      if (!KLIPY_KEY) return
      // Klipy puts the app key in the path and exposes GIF and sticker
      // catalogs behind the same response shape.
      const path = kind === "sticker" ? "stickers" : "gifs"
      const endpoint = q ? "search" : "trending"
      const params = new URLSearchParams({
        page: "1",
        per_page: String(Math.min(limit, 24)),
      })
      if (q) params.set("q", q)
      const res = await fetch(
        `https://api.klipy.com/api/v1/${encodeURIComponent(KLIPY_KEY)}/${path}/${endpoint}?${params.toString()}`,
        { cache: "no-store" },
      )
      if (!res.ok) {
        console.error("Klipy error:", res.status, await res.text().catch(() => ""))
        return
      }
      const data = await res.json().catch(() => null)
      for (const item of data?.data?.data || []) {
        pushIfNew(klipyMedia(item, kind))
      }
    }

    // No query means the picker's Trending section, so ask the providers for
    // their featured/trending feed instead of only returning curated GIFs.
    if (!q) {
      if (kind === "gif" && (source === "all" || source === "tenor") && TENOR_KEY) {
        try {
          const tRes = await fetch(
            `https://tenor.googleapis.com/v2/featured?key=${encodeURIComponent(TENOR_KEY)}&limit=${Math.min(limit, 24)}&media_filter=tinygif,gif`,
          )
          if (tRes.ok) {
            const data = await tRes.json()
            for (const it of data.results || []) {
              pushIfNew({
                id: it.id,
                title: it.content_description || it.title || "Trending GIF",
                preview_url: it.media_formats?.tinygif?.url || it.media_formats?.gif?.url || null,
                gif_url: it.media_formats?.gif?.url || null,
                width: it.media_formats?.gif?.dims?.[0] || null,
                height: it.media_formats?.gif?.dims?.[1] || null,
                source: "tenor",
                kind: "gif",
              })
            }
          }
        } catch (err) {
          console.error("Tenor trending error:", err)
        }
      }

      if (kind === "gif" && (source === "all" || source === "giphy") && GIPHY_KEY) {
        try {
          const gRes = await fetch(
            `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(GIPHY_KEY)}&limit=${Math.min(limit, 24)}&rating=pg-13`,
          )
          if (gRes.ok) {
            const data = await gRes.json()
            for (const it of data.data || []) {
              pushIfNew({
                id: it.id,
                title: it.title || "Trending GIF",
                preview_url: it.images?.fixed_width_small?.url || it.images?.preview_gif?.url || it.images?.original?.url,
                gif_url: it.images?.original?.url || it.url || null,
                width: it.images?.original?.width || null,
                height: it.images?.original?.height || null,
                source: "giphy",
                kind: "gif",
              })
            }
          }
        } catch (err) {
          console.error("Giphy trending error:", err)
        }
      }

      if (source === "all" || source === "klipy") {
        await fetchKlipy().catch((err) => console.error("Klipy trending error:", err))
      }

      return NextResponse.json({
        success: true,
        results: results.slice(0, limit),
        attribution: results.some((item) => item.source === "klipy") ? "KLIPY" : null,
      })
    }

    // Query Tenor if allowed
    if (kind === "gif" && (source === "all" || source === "tenor") && TENOR_KEY) {
      try {
        const tRes = await fetch(
          `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${encodeURIComponent(TENOR_KEY)}&limit=${Math.min(limit, 24)}`,
        )
        if (tRes.ok) {
          const data = await tRes.json()
          const items = data.results || []
          for (const it of items) {
            pushIfNew({
              id: it.id || it.content_description || `${Date.now()}-t-${Math.random()}`,
              title: it.content_description || it.title || q,
              preview_url: it.media_formats?.tinygif?.url || it.media_formats?.nanogif?.url || it.media_formats?.gif?.url || null,
              gif_url: it.media_formats?.gif?.url || it.url || null,
              width: it.media_formats?.gif?.dims?.[0] || null,
              height: it.media_formats?.gif?.dims?.[1] || null,
              source: "tenor",
              kind: "gif",
            })
          }
        }
      } catch (err) {
        console.error("Tenor search error:", err)
      }
    }

    // Query Giphy if allowed
    if (kind === "gif" && (source === "all" || source === "giphy") && GIPHY_KEY) {
      try {
        const gRes = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(q)}&limit=${Math.min(limit, 24)}&rating=pg-13&lang=en`,
        )
        if (gRes.ok) {
          const data = await gRes.json()
          const items = data.data || []
          for (const it of items) {
            pushIfNew({
              id: it.id,
              title: it.title || q,
              // Always a GIF/WebP preview — an mp4 URL in an <img> renders
              // nothing.
              preview_url:
                it.images?.fixed_width_small?.url ||
                it.images?.preview_gif?.url ||
                it.images?.downsized?.url ||
                it.images?.original?.url,
              gif_url: it.images?.original?.url || it.url || null,
              width: it.images?.original?.width || null,
              height: it.images?.original?.height || null,
              source: "giphy",
              kind: "gif",
            })
          }
        }
      } catch (err) {
        console.error("Giphy search error:", err)
      }
    }

    if (source === "all" || source === "klipy") {
      await fetchKlipy().catch((err) => console.error("Klipy search error:", err))
    }

    // If no results at all, fall back to the curated library so the GIF picker
    // is never empty (it's already seeded on first deploy).
    if (!results.length && kind === "gif" && source === "all") {
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
            pushIfNew({ id: g.id, title: g.title, preview_url: g.preview_url || g.url, gif_url: g.url, source: "curated", kind: "gif" })
          }
        }
      } catch (err) {
        console.error("Curated fallback error:", err)
      }
    }

    // Trim to requested limit
    const trimmed = results.slice(0, limit)

    return NextResponse.json({
      success: true,
      results: trimmed,
      attribution: trimmed.some((item) => item.source === "klipy") ? "KLIPY" : null,
    })
  } catch (err: any) {
    console.error("/api/gifs error:", err)
    return NextResponse.json({ success: false, error: err?.message || "Internal error" }, { status: 500 })
  }
}
