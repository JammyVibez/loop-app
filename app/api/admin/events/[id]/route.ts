import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * Single global event — edit, feature/unfeature, publish/unpublish, delete.
 *
 * Previously this route spread the raw request body straight into the UPDATE,
 * checked only `is_admin` on a profile row, and reported success even when it
 * matched zero rows. So editing or deleting one of the demo events from the
 * admin panel looked like it worked and never persisted. Now: id-checked,
 * field-whitelisted, and honest about misses.
 */

const EDITABLE_FIELDS = [
  "title",
  "description",
  "category",
  "banner_url",
  "location_type",
  "external_link",
  "starts_at",
  "ends_at",
  "status",
  "is_live",
  "is_active",
  "is_featured",
  "reward_coins",
  "badge_reward",
  "tags",
] as const

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request)
  if (response) return response

  const { id } = await params
  const supabase = createServerClient()
  const { data, error } = await supabase.from("global_events").select("*").eq("id", id).maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Event not found" }, { status: 404 })
  return NextResponse.json({ success: true, event: data })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const { id } = await params
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))

    const patch: Record<string, unknown> = {}
    for (const field of EDITABLE_FIELDS) {
      if (body[field] === undefined) continue
      if (field === "tags") {
        const raw = Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(",")
        patch.tags = raw.map((tag: unknown) => String(tag).trim()).filter(Boolean).slice(0, 12)
        continue
      }
      if (field === "reward_coins") {
        patch.reward_coins = Math.max(0, Number(body.reward_coins) || 0)
        continue
      }
      if (field === "starts_at" || field === "ends_at") {
        const parsed = new Date(body[field])
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Start and end times must be valid dates" }, { status: 400 })
        }
        patch[field] = parsed.toISOString()
        continue
      }
      if (field === "is_active" || field === "is_featured" || field === "is_live") {
        patch[field] = Boolean(body[field])
        continue
      }
      patch[field] = typeof body[field] === "string" ? body[field].trim() : body[field]
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    // Mirror the published/live switches onto status so the public hub, the
    // event page and the admin list all agree on what state the event is in.
    if (patch.is_active === false) {
      patch.status = "ended"
      patch.is_live = false
      patch.ended_at = new Date().toISOString()
    } else if (patch.is_active === true && patch.status === undefined) {
      const existing = await supabase.from("global_events").select("status").eq("id", id).maybeSingle()
      if (existing.data?.status === "ended") {
        patch.status = "upcoming"
        patch.ended_at = null
      }
    }

    const { data: updated, error } = await supabase
      .from("global_events")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle()

    if (error) {
      console.error("admin global_events PUT:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json({ error: "Event not found — it may already have been deleted." }, { status: 404 })
    }

    return NextResponse.json({ success: true, event: updated, message: "Event updated." })
  } catch (error: any) {
    console.error("admin global_events PUT error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const { id } = await params
    const supabase = createServerClient()

    const { data: deleted, error } = await supabase
      .from("global_events")
      .delete()
      .eq("id", id)
      .select("id, title")
      .maybeSingle()

    if (error) {
      console.error("admin global_events DELETE:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!deleted) {
      return NextResponse.json({ error: "Event not found — nothing to delete." }, { status: 404 })
    }

    // Clean the side tables by id so no orphan roster/RSVP rows are left
    // behind. Failures here don't undo the delete, they just get logged.
    const [participants, rsvps] = await Promise.all([
      supabase.from("event_participants").delete().eq("event_id", id),
      supabase.from("event_rsvps").delete().eq("event_id", id),
    ])
    if (participants.error) console.warn("admin global_events DELETE participants:", participants.error.message)
    if (rsvps.error) console.warn("admin global_events DELETE rsvps:", rsvps.error.message)

    return NextResponse.json({ success: true, message: `"${deleted.title}" was deleted.` })
  } catch (error: any) {
    console.error("admin global_events DELETE error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
