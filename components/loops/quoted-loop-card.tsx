"use client"

import { useEffect, useReducer, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import {
  ArrowUpRight,
  GitBranch,
  Heart,
  MessageCircle,
  Quote,
  Swords,
  Users,
  Vote,
} from "lucide-react"
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
  /** The original asked a question; the quote shows the standing, not a vote. */
  poll?: {
    question?: string
    options?: Array<{ id?: string; text?: unknown; votes?: number } | string>
    total_votes?: number
    expires_at?: string | null
  } | null
  /** The original is a duel; the quote shows the two sides and their weight. */
  duel?: {
    prompt?: string
    side_a_label?: string | null
    side_b_label?: string | null
    status?: string | null
    entries?: Array<{ id?: string; side?: string; votes_count?: number | null }>
  } | null
  /** A Co-Loop carries the people who made it. */
  co_authors?: Array<{
    username?: string
    display_name?: string
    avatar_url?: string | null
    role?: string
  }>
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

/** Poll options arrive as strings or as { text } objects depending on writer. */
function pollOptionText(option: { text?: unknown } | string) {
  const raw = typeof option === "string" ? option : option?.text
  if (raw && typeof raw === "object") {
    const nested = raw as Record<string, unknown>
    return String(nested.text ?? nested.value ?? nested.label ?? "")
  }
  return String(raw ?? "")
}

function pollOptions(poll: QuotedLoop["poll"]) {
  return (poll?.options || [])
    .map((option) => ({
      text: pollOptionText(option).trim(),
      votes: typeof option === "string" ? 0 : Number(option.votes || 0),
    }))
    .filter((option) => option.text)
    .slice(0, 4)
}

function duelTotals(duel: QuotedLoop["duel"]) {
  let a = 0
  let b = 0
  for (const entry of duel?.entries || []) {
    const votes = Number(entry.votes_count || 0)
    if (entry.side === "A") a += votes
    else if (entry.side === "B") b += votes
  }
  return { a, b, total: a + b }
}

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
  const poll = quote.poll || null
  const options = pollOptions(poll)
  const pollTotal = Number(poll?.total_votes || 0) || options.reduce((sum, o) => sum + o.votes, 0)
  const duel = quote.duel || null
  const duelTotalsValue = duelTotals(duel)
  const coAuthors = (quote.co_authors || []).filter((ca) => ca?.username)

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

      {/* Co-Loop credit — the quote names the people who built the original */}
      {coAuthors.length > 0 && (
        <div className="mx-3.5 mb-1 mt-2 flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.07] px-2.5 py-1.5">
          <Users className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
          <div className="flex -space-x-1.5">
            {coAuthors.slice(0, 3).map((ca, index) => (
              <Avatar key={`${ca.username}-${index}`} className="h-4 w-4 ring-1 ring-background">
                <AvatarImage src={ca.avatar_url || undefined} alt="" />
                <AvatarFallback className="text-[7px]">
                  {(ca.display_name || ca.username || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="truncate text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
            Co-Loop with {coAuthors.map((ca) => ca.display_name || ca.username).slice(0, 2).join(", ")}
            {coAuthors.length > 2 ? ` +${coAuthors.length - 2}` : ""}
          </span>
        </div>
      )}

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

      {/* Poll — the standing as of right now, with the vote itself on the original */}
      {options.length > 0 && (
        <Link
          href={postHref}
          className="mx-3.5 mb-2.5 block rounded-xl border border-border/60 bg-background/60 p-3 transition-colors hover:border-border"
          aria-label={`Vote in the quoted poll by @${handle}`}
        >
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Vote className="h-3 w-3" aria-hidden /> Poll
          </p>
          <p className="mt-0.5 text-[13px] font-semibold leading-snug text-foreground">
            {poll?.question || "Which one?"}
          </p>
          <div className="mt-2 space-y-1.5">
            {options.map((option, index) => {
              const pct = pollTotal ? Math.round((option.votes / pollTotal) * 100) : 0
              return (
                <div
                  key={`${option.text}-${index}`}
                  className="relative overflow-hidden rounded-lg border border-border/60 px-2 py-1"
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-foreground/[0.07]"
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                  <span className="relative flex items-center justify-between gap-2 text-[11px] font-medium">
                    <span className="truncate">{option.text}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{pct}%</span>
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {pollTotal.toLocaleString()} vote{pollTotal === 1 ? "" : "s"} · Tap to vote
          </p>
        </Link>
      )}

      {/* Duel — two sides, their weight, and a way into the vote */}
      {duel && (
        <Link
          href={postHref}
          className="mx-3.5 mb-2.5 block rounded-xl border border-border/60 bg-background/60 p-3 transition-colors hover:border-border"
          aria-label={`Open the quoted duel by @${handle}`}
        >
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Swords className="h-3 w-3" aria-hidden /> Duel
          </p>
          <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
            {duel.prompt || "Pick a side"}
          </p>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
            <span
              className="h-full bg-cyan-500"
              style={{
                width: `${duelTotalsValue.total ? (duelTotalsValue.a / duelTotalsValue.total) * 100 : 50}%`,
              }}
              aria-hidden
            />
            <span
              className="h-full bg-rose-500"
              style={{
                width: `${duelTotalsValue.total ? (duelTotalsValue.b / duelTotalsValue.total) * 100 : 50}%`,
              }}
              aria-hidden
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-muted-foreground">
            <span className="truncate">{duel.side_a_label || "Side A"}</span>
            <span className="truncate text-right">{duel.side_b_label || "Side B"}</span>
          </div>
        </Link>
      )}

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
