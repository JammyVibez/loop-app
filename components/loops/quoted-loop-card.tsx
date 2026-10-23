"use client"

import { useEffect, useReducer, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { ArrowUpRight, GitBranch, Heart, MessageCircle, Quote } from "lucide-react"
import { cn } from "@/lib/utils"

export interface QuotedLoop {
  id: string
  /** The viewer cannot see this post (community-only or removed). */
  restricted?: boolean
  text?: string
  title?: string | null
  media_url?: string | null
  media_urls?: string[]
  media_type?: string
  hashtags?: string[]
  created_at?: string
  stats?: {
    likes: number
    comments: number
    branches: number
    views: number
    quotes: number
  }
  author?: {
    username: string
    display_name: string
    avatar_url: string | null
    is_verified: boolean
    is_premium?: boolean
    is_team_member?: boolean
    is_deleted?: boolean
  }
}

/**
 * Module-level cache shared by every consumer of a quoted post — the embedded
 * card in the feed, the post detail page, and the share-as-image composer. A
 * quote post only carries an id, so one batched request covers a whole page
 * and repeated renders never re-fetch the same original twice.
 */
const cache = new Map<string, QuotedLoop | null>()
const inflight = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

async function loadQuotes(ids: string[]) {
  const missing = ids.filter((id) => id && !cache.has(id) && !inflight.has(id))
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

/**
 * The original post a quote rebranch embeds.
 *
 * Returns `undefined` while loading, `null` when the post is gone or not
 * visible to the viewer, and the post itself once resolved.
 */
export function useQuotedLoop(loopId: string | null | undefined) {
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!loopId) return
    listeners.add(rerender)
    const pending = inflight.get(loopId)
    if (!cache.has(loopId) && !pending) void loadQuotes([loopId]).then(notify)
    else if (pending) void pending.then(notify)
    return () => {
      listeners.delete(rerender)
    }
  }, [loopId])

  if (!loopId) return undefined
  return cache.has(loopId) ? (cache.get(loopId) as QuotedLoop | null) : undefined
}

/**
 * Shape a resolved quote for `CreateBranchDialog`, which expects the post it
 * operates on. A quote is always top-level, so its tree depth is 0.
 */
export function quotedLoopAsParent(quote: QuotedLoop | null | undefined) {
  if (!quote) return null
  return {
    id: quote.id,
    content: quote.text || "",
    content_text: quote.text || "",
    content_title: quote.title || "",
    media_url: quote.media_url || undefined,
    media_urls:
      quote.media_urls && quote.media_urls.length > 0
        ? quote.media_urls
        : quote.media_url
          ? [quote.media_url]
          : [],
    media_type: quote.media_type || "text",
    tree_depth: 0,
    author: quote.author,
  }
}

const formatCount = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return `${n}`
}

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)

/** The original post, embedded by reference inside the quoting post. */
export function QuotedLoopCard({
  loopId,
  onQuote,
  className,
}: {
  loopId: string
  /** When provided, the card offers a one-tap quote of the original. */
  onQuote?: (quote: QuotedLoop) => void
  className?: string
}) {
  const quote = useQuotedLoop(loopId)
  const [expanded, setExpanded] = useState(false)

  if (quote === undefined) {
    return (
      <div className={cn("mt-2.5 space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-3.5", className)}>
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (quote === null || quote.restricted || !quote.author) {
    return (
      <div
        className={cn(
          "mt-2.5 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-3.5 py-3 text-xs text-muted-foreground",
          className,
        )}
      >
        {quote?.restricted
          ? "The quoted post is only visible to its members."
          : "The quoted post is no longer available."}
      </div>
    )
  }

  const author = quote.author
  const handle = author.is_deleted ? "deleted" : author.username
  const postHref = `/loop/${quote.id}`
  const mediaUrls = (
    quote.media_urls && quote.media_urls.length > 0
      ? quote.media_urls
      : quote.media_url
        ? [quote.media_url]
        : []
  ).filter(Boolean)
  const stats = quote.stats
  const statsTotal = stats ? stats.likes + stats.comments + stats.branches : 0

  const text = (quote.text || "").trim()
  const isLong = text.length > 220 || text.split("\n").length > 4

  return (
    <article
      className={cn(
        "group mt-2.5 overflow-hidden rounded-2xl border border-border/70 bg-muted/20 transition-colors hover:border-border/90 hover:bg-muted/30",
        className,
      )}
    >
      {/* Author row — links to the original author, timestamp kept on the right */}
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <Link
          href={`/profile/${handle}`}
          className="flex min-w-0 items-center gap-2 rounded-full transition-opacity hover:opacity-80"
          aria-label={`Open @${handle}'s profile`}
        >
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarImage src={author.avatar_url || undefined} alt="" />
            <AvatarFallback className="text-[10px]">
              {(author.display_name || handle).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-xs font-semibold text-foreground">{author.display_name}</span>
          {author.is_verified && <VerifiedSeal size={14} title="Verified" />}
          <span className="truncate text-[11px] text-muted-foreground">@{handle}</span>
        </Link>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          {quote.created_at && <FreshnessTimestamp date={quote.created_at} />}
          <Quote className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
        </span>
      </div>

      {/* Body — title, text and the author's tags */}
      <div className="px-3.5 pb-2.5 pt-1.5">
        {quote.title && (
          <Link href={postHref} className="mb-0.5 block">
            <p className="line-clamp-2 text-xs font-semibold text-foreground/90 hover:underline">
              {quote.title}
            </p>
          </Link>
        )}
        {text ? (
          <Link href={postHref} className="block" aria-label={`Open the quoted post by @${handle}`}>
            <p
              className={cn(
                "whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80",
                !expanded && "line-clamp-4",
              )}
            >
              {text}
            </p>
          </Link>
        ) : mediaUrls.length === 0 ? (
          <p className="text-[13px] italic text-muted-foreground">(media post)</p>
        ) : null}

        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-1 text-[11px] font-semibold text-cyan-500 transition-colors hover:text-cyan-400"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}

        {quote.hashtags && quote.hashtags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {quote.hashtags.map((tag) => (
              <Link
                key={tag}
                href={`/hashtag/${encodeURIComponent(tag.replace(/^#/, "").toLowerCase())}`}
                className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                #{tag.replace(/^#/, "")}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Media — every attachment the quoted post carries, with an overflow count */}
      {mediaUrls.length > 0 && (
        <div className="border-t border-border/60 bg-black/20">
          {mediaUrls.length === 1 ? (
            <Link href={postHref} className="block" aria-label={`Open the quoted post by @${handle}`}>
              {isVideoUrl(mediaUrls[0]) ? (
                <video
                  src={mediaUrls[0]}
                  className="max-h-56 w-full object-contain"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrls[0]}
                  alt=""
                  className="max-h-56 w-full object-contain"
                  loading="lazy"
                />
              )}
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-0.5">
              {mediaUrls.slice(0, 4).map((url, index) => {
                const overflow = index === 3 && mediaUrls.length > 4 ? mediaUrls.length - 3 : 0
                return (
                  <Link
                    key={`${url}-${index}`}
                    href={postHref}
                    className="relative block aspect-video overflow-hidden bg-black/40"
                    aria-label={`Open the quoted post by @${handle}`}
                  >
                    {isVideoUrl(url) ? (
                      <video
                        src={url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    )}
                    {overflow > 0 && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-bold text-white">
                        +{overflow}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer — the post's real engagement, plus the actions that keep the
          conversation going without leaving the feed. */}
      <div className="flex items-center gap-3 border-t border-border/60 px-3.5 py-2 text-[11px] text-muted-foreground">
        {stats && statsTotal > 0 && (
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex items-center gap-1" title={`${stats.likes} likes`}>
              <Heart className="h-3.5 w-3.5" aria-hidden />
              {formatCount(stats.likes)}
            </span>
            <span className="inline-flex items-center gap-1" title={`${stats.comments} replies`}>
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              {formatCount(stats.comments)}
            </span>
            <span className="inline-flex items-center gap-1" title={`${stats.branches} branches`}>
              <GitBranch className="h-3.5 w-3.5" aria-hidden />
              {formatCount(stats.branches)}
            </span>
            {stats.quotes > 0 && (
              <span className="inline-flex items-center gap-1" title={`${stats.quotes} quotes`}>
                <Quote className="h-3.5 w-3.5" aria-hidden />
                {formatCount(stats.quotes)}
              </span>
            )}
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {onQuote && (
            <button
              type="button"
              onClick={() => onQuote(quote)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-foreground/70 transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
            >
              <Quote className="h-3.5 w-3.5" aria-hidden />
              Quote
            </button>
          )}
          <Link
            href={postHref}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-foreground/70 transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
          >
            Open
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  )
}
