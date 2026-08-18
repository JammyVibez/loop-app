"use client"

import { useEffect, useMemo, useState } from "react"
import { ExternalLink, Globe } from "lucide-react"
import { cn } from "@/lib/utils"

interface UrlMetadata {
  url: string
  domain: string
  title: string
  description?: string
  image?: string | null
  icon?: string
  /** Cache bookkeeping — set client-side only, never sent to the API. */
  __fetchedAt?: number
}

// Session-scoped cache: the same link is often shared more than once (a chat
// paste, the feed, a bio), and each share used to hit /api/url-preview (which
// re-fetches the remote page server-side) — slow and wasteful. Caching here
// makes repeat links render instantly and dedupes concurrent fetches.
const previewCache = new Map<string, UrlMetadata>()
const pendingFetches = new Map<string, Promise<UrlMetadata | null>>()
const CACHE_TTL_MS = 10 * 60 * 1000

function fetchPreview(url: string): Promise<UrlMetadata | null> {
  const existing = pendingFetches.get(url)
  if (existing) return existing
  const promise = fetch(`/api/url-preview?url=${encodeURIComponent(url)}`)
    .then((res) => res.json())
    .then((resData): UrlMetadata | null =>
      resData.success && resData.metadata ? resData.metadata : null,
    )
    .catch(() => null)
    .finally(() => {
      pendingFetches.delete(url)
    })
  pendingFetches.set(url, promise)
  return promise
}

export function UrlPreviewCard({ url }: { url: string }) {
  const isCacheFresh = (cached: UrlMetadata | undefined): cached is UrlMetadata =>
    Boolean(cached && typeof cached.__fetchedAt === "number" && Date.now() - cached.__fetchedAt < CACHE_TTL_MS)

  const [data, setData] = useState<UrlMetadata | null>(() => {
    const cached = previewCache.get(url)
    return isCacheFresh(cached) ? cached : null
  })
  const [loading, setLoading] = useState(() => !isCacheFresh(previewCache.get(url)))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    const cached = previewCache.get(url)
    if (isCacheFresh(cached)) {
      setData(cached)
      setLoading(false)
      return
    }
    setLoading(true)

    void fetchPreview(url).then((meta) => {
      if (!active) return
      if (meta) {
        meta.__fetchedAt = Date.now()
        previewCache.set(url, meta)
        setData(meta)
      } else {
        setFailed(true)
      }
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [url])

  const domain = useMemo(() => {
    try {
      let clean = url
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = `https://${clean}`
      }
      return new URL(clean).hostname.replace(/^www\./, "")
    } catch {
      return url
    }
  }, [url])

  if (loading) {
    return (
      <div className="my-2 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs text-muted-foreground animate-pulse">
        <Globe className="h-4 w-4 text-sky-500 shrink-0" />
        <span className="truncate">Expanding link ({domain})...</span>
      </div>
    )
  }

  const linkTitle = data?.title || domain
  const linkDesc = data?.description || `Open ${domain}`
  const image = data?.image
  const icon = data?.icon

  // Route remote images through the image-proxy so browsers don't fetch unknown hosts directly.
  const proxied = (src?: string | null): string | undefined =>
    src && src.startsWith("http") ? `/api/image-proxy?url=${encodeURIComponent(src)}` : src || undefined

  return (
    <a
      href={url.startsWith("http") ? url : `https://${url}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="group my-2 flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card to-muted/30 hover:border-sky-500/50 hover:bg-muted/50 transition-all shadow-sm duration-200"
    >
      {image && (
        <div className="relative h-32 sm:h-auto sm:w-36 shrink-0 overflow-hidden bg-muted">
          <img
            src={proxied(image)}
            alt={linkTitle}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = "none"
            }}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-500 mb-1">
            {icon ? (
              <img src={proxied(icon)} alt="" className="h-3.5 w-3.5 rounded shrink-0" />
            ) : (
              <Globe className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{domain}</span>
            <ExternalLink className="h-3 w-3 shrink-0 ml-auto opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </div>

          <h4 className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-sky-500 transition-colors">
            {linkTitle}
          </h4>
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {linkDesc}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground/80 pt-1 border-t border-border/30">
          <span className="truncate">{url}</span>
          <span className="font-semibold text-sky-600 dark:text-sky-400 shrink-0 ml-2">Click to open ↗</span>
        </div>
      </div>
    </a>
  )
}
