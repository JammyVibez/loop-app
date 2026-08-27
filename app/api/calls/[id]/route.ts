import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { createHmsAppToken, hmsGuestRole, hmsHostRole } from "@/lib/hms"
import { createLiveKitToken } from "@/lib/livekit"
import { getRealtimeProvider, providerNotConfiguredMessage, type RealtimeProvider } from "@/lib/realtime-provider"

export const dynamic = "force-dynamic"

type Supabase = ReturnType<typeof createServerClient>

async function canAccessSession(
  supabase: Supabase,
  session: any,
  userId: string,
): Promise<boolean> {
  if (session.creator_id === userId) return true
  if (session.conversation_id) {
    const { data } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", session.conversation_id)
      .eq("user_id", userId)
      .maybeSingle()
    if (data) return true
  }
  if (session.circle_id) {
    const { data } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", session.circle_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle()
    if (data) return true
  }
  return false
}

/**
 * GET /api/calls/[id] — fetch the session and mint a join token for the
 * caller (host role if they created the call, guest otherwise).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: session, error } = await supabase
      .from("call_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error || !session) return NextResponse.json({ error: "Call not found" }, { status: 404 })
    if (!(await canAccessSession(supabase, session, user.id))) {
      return NextResponse.json({ error: "You are not part of this call" }, { status: 403 })
    }
    if (session.status === "ended") {
      return NextResponse.json({ error: "This call has ended" }, { status: 410 })
    }

    const provider: RealtimeProvider | null = (session?.provider as RealtimeProvider) || getRealtimeProvider()
    if (!provider) {
      return NextResponse.json({ error: providerNotConfiguredMessage() }, { status: 503 })
    }

    const role = session.creator_id === user.id ? hmsHostRole() : hmsGuestRole()
    if (provider === "100ms") {
      const token = createHmsAppToken({ roomId: session.hms_room_id, userId: user.id, role })
      return NextResponse.json({ success: true, data: { session, token, role, provider } })
    }

    // LiveKit: everyone in an interactive call can talk; the creator is the host.
    const minted = await createLiveKitToken({
      room: session.hms_room_id || session.hms_room_name,
      identity: user.id,
      name: String((user.user_metadata as any)?.display_name || (user.user_metadata as any)?.username || user.email || user.id),
      canPublish: true,
    })
    return NextResponse.json({
      success: true,
      data: { session, token: minted.token, role, provider, url: minted.url },
    })
  } catch (error: any) {
    console.error("[calls] get call error:", error)
    return NextResponse.json({ error: error?.message || "Failed to load the call" }, { status: 500 })
  }
}

/** POST /api/calls/[id] — mark a call active (peer joined) or ended. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const action = body.action === "end" ? "end" : "active"

    const { data: session, error: fetchError } = await supabase
      .from("call_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (fetchError || !session) return NextResponse.json({ error: "Call not found" }, { status: 404 })
    if (!(await canAccessSession(supabase, session, user.id))) {
      return NextResponse.json({ error: "You are not part of this call" }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}
    if (action === "end") {
      updates.status = "ended"
      updates.ended_at = new Date().toISOString()
    } else if (session.status === "ringing") {
      updates.status = "active"
      updates.started_at = new Date().toISOString()
    }

    const { data: updated, error } = await supabase
      .from("call_sessions")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data: { session: updated } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update the call" }, { status: 500 })
  }
}

/** DELETE /api/calls/[id] — end + soft-delete a call session. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: session, error: fetchError } = await supabase
      .from("call_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (fetchError || !session) return NextResponse.json({ error: "Call not found" }, { status: 404 })
    if (!(await canAccessSession(supabase, session, user.id))) {
      return NextResponse.json({ error: "You are not part of this call" }, { status: 403 })
    }

    const { error } = await supabase
      .from("call_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: "Call ended" })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to end the call" }, { status: 500 })
  }
}
