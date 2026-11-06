import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

const PERIOD_DAYS = 14
const DAY_MS = 86_400_000

interface DayBucket {
  date: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
}

function emptyDay(date: string): DayBucket {
  return { date, views: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
}

/**
 * Per-post analytics for the post's author.
 *
 * Totals come from loop_stats (the counters the rest of the app reads), the
 * daily series from loop_interactions and comments, so the numbers always agree
 * with what the feed shows.
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

    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)
    start.setUTCDate(start.getUTCDate() - (PERIOD_DAYS - 1))
    const sinceIso = start.toISOString()

    const [{ data: stats }, { data: events }, { data: comments }] = await Promise.all([
      supabase.from("loop_stats").select("*").eq("loop_id", loopId).maybeSingle(),
      supabase
        .from("loop_interactions")
        .select("interaction_type, created_at")
        .eq("loop_id", loopId)
        .gte("created_at", sinceIso)
        .limit(5000),
      supabase
        .from("comments")
        .select("created_at")
        .eq("loop_id", loopId)
        .gte("created_at", sinceIso)
        .limit(2000),
    ])

    const days = new Map<string, DayBucket>()
    for (let i = 0; i < PERIOD_DAYS; i += 1) {
      const day = new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10)
      days.set(day, emptyDay(day))
    }

    const add = (createdAt: string | null, field: keyof Omit<DayBucket, "date">) => {
      if (!createdAt) return
      const day = days.get(String(createdAt).slice(0, 10))
      if (day) day[field] += 1
    }

    for (const event of events || []) {
      const type = String((event as { interaction_type?: string }).interaction_type || "")
      if (type === "view") add((event as any).created_at, "views")
      else if (type === "like") add((event as any).created_at, "likes")
      else if (type === "share") add((event as any).created_at, "shares")
      else if (type === "save") add((event as any).created_at, "saves")
    }
    for (const comment of comments || []) {
      add((comment as any).created_at, "comments")
    }

    const daily = Array.from(days.values())
    const totals = {
      views: Number(stats?.views_count || 0),
      likes: Number(stats?.likes_count || 0),
      comments: Number(stats?.comments_count || 0),
      shares: Number(stats?.shares_count || 0),
      saves: Number(stats?.saves_count || 0),
      branches: Number(stats?.branches_count || 0),
    }

    const engagements = totals.likes + totals.comments + totals.shares + totals.saves
    const engagementRate = totals.views > 0 ? (engagements / totals.views) * 100 : 0

    const busiest = daily.reduce<DayBucket | null>(
      (best, day) => {
        const score = (d: DayBucket) => d.views + d.likes * 2 + d.comments * 2 + d.shares * 2
        return !best || score(day) > score(best) ? day : best
      },
      null,
    )

    return NextResponse.json({
      success: true,
      analytics: {
        period_days: PERIOD_DAYS,
        created_at: loop.created_at,
        totals,
        engagements,
        engagement_rate: Number(engagementRate.toFixed(1)),
        daily,
        busiest_day: busiest && (busiest.views || busiest.likes || busiest.comments) ? busiest : null,
        average_daily_views: Math.round(
          daily.reduce((sum, day) => sum + day.views, 0) / PERIOD_DAYS,
        ),
      },
    })
  } catch (error: any) {
    console.error("Post analytics error:", error)
    return NextResponse.json({ error: "Could not load analytics" }, { status: 500 })
  }
}
