import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

type Action = "lock" | "unlock" | "delete"

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

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 })
    }
    if (!["lock", "unlock", "delete"].includes(action)) {
      return NextResponse.json({ error: "Unknown room action" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: session } = await supabase
      .from("co_loop_sessions")
      .select("session_id, owner_id, locked, deleted_at, status")
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
