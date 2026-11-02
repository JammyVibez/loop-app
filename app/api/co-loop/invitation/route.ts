import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const sessionId = body?.sessionId
    const inviteId = body?.inviteId
    const status = body?.status

    if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 160) {
      return NextResponse.json({ error: "A valid sessionId is required" }, { status: 400 })
    }
    if (status !== "accepted" && status !== "declined") {
      return NextResponse.json({ error: "Status must be accepted or declined" }, { status: 400 })
    }
    if (inviteId !== undefined && typeof inviteId !== "string") {
      return NextResponse.json({ error: "Invalid invitation ID" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: session, error: sessionError } = await supabase
      .from("co_loop_sessions")
      .select("session_id, deleted_at, status")
      .eq("session_id", sessionId)
      .maybeSingle()
    if (sessionError) {
      console.error("Co-Loop invitation session lookup failed:", sessionError.message)
      return NextResponse.json({ error: "Could not verify this invitation" }, { status: 500 })
    }
    if (!session) return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    if (session.deleted_at) return NextResponse.json({ error: "This room has been deleted" }, { status: 410 })

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("id, data")
      .eq("user_id", user.id)
      .eq("type", "co_loop_invite")
      .filter("data->>session_id", "eq", sessionId)
      .limit(1)
      .maybeSingle()
    if (notificationError) {
      console.error("Co-Loop invitation notification lookup failed:", notificationError.message)
      return NextResponse.json({ error: "Could not verify this invitation" }, { status: 500 })
    }

    const encodedSessionId = encodeURIComponent(sessionId)
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("id")
      .eq("recipient_id", user.id)
      .eq("message_type", "co_loop_invite")
      .like("media_url", `%session=${encodedSessionId}%`)
      .limit(1)
      .maybeSingle()
    if (messageError) {
      console.error("Co-Loop invitation message lookup failed:", messageError.message)
      return NextResponse.json({ error: "Could not verify this invitation" }, { status: 500 })
    }

    const hasInvitation = Boolean(notification || message)
    const suppliedIdMatches = inviteId === undefined
      || notification?.id === inviteId
      || message?.id === inviteId
    if (!hasInvitation || !suppliedIdMatches) {
      return NextResponse.json({ error: "This invitation was not sent to your account" }, { status: 403 })
    }

    if (status === "declined") {
      const { error: deleteNotificationError } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id)
        .eq("type", "co_loop_invite")
        .filter("data->>session_id", "eq", sessionId)
      if (deleteNotificationError) {
        console.error("Could not revoke declined Co-Loop notification:", deleteNotificationError.message)
        return NextResponse.json({ error: "Could not decline this invitation" }, { status: 500 })
      }

      const { error: deleteMessageError } = await supabase
        .from("messages")
        .delete()
        .eq("recipient_id", user.id)
        .eq("message_type", "co_loop_invite")
        .like("media_url", `%session=${encodedSessionId}%`)
      if (deleteMessageError) {
        console.error("Could not revoke declined Co-Loop message:", deleteMessageError.message)
        return NextResponse.json({ error: "Could not decline this invitation" }, { status: 500 })
      }
    } else if (notification?.id) {
      // Keep the direct invitation as a valid join credential while removing
      // its unread badge. Declined invitations are deleted above and cannot be
      // replayed by session-info's invitation check.
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id)
        .eq("user_id", user.id)
    }

    const channel = supabase.channel(`co-loop-invite:${sessionId}`)
    const { error: broadcastError } = await channel.send({
      type: "broadcast",
      event: "invite_status",
      payload: { sessionId, status, userId: user.id },
    })
    if (broadcastError) {
      console.warn("Co-Loop invitation response broadcast failed:", broadcastError)
    }

    return NextResponse.json({ success: true, sessionId, status })
  } catch (error) {
    console.error("Co-Loop invitation response failed:", error)
    return NextResponse.json({ error: "Failed to update invitation" }, { status: 500 })
  }
}
