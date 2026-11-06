"use client"

import { useCallback, useEffect, useState } from "react"
import { BarChart3, Eye, Heart, MessageCircle, Share2, Bookmark } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatTile } from "@/components/ui/page-header"
import { Spinner } from "@/components/ui/skeletons"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

interface DayPoint {
  date: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
}

interface PostAnalytics {
  period_days: number
  totals: {
    views: number
    likes: number
    comments: number
    shares: number
    saves: number
    branches: number
  }
  engagement_rate: number
  daily: DayPoint[]
  busiest_day: DayPoint | null
  average_daily_views: number
}

const compact = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1000
      ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}K`
      : String(value)

const formatDay = (date: string, withMonth = false) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: withMonth ? "short" : undefined,
    day: "numeric",
    timeZone: "UTC",
  })

/**
 * Author-facing analytics for a single post.
 *
 * Deliberately quiet: four numbers, a rate, and a 14-day activity chart. The
 * same totals feed the numbers shown on the post card, so opening the sheet
 * never contradicts the feed.
 */
export function PostAnalyticsDialog({
  loopId,
  open,
  onOpenChange,
}: {
  loopId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { getAuthHeader } = useAuth()
  const [data, setData] = useState<PostAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/loops/${loopId}/analytics`, {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Could not load analytics")
      setData(payload.analytics as PostAnalytics)
    } catch (err: any) {
      setError(err?.message || "Could not load analytics")
    } finally {
      setLoading(false)
    }
  }, [loopId, getAuthHeader])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const peak = data ? Math.max(1, ...data.daily.map((day) => day.views)) : 1
  const hasRecentActivity = Boolean(
    data?.daily.some((day) => day.views + day.likes + day.comments + day.shares + day.saves > 0),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-5 rounded-2xl p-5 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Post analytics
          </DialogTitle>
          <DialogDescription className="text-xs">
            {data ? `Last ${data.period_days} days · ${compact(data.totals.views)} views all time` : "Performance for this post"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border/70 bg-muted/30 p-6 text-center">
            <p className="text-sm font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : data ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatTile label="Views" value={compact(data.totals.views)} icon={Eye} />
              <StatTile label="Likes" value={compact(data.totals.likes)} icon={Heart} />
              <StatTile label="Comments" value={compact(data.totals.comments)} icon={MessageCircle} />
              <StatTile label="Shares" value={compact(data.totals.shares)} icon={Share2} />
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Daily views
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {compact(data.average_daily_views)} avg / day
                  </p>
                </div>
                {data.busiest_day ? (
                  <p className="text-right text-xs text-muted-foreground">
                    Best day
                    <span className="ml-1 font-semibold text-foreground">
                      {formatDay(data.busiest_day.date, true)}
                    </span>
                  </p>
                ) : null}
              </div>

              {!hasRecentActivity ? (
                <p className="mt-4 rounded-lg bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
                  No activity in this period. All-time totals are shown above.
                </p>
              ) : (
              <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label="Views per day">
                {data.daily.map((day, index) => {
                  const height = Math.max(3, Math.round((day.views / peak) * 100))
                  const engagement = day.likes + day.comments + day.shares + day.saves
                  return (
                    <div
                      key={day.date}
                      className="group relative flex h-full flex-1 flex-col justify-end"
                      title={`${formatDay(day.date, true)} · ${day.views} views · ${engagement} interactions`}
                    >
                      <div
                        className={cn(
                          "w-full rounded-sm transition-colors",
                          day.views > 0 ? "bg-foreground/75 group-hover:bg-foreground" : "bg-muted",
                        )}
                        style={{ height: `${height}%` }}
                      />
                      {index % 3 === 0 || index === data.daily.length - 1 ? (
                        <span className="mt-1.5 block text-center text-[9px] tabular-nums text-muted-foreground">
                          {formatDay(day.date)}
                        </span>
                      ) : (
                        <span className="mt-1.5 block text-[9px] opacity-0">·</span>
                      )}
                    </div>
                  )
                })}
              </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                Engagement rate
                <span className="font-semibold tabular-nums text-foreground">
                  {data.engagement_rate}%
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5" />
                <span className="tabular-nums text-foreground">{compact(data.totals.saves)}</span> saves
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="tabular-nums text-foreground">{compact(data.totals.branches)}</span> branches
              </span>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
