import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

type Action = "lock" | "unlock" | "delete" | "kick"

/**
 * Host controls for a Co-Loop room.
 *
 * - lock/unlock — the host freezes the draft for everyone else (the studio
 *   disables editing for non-hosts) while keeping the room open to read.
 * - delete — soft-retires the session once the Co-Loop is published (or any
 *   time the host wants out). The published Loop itself is untouched; only the
 *   studio session row gets `deleted_at`, after which nobody can rejoin.
 *
 * Only the session owner may call this.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const sessionId = body.session_id || body.sessionId
    const action = body.action as Action
    const targetUserId = body.target_user_id || body.targetUserId || null

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 })
    }
    if (!["lock", "unlock", "delete", "kick"].includes(action)) {
      return NextResponse.json({ error: "Unknown room action" }, { status: 400 })
    }
    if (action === "kick" && !targetUserId) {
      return NextResponse.json({ error: "target_user_id is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: session } = await supabase
      .from("co_loop_sessions")
      .select("session_id, owner_id, locked, deleted_at, status, co_authors, feed_post_id, max_collaborators, open_invite_topic")
      .eq("session_id", sessionId)
      .maybeSingle()

    if (!session) {
      // Nothing recorded yet — a lock on an unseen room is meaningless, but a
      // delete should still succeed so the client can move on.
      if (action === "delete") return NextResponse.json({ success: true, session_id: sessionId, deleted: true })
      return NextResponse.json({ error: "This room does not exist" }, { status: 404 })
    }
    if (session.deleted_at) {
      return NextResponse.json({ error: "This room has been deleted" }, { status: 410 })
    }
    if (session.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the host can do that" }, { status: 403 })
    }

    if (action === "delete") {
      const { error } = await supabase
        .from("co_loop_sessions")
        .update({
          deleted_at: new Date().toISOString(),
          status: "ended",
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
      if (error) {
        console.error("co_loop_sessions delete failed:", error.message)
        return NextResponse.json({ error: "Could not delete this room" }, { status: 500 })
      }
      return NextResponse.json({ success: true, session_id: sessionId, deleted: true })
    }

    if (action === "kick") {
      if (targetUserId === user.id) {
        return NextResponse.json({ error: "The host can't remove themselves" }, { status: 400 })
      }

      // Revoke all access credentials before changing the visible roster.
      const { error: revokeError } = await supabase
        .from("co_loop_invitations")
        .upsert({
          session_id: sessionId,
          inviter_id: user.id,
          invitee_id: targetUserId,
          status: "revoked",
          responded_at: new Date().toISOString(),
        }, { onConflict: "session_id,invitee_id" })
      if (revokeError) {
        console.error("Co-Loop invitation revocation failed:", revokeError.message)
        return NextResponse.json({ error: "Could not revoke collaborator access" }, { status: 500 })
      }

      const { error: participantError } = await supabase
        .from("open_co_loop_participants")
        .delete()
        .eq("session_id", sessionId)
        .eq("user_id", targetUserId)
      if (participantError) {
        console.error("Open Co-Loop membership removal failed:", participantError.message)
        return NextResponse.json({ error: "Could not remove open-room membership" }, { status: 500 })
      }

      const { error: inviteNotificationError } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", targetUserId)
        .eq("type", "co_loop_invite")
        .filter("data->>session_id", "eq", sessionId)
      if (inviteNotificationError) console.warn("Kicked collaborator notification cleanup failed:", inviteNotificationError.message)

      const { error: inviteMessageError } = await supabase
        .from("messages")
        .delete()
        .eq("recipient_id", targetUserId)
        .eq("message_type", "co_loop_invite")
        .like("media_url", `%session=${encodeURIComponent(sessionId)}%`)
      if (inviteMessageError) console.warn("Kicked collaborator DM cleanup failed:", inviteMessageError.message)

      const currentCoAuthors = Array.isArray(session.co_authors) ? session.co_authors : []
      const removed = currentCoAuthors.find((c: any) => c?.id === targetUserId)
      const nextCoAuthors = currentCoAuthors.filter((c: any) => c?.id !== targetUserId)

      const { error: updateError } = await supabase
        .from("co_loop_sessions")
        .update({ co_authors: nextCoAuthors, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId)
      if (updateError) {
        console.error("co_loop_sessions kick update failed:", updateError.message)
        return NextResponse.json({ error: "Could not remove that co-author" }, { status: 500 })
      }

      // Keep the feed invite card's participant count honest.
      if (session.feed_post_id) {
        const nextCount = nextCoAuthors.length + 1
        const max = session.max_collaborators || 4
        await supabase
          .from("loops")
          .update({
            content_metadata: {
              is_open_coloop_invite: true,
              session_id: sessionId,
              max_collaborators: max,
              topic: session.open_invite_topic || "",
              current_participants: nextCount,
              status: session.status === "published" ? "published" : nextCount >= max ? "full" : "open",
            },
          })
          .eq("id", session.feed_post_id)
      }

      // Tell every client to drop them; the removed user gets bounced out.
      try {
        const channel = supabase.channel(`co-loop-studio:${sessionId}`)
        await channel.send({
          type: "broadcast",
          event: "co-author-kicked",
          payload: {
            user_id: targetUserId,
            by: user.user_metadata?.display_name || user.user_metadata?.username || "The host",
            participant: removed || undefined,
          },
        })
      } catch {
        // best-effort
      }

      return NextResponse.json({ success: true, session_id: sessionId, kicked: true, target_user_id: targetUserId })
    }

    const locked = action === "lock"
    const { error } = await supabase
      .from("co_loop_sessions")
      .update({
        locked,
        locked_at: locked ? new Date().toISOString() : null,
        locked_by: locked ? user.id : null,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)

    if (error) {
      console.error("co_loop_sessions lock failed:", error.message)
      return NextResponse.json({ error: "Could not change the lock" }, { status: 500 })
    }

    return NextResponse.json({ success: true, session_id: sessionId, locked })
  } catch (error: any) {
    console.error("Co-Loop room-control error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
