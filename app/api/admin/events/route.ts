import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * Admin → Global Events.
 *
 * These rows are the platform-wide events shown in the Events hub, on the
 * home page and in the admin Events tab. They live in `global_events`
 * (see scripts/global-events-schema.sql).
 *
 * Two things used to make this section look broken from the admin panel:
 *   1. the GET embedded `event_rsvps(count)`, and PostgREST cannot embed
 *      across the two tables (no FK), so every request errored and fell back
 *      to a hard-coded demo array — the panel looked populated but was fake;
 *   2. writes ignored their errors, so create/edit/delete "succeeded" while
 *      touching nothing.
 * Both are fixed here: rsvp counts are counted in a separate query and every
 * write reports what actually happened.
 */

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205", "PGRST204"])

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code && MISSING_TABLE_CODES.has(error.code)) return true
  const message = error.message || ""
  return /does not exist|could not find the table|schema cache/i.test(message)
}

const SETUP_HINT = "Run scripts/global-events-schema.sql against your database to enable global events."

/** RSVP counts, counted directly — no PostgREST embed, no FK required. */
async function loadRsvpCounts(
  supabase: ReturnType<typeof createServerClient>,
  eventIds: string[],
): Promise<Record<string, number>> {
  if (!eventIds.length) return {}
  const { data, error } = await supabase.from("event_rsvps").select("event_id").in("event_id", eventIds)
  if (error || !data) return {}
  return data.reduce<Record<string, number>>((acc, row: any) => {
    if (!row?.event_id) return acc
    acc[row.event_id] = (acc[row.event_id] || 0) + 1
    return acc
  }, {})
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const supabase = createServerClient()
    const { data: events, error } = await supabase
      .from("global_events")
      .select("*")
      .order("starts_at", { ascending: true })

    if (error) {
      // Never fake data. An empty list plus a reason is something the admin
      // can act on; two invented events are not.
      const missing = isMissingTable(error)
      console.error("admin global_events GET:", error.message)
      return NextResponse.json({
        success: true,
        events: [],
        tableReady: !missing,
        setupRequired: missing,
        error: missing ? "global_events table is missing" : error.message,
        hint: missing ? SETUP_HINT : undefined,
      })
    }

    const rows = events || []
    const counts = await loadRsvpCounts(supabase, rows.map((e: any) => e.id))

    return NextResponse.json({
      success: true,
      tableReady: true,
      events: rows.map((event: any) => ({
        ...event,
        rsvp_count: counts[event.id] ?? event.rsvp_count ?? 0,
      })),
    })
  } catch (error: any) {
    console.error("admin global_events GET error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAdmin(request)
  if (response) return response

  try {
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))

    const title = String(body.title || "").trim()
    const description = String(body.description || "").trim()
    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 })
    }

    const startsAt = body.starts_at ? new Date(body.starts_at) : new Date()
    const endsAt = body.ends_at ? new Date(body.ends_at) : new Date(Date.now() + 2 * 86400000)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "Start and end times must be valid dates" }, { status: 400 })
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      return NextResponse.json({ error: "The end time has to be after the start time" }, { status: 400 })
    }

    const rawTags = Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(",")
    const tags = rawTags.map((tag: unknown) => String(tag).trim()).filter(Boolean).slice(0, 12)
    const category = String(body.category || "General").trim() || "General"

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", user!.id)
      .maybeSingle()

    const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const nowIso = new Date().toISOString()

    const newEvent = {
      id: eventId,
      title,
      description,
      category,
      banner_url:
        String(body.banner_url || "").trim() ||
        "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80",
      location_type: String(body.location_type || "Virtual Stage").trim() || "Virtual Stage",
      external_link: String(body.external_link || "").trim(),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: startsAt.getTime() <= Date.now() ? "live" : "upcoming",
      is_live: startsAt.getTime() <= Date.now(),
      is_active: body.is_active !== false,
      is_featured: Boolean(body.is_featured),
      reward_coins: Math.max(0, Number(body.reward_coins) || 0),
      badge_reward: String(body.badge_reward || "Event Participant").trim() || "Event Participant",
      tags: tags.length ? tags : [category],
      rsvp_count: 0,
      created_by: user!.id,
      created_at: nowIso,
      updated_at: nowIso,
    }

    const { data: created, error } = await supabase.from("global_events").insert(newEvent).select().single()

    if (error) {
      const missing = isMissingTable(error)
      console.error("admin global_events POST:", error.message)
      return NextResponse.json(
        {
          error: missing
            ? "The global_events table doesn't exist yet, so this event can't be saved."
            : error.message || "Could not create the event",
          setupRequired: missing,
          hint: missing ? SETUP_HINT : undefined,
        },
        { status: missing ? 503 : 500 },
      )
    }

    // Give the admin a host seat on the roster so the stage isn't empty.
    // RSVP/participant bookkeeping elsewhere is id-based and doesn't need a
    // matching row in `events`, so this is the only side record we write.
    const { error: participantError } = await supabase.from("event_participants").insert({
      id: `p-${user!.id}-${eventId}`,
      event_id: eventId,
      user_id: user!.id,
      username: profile?.username || user!.email?.split("@")[0] || "admin",
      display_name: profile?.display_name || "Admin Host",
      avatar_url: profile?.avatar_url || "/placeholder.svg",
      role: "host",
      status: "joined",
      joined_at: nowIso,
    })
    if (participantError) {
      // The event itself saved — the host seat is a nicety, not a blocker.
      console.warn("admin global_events POST host seat:", participantError.message)
    }

    return NextResponse.json({
      success: true,
      event: created || newEvent,
      message: `"${title}" is live across the app.`,
    })
  } catch (error: any) {
    console.error("admin global_events POST error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
