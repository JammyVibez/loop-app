import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { SURFACE_LABELS, type ViewSurface } from "@/lib/post-analytics"

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

const RANGES = {
  "24h": { label: "24 hours", days: 1, granularity: "hour" as const },
  "7d": { label: "7 days", days: 7, granularity: "day" as const },
  "30d": { label: "30 days", days: 30, granularity: "day" as const },
}

type RangeKey = keyof typeof RANGES

function resolveRange(value: string | null): RangeKey {
  return value && value in RANGES ? (value as RangeKey) : "7d"
}

interface Bucket {
  bucket: string
  label: string
  views: number
  likes: number
  comments: number
}

function hourKey(date: Date) {
  return new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS).toISOString()
}

function dayKey(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString()
}

/**
 * Per-post analytics.
 *
 * Author (or staff) only. Counts come from `loop_stats` so they always match
 * what the feed shows; the timeline, surfaces and follower split come from
 * `loop_view_events`, which is written by the view interaction.
 *
 * Older posts have no event history, so the endpoint degrades honestly: totals
 * still report, the timeline reads as "no activity in this window" instead of
 * inventing a shape.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: loopId } = await params
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()

    const { data: loop, error: loopError } = await supabase
      .from("loops")
      .select("id, author_id, created_at")
      .eq("id", loopId)
      .maybeSingle()

    if (loopError) throw loopError
    if (!loop) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    const isOwner = loop.author_id === user.id

    let isStaff = false
    if (!isOwner) {
      const { data: viewer } = await supabase
        .from("profiles")
        .select("is_admin, is_moderator, staff_role")
        .eq("id", user.id)
        .maybeSingle()
      isStaff = Boolean(viewer?.is_admin || viewer?.is_moderator || viewer?.staff_role)
    }

    if (!isOwner && !isStaff) {
      return NextResponse.json(
        { error: "Only the author can see analytics for this post" },
        { status: 403 },
      )
    }

    const rangeKey = resolveRange(request.nextUrl.searchParams.get("range"))
    const range = RANGES[rangeKey]
    const now = new Date()
    const since = new Date(now.getTime() - range.days * DAY_MS)

    const [{ data: stats }, { data: events }, { data: comments }, { count: boostCount }, { count: quoteCount }] =
      await Promise.all([
        supabase.from("loop_stats").select("*").eq("loop_id", loopId).maybeSingle(),
        supabase
          .from("loop_view_events")
          .select("viewer_id, surface, is_follower, created_at")
          .eq("loop_id", loopId)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .limit(10000),
        supabase
          .from("comments")
          .select("created_at")
          .eq("loop_id", loopId)
          .gte("created_at", since.toISOString())
          .limit(3000),
        supabase
          .from("loop_boosts")
          .select("id", { count: "exact", head: true })
          .eq("loop_id", loopId),
        supabase
          .from("loops")
          .select("id", { count: "exact", head: true })
          .eq("quoted_loop_id", loopId),
      ])

    // ── Timeline buckets ────────────────────────────────────────────
    const buckets: Bucket[] = []
    if (range.granularity === "hour") {
      const base = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS)
      for (let i = 23; i >= 0; i -= 1) {
        const at = new Date(base.getTime() - i * HOUR_MS)
        buckets.push({
          bucket: hourKey(at),
          label: at.toISOString().slice(11, 16),
          views: 0,
          likes: 0,
          comments: 0,
        })
      }
    } else {
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      for (let i = range.days - 1; i >= 0; i -= 1) {
        const at = new Date(today.getTime() - i * DAY_MS)
        buckets.push({
          bucket: dayKey(at),
          label: at.toISOString().slice(5, 10),
          views: 0,
          likes: 0,
          comments: 0,
        })
      }
    }

    const byKey = new Map(buckets.map((b) => [b.bucket, b]))
    const resolveBucket = (iso: string) => {
      const at = new Date(iso)
      if (Number.isNaN(at.getTime())) return null
      return byKey.get(range.granularity === "hour" ? hourKey(at) : dayKey(at)) || null
    }

    const surfaceCounts = new Map<string, number>()
    const uniqueViewers = new Set<string>()
    let impressions = 0
    let followerImpressions = 0
    let nonFollowerImpressions = 0
    const followerViewers = new Set<string>()
    const nonFollowerViewers = new Set<string>()

    for (const event of events || []) {
      impressions += 1
      const viewerId = (event as { viewer_id?: string | null }).viewer_id
      if (viewerId) uniqueViewers.add(viewerId)
      if ((event as { is_follower?: boolean }).is_follower) {
        followerImpressions += 1
        if (viewerId) followerViewers.add(viewerId)
      } else {
        nonFollowerImpressions += 1
        if (viewerId) nonFollowerViewers.add(viewerId)
      }
      const surface = String((event as { surface?: string }).surface || "other")
      surfaceCounts.set(surface, (surfaceCounts.get(surface) || 0) + 1)
      const bucket = resolveBucket(String((event as { created_at: string }).created_at))
      if (bucket) bucket.views += 1
    }

    for (const comment of comments || []) {
      const bucket = resolveBucket(String((comment as { created_at: string }).created_at))
      if (bucket) bucket.comments += 1
    }

    const hasEventData = impressions > 0
    const totals = {
      views: Number(stats?.views_count || 0),
      impressions,
      unique_viewers: uniqueViewers.size,
      likes: Number(stats?.likes_count || 0),
      comments: Number(stats?.comments_count || 0),
      branches: Number(stats?.branches_count || 0),
      boosts: Number(boostCount || 0),
      shares: Number(stats?.shares_count || 0),
      saves: Number(stats?.saves_count || 0),
      quotes: Number(quoteCount || 0),
    }

    const engagements =
      totals.likes + totals.comments + totals.branches + totals.shares + totals.saves + totals.boosts
    // Reach is the honest denominator: unique people, not repeat impressions.
    const reach = totals.unique_viewers || totals.views
    const engagementRate = reach > 0 ? (engagements / reach) * 100 : 0

    const referrers = Array.from(surfaceCounts.entries())
      .map(([surface, views]) => ({
        surface,
        label: SURFACE_LABELS[surface as ViewSurface] || "Other",
        views,
        share: impressions > 0 ? Number(((views / impressions) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 6)

    const busiest = buckets.reduce<Bucket | null>(
      (best, bucket) => (!best || bucket.views > best.views ? bucket : best),
      null,
    )

    return NextResponse.json({
      success: true,
      analytics: {
        loop_id: loopId,
        created_at: loop.created_at,
        range: rangeKey,
        range_label: range.label,
        range_days: range.days,
        granularity: range.granularity,
        totals,
        engagements,
        engagement_rate: Number(engagementRate.toFixed(1)),
        series: buckets,
        busiest_bucket: busiest && busiest.views > 0 ? busiest : null,
        average_daily_views: range.days > 0 ? Math.round(impressions / range.days) : impressions,
        audience: {
          followers: followerViewers.size,
          non_followers: nonFollowerViewers.size,
          follower_impressions: followerImpressions,
          non_follower_impressions: nonFollowerImpressions,
          follower_share:
            followerImpressions + nonFollowerImpressions > 0
              ? Number(((followerImpressions / (followerImpressions + nonFollowerImpressions)) * 100).toFixed(1))
              : null,
        },
        referrers,
        has_event_data: hasEventData,
      },
    })
  } catch (error: any) {
    console.error("Post analytics error:", error)
    return NextResponse.json({ error: "Could not load analytics" }, { status: 500 })
  }
}
