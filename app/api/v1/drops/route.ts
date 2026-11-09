import { type NextRequest, NextResponse } from "next/server"
import { authDbPool } from "@/lib/auth"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * Drop / event list for `/drops` and the community events surfaces.
 *
 * These screens call `/api/v1/drops`, which only the Rust service serves. On a
 * deployment without RUST_API_ORIGIN that request fell through to Next's HTML
 * 404 page ("doctype html"), so the page could never show anything. This
 * serves the same shape from the tables the feature actually uses:
 * global_events (platform drops) and circle_events (community events).
 */

type Row = {
  kind: "event" | "challenge"
  source: string
  id: string
  title: string
  description: string | null
  category: string | null
  starts_at: string | null
  ends_at: string | null
  image_url: string | null
  participants_count: number | string | null
  reward_coins: number | string | null
  circle_id: string | null
  circle_name: string | null
  action_url: string | null
  created_at: string
}

function statusFor(startsAt: string | null, endsAt: string | null) {
  const now = Date.now()
  const start = startsAt ? new Date(startsAt).getTime() : null
  const end = endsAt ? new Date(endsAt).getTime() : null
  if (end !== null && end < now) return "ended" as const
  if (start !== null && start <= now && (end === null || end >= now)) return "live" as const
  if (start !== null && start > now) return "upcoming" as const
  return "active" as const
}

function int(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || "", 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request).catch(() => null)
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to see drops." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = int(searchParams.get("limit"), 30, 1, 75)
  const offset = int(searchParams.get("offset"), 0, 0, 1_000)
  const kind = searchParams.get("kind")
  const category = searchParams.get("category")
  const search = (searchParams.get("search") || "").trim().toLowerCase()
  const liveOnly = searchParams.get("live") === "true"
  const upcomingOnly = searchParams.get("upcoming") === "true"
  const sort = searchParams.get("sort") || "recommended"
  if (search.length > 120 || (liveOnly && upcomingOnly)) {
    return NextResponse.json({ error: "invalid_drop_filters", message: "Search is limited to 120 characters; choose either live or upcoming activity." }, { status: 400 })
  }
  if (!(["recommended", "upcoming", "popular", "recent"] as const).includes(sort as "recommended" | "upcoming" | "popular" | "recent")) {
    return NextResponse.json({ error: "invalid_drop_sort", message: "Choose a supported sort order." }, { status: 400 })
  }
  if (kind && kind !== "event" && kind !== "challenge") {
    return NextResponse.json({ error: "invalid_drop_kind", message: "Kind must be event or challenge." }, { status: 400 })
  }

  try {
    const { rows } = await authDbPool.query<Row>(
      `
      SELECT * FROM (
        SELECT
          'event'::text AS kind,
          'official_event'::text AS source,
          event.id::text AS id,
          event.title,
          event.description,
          COALESCE(event.category, 'Community') AS category,
          event.starts_at,
          event.ends_at,
          event.banner_url AS image_url,
          COALESCE(event.rsvp_count, 0) AS participants_count,
          COALESCE(event.reward_coins, 0) AS reward_coins,
          NULL::text AS circle_id,
          NULL::text AS circle_name,
          '/events/' || event.id::text AS action_url,
          event.created_at
        FROM global_events AS event
        WHERE event.is_active = true

        UNION ALL

        SELECT
          'event'::text AS kind,
          'hosted_event'::text AS source,
          circle_event.id::text AS id,
          circle_event.title,
          circle_event.description,
          COALESCE(circle_event.event_type, 'Event') AS category,
          circle_event.starts_at,
          circle_event.ends_at,
          NULL::text AS image_url,
          COALESCE(circle_event.participant_count, 0) AS participants_count,
          0 AS reward_coins,
          circle_event.circle_id::text AS circle_id,
          circle.name AS circle_name,
          '/communities/' || circle_event.circle_id::text AS action_url,
          circle_event.created_at
        FROM circle_events AS circle_event
        JOIN circles AS circle ON circle.id::text = circle_event.circle_id::text
        WHERE circle.owner_id = $1::uuid OR EXISTS (
          SELECT 1 FROM circle_members member
          WHERE member.circle_id = circle.id AND member.user_id = $1::uuid
            AND member.status IN ('active', 'approved')
        )

        UNION ALL

        SELECT
          'challenge'::text AS kind,
          'circle_challenge'::text AS source,
          challenge.id::text AS id,
          challenge.title,
          challenge.description,
          COALESCE(challenge.challenge_type, 'Community') AS category,
          challenge.starts_at,
          COALESCE(challenge.ends_at, challenge.created_at + interval '7 days') AS ends_at,
          NULL::text AS image_url,
          (SELECT COUNT(DISTINCT entry.user_id)::integer
           FROM community_challenge_entries entry WHERE entry.challenge_id = challenge.id) AS participants_count,
          COALESCE(challenge.reward_coins, 0) AS reward_coins,
          circle.id::text AS circle_id,
          circle.name AS circle_name,
          '/communities/' || circle.id::text || '/challenges/' || challenge.id::text AS action_url,
          challenge.created_at
        FROM circle_challenges challenge
        JOIN circles circle ON circle.id = challenge.circle_id
        WHERE challenge.status = 'active'
          AND (circle.owner_id = $1::uuid OR EXISTS (
            SELECT 1 FROM circle_members member
            WHERE member.circle_id = circle.id AND member.user_id = $1::uuid
              AND member.status IN ('active', 'approved')
          ))
      ) AS drops
      ORDER BY COALESCE(starts_at, created_at) DESC
      LIMIT 500
      `,
      [user.id],
    )

    let items = rows.map((row) => {
      const status = statusFor(row.starts_at, row.ends_at)
      return {
        id: row.id,
        kind: row.kind,
        source: row.source,
        title: row.title,
        description: row.description || "",
        category: row.category || "Community",
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        status,
        is_live: status === "live",
        image_url: row.image_url,
        participants_count: Number(row.participants_count || 0),
        reward_coins: Number(row.reward_coins || 0),
        circle_id: row.circle_id,
        circle_name: row.circle_name,
        action_url: row.action_url || "/drops",
        created_at: row.created_at,
      }
    })

    if (kind) items = items.filter((item) => item.kind === kind)
    if (category) items = items.filter((item) => item.category.toLowerCase() === category.toLowerCase())
    if (search) {
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(search) ||
          item.description.toLowerCase().includes(search) ||
          item.category.toLowerCase().includes(search),
      )
    }
    if (liveOnly) items = items.filter((item) => item.is_live)
    if (upcomingOnly) items = items.filter((item) => item.status === "upcoming")

    if (sort === "popular") items.sort((a, b) => b.participants_count - a.participants_count)
    else if (sort === "recent") items.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    else if (sort === "upcoming" || sort === "recommended") {
      items.sort((a, b) => {
        if (a.is_live !== b.is_live) return a.is_live ? -1 : 1
        const aStart = a.starts_at ? +new Date(a.starts_at) : Number.MAX_SAFE_INTEGER
        const bStart = b.starts_at ? +new Date(b.starts_at) : Number.MAX_SAFE_INTEGER
        return aStart - bStart
      })
    }

    const total = items.length
    const page = items.slice(offset, offset + limit)

    return NextResponse.json(
      {
        success: true,
        items: page,
        total,
        limit,
        offset,
        has_more: offset + page.length < total,
        live_count: items.filter((item) => item.is_live).length,
        challenge_count: items.filter((item) => item.kind === "challenge").length,
        event_count: items.filter((item) => item.kind === "event").length,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("[api/v1/drops] list failed:", error)
    return NextResponse.json(
      { success: false, error: "drops_unavailable", message: "Drops are unavailable right now." },
      { status: 503 },
    )
  }
}
