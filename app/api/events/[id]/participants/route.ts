import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const supabase = createServerClient()

    const { data: participants, error } = await supabase
      .from("event_participants")
      .select("*")
      .eq("event_id", eventId)

    if (error) {
      console.warn("Fetch event participants error:", error.message)
    }

    return NextResponse.json({
      success: true,
      participants: participants || []
    })
  } catch (error: any) {
    console.error("GET event participants error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action || "join" // join, leave, update_role, kick

    const supabase = createServerClient()

    if (action === "update_role") {
      const { target_user_id, role } = body
      if (!target_user_id || !role) {
        return NextResponse.json({ error: "target_user_id and role required" }, { status: 400 })
      }
      await supabase
        .from("event_participants")
        .update({ role })
        .eq("event_id", eventId)
        .eq("user_id", target_user_id)

      return NextResponse.json({ success: true, message: `Updated participant role to ${role}` })
    }

    if (action === "kick") {
      const { target_user_id } = body
      if (!target_user_id) {
        return NextResponse.json({ error: "target_user_id required" }, { status: 400 })
      }
      await supabase
        .from("event_participants")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", target_user_id)

      return NextResponse.json({ success: true, message: "Participant removed from stage" })
    }

    // Determine event type: community events live in `events`, official
    // platform-wide events live in `global_events`. Keep RSVPs synchronized
    // for both so the hub count and the stage roster agree.
    const { data: communityEvent } = await supabase
      .from("events")
      .select("id, participants_count")
      .eq("id", eventId)
      .maybeSingle()

    const { data: globalEvent } = communityEvent
      ? { data: null }
      : await supabase
          .from("global_events")
          .select("id, rsvp_count")
          .eq("id", eventId)
          .maybeSingle()

    const isGlobalEvent = Boolean(!communityEvent && globalEvent)

    if (action === "leave") {
      if (isGlobalEvent) {
        await supabase
          .from("event_rsvps")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id)

        const newCount = Math.max(0, (globalEvent?.rsvp_count || 1) - 1)
        await supabase.from("global_events").update({ rsvp_count: newCount }).eq("id", eventId)
      } else {
        await supabase
          .from("event_participants")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id)

        const newCount = Math.max(0, (communityEvent?.participants_count || 1) - 1)
        await supabase.from("events").update({ participants_count: newCount }).eq("id", eventId)
      }

      return NextResponse.json({
        success: true,
        action: "left",
        message: "You have left the event stage"
      })
    }

    // Fetch user profile details
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", user.id)
      .single()

    const uUsername = userProfile?.username || user.email?.split("@")[0] || "user"
    const uDisplayName = userProfile?.display_name || uUsername
    const uAvatar = userProfile?.avatar_url || "/placeholder.svg"

    // Default action is JOIN
    if (isGlobalEvent) {
      await supabase.from("event_rsvps").upsert(
        { event_id: eventId, user_id: user.id },
        { onConflict: "event_id,user_id" },
      )
      const newCount = (globalEvent?.rsvp_count || 0) + 1
      await supabase.from("global_events").update({ rsvp_count: newCount }).eq("id", eventId)

      return NextResponse.json({
        success: true,
        action: "joined",
        message: "You've RSVP'd to this official event!"
      })
    }

    const participantPayload = {
      id: `p-${user.id}-${eventId}`,
      event_id: eventId,
      user_id: user.id,
      username: uUsername,
      display_name: uDisplayName,
      avatar_url: uAvatar,
      role: "attendee",
      status: "joined",
      joined_at: new Date().toISOString()
    }

    await supabase.from("event_participants").upsert(participantPayload)

    // Increment participants count
    const newCount = (communityEvent?.participants_count || 0) + 1
    await supabase.from("events").update({ participants_count: newCount }).eq("id", eventId)

    return NextResponse.json({
      success: true,
      action: "joined",
      participant: participantPayload,
      message: "You have joined the event stage!"
    })
  } catch (error: any) {
    console.error("POST event participant error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
