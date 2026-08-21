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
    const action = body.action || "join" // join, leave, update_role, kick, mute, unmute

    const supabase = createServerClient()

    // Load the event + acting user's profile once; used for every action.
    const { data: eventRow } = await supabase
      .from("events")
      .select("id, host_id, allow_type, status")
      .eq("id", eventId)
      .maybeSingle()

    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("is_admin, is_premium, is_verified, is_organization, organization_name, premium_expires_at")
      .eq("id", user.id)
      .maybeSingle()

    const { data: actorParticipant } = await supabase
      .from("event_participants")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle()

    const actorRole = actorParticipant?.role || "attendee"
    const isMod = Boolean(
      eventRow?.host_id === user.id ||
        actorProfile?.is_admin ||
        actorRole === "host" ||
        actorRole === "moderator",
    )

    if (!isMod && ["update_role", "kick", "mute", "unmute"].includes(action)) {
      return NextResponse.json({ error: "Only the host or a moderator can do that" }, { status: 403 })
    }

    if (action === "update_role") {
      const { target_user_id, role } = body
      if (!target_user_id || !role) {
        return NextResponse.json({ error: "target_user_id and role required" }, { status: 400 })
      }
      const ALLOWED_ROLES = ["speaker", "listener", "moderator", "attendee"]
      const safeRole = ALLOWED_ROLES.includes(role) ? role : "attendee"
      await supabase
        .from("event_participants")
        .update({ role: safeRole })
        .eq("event_id", eventId)
        .eq("user_id", target_user_id)

      return NextResponse.json({ success: true, message: `Updated participant role to ${safeRole}` })
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

    if (action === "mute" || action === "unmute") {
      const { target_user_id } = body
      if (!target_user_id) {
        return NextResponse.json({ error: "target_user_id required" }, { status: 400 })
      }
      if (action === "mute") {
        await supabase
          .from("event_participants")
          .update({ is_muted: true, muted_at: new Date().toISOString() })
          .eq("event_id", eventId)
          .eq("user_id", target_user_id)
        await supabase.from("event_mutes").upsert(
          { event_id: eventId, user_id: target_user_id, muted_by: user.id },
          { onConflict: "event_id,user_id" },
        )
      } else {
        await supabase
          .from("event_participants")
          .update({ is_muted: false, muted_at: null })
          .eq("event_id", eventId)
          .eq("user_id", target_user_id)
        await supabase
          .from("event_mutes")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", target_user_id)
      }
      return NextResponse.json({
        success: true,
        message: action === "mute" ? "Participant muted on stage" : "Participant unmuted",
      })
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
      .select("username, display_name, avatar_url, video_avatar_url")
      .eq("id", user.id)
      .single()

    const uUsername = userProfile?.username || user.email?.split("@")[0] || "user"
    const uDisplayName = userProfile?.display_name || uUsername
    const uAvatar = userProfile?.avatar_url || "/placeholder.svg"

    // Default action is JOIN — enforce the event's audience restriction first.
    const allowType = eventRow?.allow_type || "everyone"
    if (allowType !== "everyone") {
      const actorIsPro =
        Boolean(actorProfile?.is_premium) &&
        (!actorProfile?.premium_expires_at || new Date(actorProfile.premium_expires_at).getTime() > Date.now())
      const actorIsVerified = Boolean(actorProfile?.is_verified)
      const actorIsOrg = Boolean(actorProfile?.is_organization || actorProfile?.organization_name)
      const passes =
        allowType === "pro"
          ? actorIsPro
          : allowType === "verified"
            ? actorIsVerified
            : allowType === "organization"
              ? actorIsOrg
              : true
      if (!passes) {
        const label = allowType === "pro" ? "Pro members" : allowType === "verified" ? "verified accounts" : "organizations"
        return NextResponse.json(
          { error: `This event is restricted to ${label} only.` },
          { status: 403 },
        )
      }
    }

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

    // Stage-wide mute (host mute-all) — mark this join as muted.
    const { data: allMute } = await supabase
      .from("event_mutes")
      .select("event_id")
      .eq("event_id", eventId)
      .is("user_id", null)
      .maybeSingle()

    const participantPayload = {
      id: `p-${user.id}-${eventId}`,
      event_id: eventId,
      user_id: user.id,
      username: uUsername,
      display_name: uDisplayName,
      avatar_url: uAvatar,
      role: "attendee",
      status: "joined",
      is_muted: Boolean(allMute),
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
