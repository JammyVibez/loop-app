"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search } from "@/components/icons/lucide-compat"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type GifResult = {
  id: string
  title: string
  preview: string
  url: string
  source?: string
}

const RECENT_KEY = "loop:recent-gifs"
const MAX_RECENT = 12
const cache = new Map<string, GifResult[]>()

function normalize(raw: any, index: number): GifResult | null {
  const url = raw?.gif_url || raw?.url || raw?.preview_url || null
  if (!url) return null
  return {
    id: String(raw.id || `${index}-${url}`),
    title: raw.title || raw.id || "GIF",
    preview: raw.preview_url || raw.preview || url,
    url,
    source: raw.source,
  }
}

function readRecent(): GifResult[] {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]")
    return Array.isArray(parsed) ? parsed.filter((item) => item?.url).slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

interface GifPickerProps {
  onSelect: (result: GifResult) => void
  className?: string
  maxHeightClassName?: string
  /** Search provider filter ("all" | "giphy" | "tenor" | "klipy"). */
  source?: "all" | "giphy" | "tenor" | "klipy"
  /** Klipy serves stickers and GIFs from parallel catalogs. */
  kind?: "gif" | "sticker"
}

/**
 * GIF search with trending + recents, used by every composer.
 *
 * Results come from our server route so provider keys never reach the client.
 * Responses are cached in memory per query and previews are lazy-loaded, which
 * keeps reopening the picker instant.
 */
export function GifPicker({
  onSelect,
  className,
  maxHeightClassName = "max-h-56",
  source = "all",
  kind = "gif",
}: GifPickerProps) {
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [results, setResults] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<GifResult[]>([])
  const [attribution, setAttribution] = useState<string | null>(null)
  const requestId = useRef(0)
  const isSticker = kind === "sticker"

  useEffect(() => {
    setRecent(isSticker ? [] : readRecent())
  }, [isSticker])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const key = `${kind}:${source}:${debounced}`
    const cached = cache.get(key)
    if (cached) {
      setResults(cached)
      setLoading(false)
      return
    }

    const current = ++requestId.current
    setLoading(true)
    const params = new URLSearchParams({ limit: "24" })
    if (debounced) params.set("q", debounced)
    if (source !== "all") params.set("source", source)
    if (isSticker) params.set("type", "sticker")

    fetch(`/api/gifs?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (current !== requestId.current) return
        const list = (Array.isArray(data?.results) ? data.results : [])
          .map(normalize)
          .filter((item: GifResult | null): item is GifResult => Boolean(item))
        cache.set(key, list)
        setResults(list)
        setAttribution(typeof data?.attribution === "string" ? data.attribution : null)
      })
      .catch(() => {
        if (current === requestId.current) setResults([])
      })
      .finally(() => {
        if (current === requestId.current) setLoading(false)
      })
  }, [debounced, source, isSticker, kind])

  const remember = useCallback((gif: GifResult) => {
    const next = [gif, ...readRecent().filter((item) => item.url !== gif.url)].slice(0, MAX_RECENT)
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* storage may be unavailable; recents are a convenience */
    }
    setRecent(next)
  }, [])

  const choose = (gif: GifResult) => {
    remember(gif)
    onSelect(gif)
  }

  const heading = useMemo(() => (debounced ? "Results" : "Trending"), [debounced])
  const showRecent = !isSticker && !debounced && recent.length > 0

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={isSticker ? "Search stickers…" : "Search GIFs…"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 rounded-lg border-border bg-muted pl-8 text-xs"
        />
      </div>

      <div className={cn(maxHeightClassName, "space-y-3 overflow-y-auto pr-1")}>
        {showRecent && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {recent.map((gif) => (
                <button
                  key={`recent-${gif.id}`}
                  type="button"
                  onClick={() => choose(gif)}
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted transition-transform hover:scale-105 hover:border-primary/50"
                  title={gif.title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gif.preview} alt={gif.title} className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{heading}</p>

        {loading && results.length === 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {isSticker
              ? debounced
                ? "No stickers match that search."
                : "No stickers available yet."
              : debounced
                ? "No GIFs match that search."
                : "No GIFs available yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => choose(gif)}
                className="group relative h-20 overflow-hidden rounded-lg border border-border bg-muted transition-all hover:border-primary"
                title={gif.title}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className={cn(
                    "h-full w-full transition-transform group-hover:scale-105",
                    isSticker ? "object-contain p-1" : "object-cover",
                  )}
                  loading="lazy"
                  decoding="async"
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 p-0.5 text-center text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {gif.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {attribution && (
        <p className="text-right text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Powered by {attribution}
        </p>
      )}
    </div>
  )
}
