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
      .select("session_id, owner_id, deleted_at, status")
      .eq("session_id", sessionId)
      .maybeSingle()
    if (sessionError) {
      console.error("Co-Loop invitation session lookup failed:", sessionError.message)
      return NextResponse.json({ error: "Could not verify this invitation" }, { status: 500 })
    }
    if (!session) return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    if (session.deleted_at) return NextResponse.json({ error: "This room has been deleted" }, { status: 410 })

    const { data: ledger, error: ledgerError } = await supabase
      .from("co_loop_invitations")
      .select("id, status")
      .eq("session_id", sessionId)
      .eq("invitee_id", user.id)
      .maybeSingle()
    if (ledgerError) {
      console.error("Co-Loop invitation ledger lookup failed:", ledgerError.message)
      return NextResponse.json({ error: "Could not verify this invitation" }, { status: 500 })
    }

    const encodedSessionId = encodeURIComponent(sessionId)
    let notification: { id: string; data: unknown } | null = null
    let message: { id: string } | null = null
    if (!ledger) {
      // Bridge old invitation delivery records. A persisted ledger denial always
      // wins over stale notifications or messages.
      const { data: oldNotification, error: notificationError } = await supabase
        .from("notifications")
        .select("id, data")
        .eq("user_id", user.id)
        .eq("type", "co_loop_invite")
        .filter("data->>session_id", "eq", sessionId)
        .limit(1)
        .maybeSingle()
      if (notificationError) {
        console.error("Legacy invitation notification lookup failed:", notificationError.message)
        return NextResponse.json({ error: "Could not verify this invitation" }, { status: 500 })
      }
      notification = oldNotification
      const { data: oldMessage, error: messageError } = await supabase
        .from("messages")
        .select("id")
        .eq("recipient_id", user.id)
        .eq("message_type", "co_loop_invite")
        .like("media_url", `%session=${encodedSessionId}%`)
        .limit(1)
        .maybeSingle()
      if (messageError) {
        console.error("Legacy invitation message lookup failed:", messageError.message)
        return NextResponse.json({ error: "Could not verify this invitation" }, { status: 500 })
      }
      message = oldMessage
      if (!notification && !message) {
        return NextResponse.json({ error: "This invitation was not sent to your account" }, { status: 403 })
      }
      const legacyInviterId =
        notification?.data && typeof notification.data === "object" && "inviter_id" in notification.data
          ? String((notification.data as Record<string, unknown>).inviter_id)
          : session.owner_id
      const { error: backfillError } = await supabase
        .from("co_loop_invitations")
        .upsert({
          session_id: sessionId,
          inviter_id: legacyInviterId,
          invitee_id: user.id,
          status: "pending",
        }, { onConflict: "session_id,invitee_id" })
      if (backfillError) {
        console.error("Legacy invitation ledger backfill failed:", backfillError.message)
        return NextResponse.json({ error: "Could not verify this invitation" }, { status: 500 })
      }
    } else if (ledger.status !== "pending" && ledger.status !== "accepted") {
      return NextResponse.json({ error: "This invitation is no longer active" }, { status: 409 })
    }

    const suppliedIdMatches = inviteId === undefined
      || notification?.id === inviteId
      || message?.id === inviteId
      || ledger?.id === inviteId
    if (!suppliedIdMatches) {
      return NextResponse.json({ error: "This invitation was not sent to your account" }, { status: 403 })
    }

    if (ledger?.status === "accepted") {
      if (status === "accepted") return NextResponse.json({ success: true, sessionId, status })
      return NextResponse.json({ error: "An accepted invitation cannot be declined" }, { status: 409 })
    }

    const { data: updatedLedger, error: ledgerUpdateError } = await supabase
      .from("co_loop_invitations")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("session_id", sessionId)
      .eq("invitee_id", user.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle()
    if (ledgerUpdateError) {
      console.error("Co-Loop invitation state update failed:", ledgerUpdateError.message)
      return NextResponse.json({ error: "Could not update this invitation" }, { status: 500 })
    }
    if (!updatedLedger) {
      return NextResponse.json({ error: "Invitation state changed. Refresh and try again." }, { status: 409 })
    }

    if (status === "declined") {
      // The ledger is authoritative; delivery cleanup can be retried without
      // reopening access to a declined invitation.
      const { error: notificationDeleteError } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id)
        .eq("type", "co_loop_invite")
        .filter("data->>session_id", "eq", sessionId)
      if (notificationDeleteError) console.warn("Declined notification cleanup failed:", notificationDeleteError.message)

      const { error: messageDeleteError } = await supabase
        .from("messages")
        .delete()
        .eq("recipient_id", user.id)
        .eq("message_type", "co_loop_invite")
        .like("media_url", `%session=${encodedSessionId}%`)
      if (messageDeleteError) console.warn("Declined message cleanup failed:", messageDeleteError.message)
    } else if (notification?.id) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id).eq("user_id", user.id)
    }

    try {
      const channel = supabase.channel(`co-loop-invite:${sessionId}`)
      await channel.send({
        type: "broadcast",
        event: "invite_status",
        payload: { sessionId, status, userId: user.id },
      })
    } catch (broadcastError) {
      console.warn("Co-Loop invitation response broadcast failed:", broadcastError)
    }

    return NextResponse.json({ success: true, sessionId, status })
  } catch (error) {
    console.error("Co-Loop invitation response failed:", error)
    return NextResponse.json({ error: "Failed to update invitation" }, { status: 500 })
  }
}
