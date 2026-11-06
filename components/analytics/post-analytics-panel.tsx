"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Bookmark,
  Eye,
  GitBranch,
  Heart,
  MessageCircle,
  Rocket,
  Share2,
  TrendingUp,
  Users,
} from "lucide-react"
import { StatTile, Surface } from "@/components/ui/page-header"
import { Spinner } from "@/components/ui/skeletons"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

type RangeKey = "24h" | "7d" | "30d"

interface Bucket {
  bucket: string
  label: string
  views: number
  likes: number
  comments: number
}

interface Referrer {
  surface: string
  label: string
  views: number
  share: number
}

export interface PostAnalyticsData {
  loop_id: string
  created_at: string | null
  range: RangeKey
  range_label: string
  range_days: number
  granularity: "hour" | "day"
  totals: {
    views: number
    impressions: number
    unique_viewers: number
    likes: number
    comments: number
    branches: number
    boosts: number
    shares: number
    saves: number
    quotes: number
  }
  engagements: number
  engagement_rate: number
  series: Bucket[]
  busiest_bucket: Bucket | null
  average_daily_views: number
  audience: {
    followers: number
    non_followers: number
    follower_impressions: number
    non_follower_impressions: number
    follower_share: number | null
  }
  referrers: Referrer[]
  has_event_data: boolean
}

const RANGE_OPTIONS: { key: RangeKey; label: string; title: string }[] = [
  { key: "24h", label: "24h", title: "Last 24 hours" },
  { key: "7d", label: "7d", title: "Last 7 days" },
  { key: "30d", label: "30d", title: "Last 30 days" },
]

export const compactNumber = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1000
      ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}K`
      : String(value)

/**
 * Author analytics for one post.
 *
 * One component for both the inline section on the post page and the sheet
 * opened from a feed card, so the two can never disagree. Dense on purpose:
 * a reach row, a timeline, where readers came from, and how much of that
 * audience already follows the author.
 */
export function PostAnalyticsPanel({
  loopId,
  defaultRange = "7d",
  className,
}: {
  loopId: string
  defaultRange?: RangeKey
  className?: string
}) {
  const { getAuthHeader } = useAuth()
  const [range, setRange] = useState<RangeKey>(defaultRange)
  const [data, setData] = useState<PostAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (nextRange: RangeKey) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/loops/${loopId}/analytics?range=${nextRange}`, {
          headers: { ...getAuthHeader() },
          cache: "no-store",
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.error || "Could not load analytics")
        setData(payload.analytics as PostAnalyticsData)
      } catch (err: any) {
        setError(err?.message || "Could not load analytics")
      } finally {
        setLoading(false)
      }
    },
    [loopId, getAuthHeader],
  )

  useEffect(() => {
    void load(range)
  }, [load, range])

  const peak = useMemo(
    () => (data ? Math.max(1, ...data.series.map((bucket) => bucket.views)) : 1),
    [data],
  )

  const labelFor = (bucket: Bucket) =>
    data?.granularity === "hour" ? bucket.label : bucket.label.slice(5).replace("-", "/")

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Analytics</h3>
          <span className="text-xs text-muted-foreground">
            {data ? `Last ${data.range_label.toLowerCase()}` : "Loading"}
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Analytics range"
          className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-muted/40 p-0.5"
        >
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={range === option.key}
              title={option.title}
              onClick={() => setRange(option.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors duration-150",
                range === option.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex min-h-[180px] items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error ? (
        <Surface tone="muted" className="text-center">
          <p className="text-sm font-medium text-foreground">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Only the author can open a post&apos;s analytics.
          </p>
          <button
            type="button"
            onClick={() => void load(range)}
            className="mt-3 text-xs font-semibold text-primary hover:underline"
          >
            Try again
          </button>
        </Surface>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile
              label="Impressions"
              value={compactNumber(data.totals.impressions)}
              hint={
                data.has_event_data
                  ? `${compactNumber(data.totals.unique_viewers || data.totals.views)} unique viewers`
                  : "Collection started today"
              }
              icon={Eye}
            />
            <StatTile
              label="Engagement"
              value={`${data.engagement_rate}%`}
              hint={`${compactNumber(data.engagements)} interactions`}
              icon={TrendingUp}
            />
            <StatTile label="Likes" value={compactNumber(data.totals.likes)} icon={Heart} />
            <StatTile label="Comments" value={compactNumber(data.totals.comments)} icon={MessageCircle} />
          </div>

          <Surface>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="loop-label">Views</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                  {compactNumber(data.average_daily_views)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">avg / day</span>
                </p>
              </div>
              {data.busiest_bucket ? (
                <p className="text-xs text-muted-foreground">
                  Peak
                  <span className="ml-1 font-semibold tabular-nums text-foreground">
                    {labelFor(data.busiest_bucket)}
                  </span>
                  <span className="ml-1 tabular-nums">· {compactNumber(data.busiest_bucket.views)} views</span>
                </p>
              ) : null}
            </div>

            <div
              className="mt-4 flex h-28 items-end gap-[3px]"
              role="img"
              aria-label={`Views over the last ${data.range_label}`}
            >
              {data.series.map((bucket) => {
                const height = Math.max(2, Math.round((bucket.views / peak) * 100))
                return (
                  <div
                    key={bucket.bucket}
                    className="group relative flex h-full flex-1 flex-col justify-end"
                    title={`${labelFor(bucket)} · ${bucket.views} views · ${bucket.likes} likes · ${bucket.comments} comments`}
                  >
                    <div
                      className={cn(
                        "w-full rounded-sm transition-colors duration-150",
                        bucket.views > 0 ? "bg-foreground/80 group-hover:bg-foreground" : "bg-muted",
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] tabular-nums text-muted-foreground">
              <span>{data.series[0] ? labelFor(data.series[0]) : ""}</span>
              <span>{data.series[data.series.length - 1] ? labelFor(data.series[data.series.length - 1]) : ""}</span>
            </div>

            {!data.has_event_data ? (
              <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                View tracking for this post starts now — the timeline fills in as readers open it. All-time
                counts are below.
              </p>
            ) : null}
          </Surface>

          <div className="grid gap-3 sm:grid-cols-2">
            <Surface>
              <p className="loop-label">Where readers found it</p>
              {data.referrers.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  No impressions in this window yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {data.referrers.map((referrer) => (
                    <li key={referrer.surface}>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate text-foreground">{referrer.label}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {compactNumber(referrer.views)}
                          <span className="ml-1.5 text-[10px]">{referrer.share}%</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/60"
                          style={{ width: `${Math.min(100, Math.max(2, referrer.share))}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>

            <Surface className="flex flex-col gap-3">
              <div>
                <p className="loop-label">Audience</p>
                <p className="mt-2 flex items-baseline gap-1.5 text-2xl font-semibold tabular-nums text-foreground">
                  {data.audience.follower_share === null ? "—" : `${data.audience.follower_share}%`}
                  <span className="text-[11px] font-normal text-muted-foreground">followers</span>
                </p>
              </div>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-foreground/80"
                  style={{ width: `${data.audience.follower_share ?? 0}%` }}
                />
                <div className="h-full flex-1 bg-foreground/25" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border/60 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Followers</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                    {compactNumber(data.audience.followers)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">New readers</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                    {compactNumber(data.audience.non_followers)}
                  </p>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {data.audience.follower_share === null
                  ? "Follower split appears once people open this post."
                  : data.audience.follower_share >= 50
                    ? "Mostly your existing audience — a branch or duel could reach further."
                    : "Mostly new readers — this post is travelling beyond your followers."}
              </p>
            </Surface>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span className="tabular-nums text-foreground">
                {compactNumber(data.totals.unique_viewers || data.totals.views)}
              </span>
              all-time viewers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="tabular-nums text-foreground">{compactNumber(data.totals.branches)}</span>
              Trees
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Rocket className="h-3.5 w-3.5" />
              <span className="tabular-nums text-foreground">{compactNumber(data.totals.boosts)}</span>
              boosts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              <span className="tabular-nums text-foreground">{compactNumber(data.totals.shares)}</span>
              shares
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bookmark className="h-3.5 w-3.5" />
              <span className="tabular-nums text-foreground">{compactNumber(data.totals.saves)}</span>
              bookmarks
            </span>
          </div>
        </>
      ) : null}
    </div>
  )
}
