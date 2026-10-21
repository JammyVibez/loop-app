"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Quote } from "lucide-react"
import { VerifiedSeal } from "@/components/ui/verified-seal"

export interface QuotedLoop {
  id: string
  text: string
  title: string | null
  media_url: string | null
  media_type: string
  created_at: string
  author: {
    username: string
    display_name: string
    avatar_url: string | null
    is_verified: boolean
    is_deleted?: boolean
  }
}

/**
 * Module-level cache shared by every quote card on screen. A quote post only
 * carries an id, so one batched request covers a whole feed page and repeated
 * renders (realtime updates, scroll) never re-fetch.
 */
const cache = new Map<string, QuotedLoop | null>()
const inflight = new Map<string, Promise<void>>()

async function loadQuotes(ids: string[]) {
  const missing = ids.filter((id) => !cache.has(id) && !inflight.has(id))
  if (missing.length === 0) {
    await Promise.all(ids.map((id) => inflight.get(id)).filter(Boolean))
    return
  }
  const promise = fetch(`/api/loops/quotes?ids=${encodeURIComponent(missing.join(","))}`)
    .then((res) => (res.ok ? res.json() : { quotes: [] }))
    .then((data: { quotes?: QuotedLoop[] }) => {
      const found = new Map((data.quotes || []).map((q) => [q.id, q]))
      for (const id of missing) cache.set(id, found.get(id) || null)
    })
    .catch(() => {
      for (const id of missing) cache.set(id, null)
    })
    .finally(() => {
      for (const id of missing) inflight.delete(id)
    })
  for (const id of missing) inflight.set(id, promise)
  await promise
}

export function QuotedLoopCard({ loopId }: { loopId: string }) {
  const [quote, setQuote] = useState<QuotedLoop | null | undefined>(() =>
    cache.has(loopId) ? cache.get(loopId) : undefined,
  )

  useEffect(() => {
    let cancelled = false
    if (cache.has(loopId)) {
      setQuote(cache.get(loopId))
      return
    }
    setQuote(undefined)
    void loadQuotes([loopId]).then(() => {
      if (!cancelled) setQuote(cache.get(loopId) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [loopId])

  if (quote === null) {
    return (
      <Link
        href={`/loop/${loopId}`}
        className="mt-2.5 block rounded-2xl border border-border/70 bg-muted/30 px-3.5 py-3 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50"
      >
        The quoted post is no longer available.
      </Link>
    )
  }

  if (quote === undefined) {
    return (
      <div className="mt-2.5 space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-3.5">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  const handle = quote.author.is_deleted ? "deleted" : quote.author.username
  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(quote.media_url || "")

  return (
    <Link
      href={`/loop/${quote.id}`}
      className="group mt-2.5 block overflow-hidden rounded-2xl border border-border/70 bg-muted/20 transition-colors hover:border-border hover:bg-muted/35"
      aria-label={`Open the post by @${handle} quoted here`}
    >
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarImage src={quote.author.avatar_url || undefined} />
          <AvatarFallback className="text-[10px]">
            {(quote.author.display_name || handle).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="truncate text-xs font-semibold text-foreground">{quote.author.display_name}</span>
        {quote.author.is_verified && <VerifiedSeal size={14} title="Verified" />}
        <span className="truncate text-[11px] text-muted-foreground">@{handle}</span>
        <Quote className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      </div>

      <div className="px-3.5 pb-3 pt-1.5">
        {quote.title && (
          <p className="mb-0.5 line-clamp-1 text-xs font-semibold text-foreground/90">{quote.title}</p>
        )}
        {quote.text ? (
          <p className="line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80">
            {quote.text}
          </p>
        ) : (
          <p className="text-[13px] italic text-muted-foreground">(media post)</p>
        )}
      </div>

      {quote.media_url && (
        <div className="border-t border-border/60 bg-black/20">
          {isVideo ? (
            <video
              src={quote.media_url}
              className="max-h-56 w-full object-contain"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={quote.media_url}
              alt=""
              className="max-h-56 w-full object-contain"
              loading="lazy"
            />
          )}
        </div>
      )}
    </Link>
  )
}
