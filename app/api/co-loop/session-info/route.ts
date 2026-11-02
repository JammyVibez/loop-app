import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { isCoLoopParticipant } from "@/lib/co-loop-session-access"

export const dynamic = "force-dynamic"

type CoAuthorEntry = {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  role: "Co-Author"
}

function toCoAuthorEntry(profile: any): CoAuthorEntry {
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name || profile.username,
    avatar_url: profile.avatar_url || null,
    role: "Co-Author",
  }
}

function mergeCoAuthors(existing: any[], addition: CoAuthorEntry) {
  const list = Array.isArray(existing) ? existing : []
  if (list.some((c) => c?.id === addition.id)) return list
  return [...list, addition]
}

export async function POST(request: NextRequest) {
  try {
    const callingUser = await getUserFromRequest(request)
    if (!callingUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()

    const body = await request.json()
    const session_id = body.session_id || body.sessionId

    if (!session_id) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 })
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, bio, is_verified")
      .eq("id", callingUser.id)
      .maybeSingle()

    // Check existing session
    const { data: existingSession } = await supabase
      .from("co_loop_sessions")
      .select("*, owner:profiles!owner_id(id, username, display_name, avatar_url, video_avatar_url, bio, is_verified)")
      .eq("session_id", session_id)
      .maybeSingle()

    if (existingSession) {
      // A retired room can never be rejoined — the published Loop it produced
      // is the durable artifact, not the studio session.
      if (existingSession.deleted_at) {
        return NextResponse.json({ error: "This room has been deleted", deleted: true }, { status: 410 })
      }

      // Caller is not the owner and not already a co-author — persist them as
      // a real co-author of this session (this is the durable roster that
      // both the Primary Creator's and every Co-Author's studio view read
      // from, instead of relying solely on ephemeral realtime presence).
      let coAuthors = Array.isArray(existingSession.co_authors) ? existingSession.co_authors : []
      if (existingSession.owner_id !== callingUser.id && callerProfile) {
        const nextCoAuthors = mergeCoAuthors(coAuthors, toCoAuthorEntry(callerProfile))
        if (nextCoAuthors.length !== coAuthors.length) {
          const { data: updated } = await supabase
            .from("co_loop_sessions")
            .update({ co_authors: nextCoAuthors, updated_at: new Date().toISOString() })
            .eq("session_id", session_id)
            .select("co_authors")
            .maybeSingle()
          coAuthors = updated?.co_authors || nextCoAuthors
        }
      }

      return NextResponse.json({
        success: true,
        session_id,
        owner_id: existingSession.owner_id,
        owner_username: existingSession.owner_username,
        inviter: existingSession.owner || { id: existingSession.owner_id, username: existingSession.owner_username },
        is_owner: existingSession.owner_id === callingUser.id,
        locked: Boolean(existingSession.locked),
        co_authors: coAuthors,
        draft: {
          title: existingSession.draft_title || "",
          content: existingSession.draft_content || "",
          updated_at: existingSession.draft_updated_at || null,
        },
      })
    }

    // Create session record setting caller as primary creator owner
    const ownerUsername = callerProfile?.username || callingUser.email?.split("@")[0] || "creator"
    const { data: newSession, error: insertError } = await supabase
      .from("co_loop_sessions")
      .insert({
        session_id,
        owner_id: callingUser.id,
        owner_username: ownerUsername,
        co_authors: [],
      })
      .select("*, owner:profiles!owner_id(id, username, display_name, avatar_url, video_avatar_url, bio, is_verified)")
      .single()

    if (insertError) {
      console.warn("Error creating co_loop_session:", insertError.message)
    }

    return NextResponse.json({
      success: true,
      session_id,
      owner_id: callingUser.id,
      owner_username: ownerUsername,
      inviter: callerProfile || newSession?.owner || { id: callingUser.id, username: ownerUsername },
      is_owner: true,
      locked: Boolean(newSession?.locked),
      co_authors: newSession?.co_authors || [],
      draft: {
        title: newSession?.draft_title || "",
        content: newSession?.draft_content || "",
        updated_at: newSession?.draft_updated_at || null,
      },
    })
  } catch (error: any) {
    console.error("Session info POST error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const callingUser = await getUserFromRequest(request)
    if (!callingUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()

    const body = await request.json()
const session_id = body.session_id || body.sessionId
    const status = body.status
    const published_loop_id = body.published_loop_id || body.publishedLoopId || null
    const hasDraft =
      typeof body.draft_title === "string" || typeof body.draft_content === "string"

    if (typeof session_id !== "string" || !session_id.trim() || session_id.length > 160) {
      return NextResponse.json({ error: "A valid session_id is required" }, { status: 400 })
    }
    if (status !== undefined && !["active", "published", "ended"].includes(status)) {
      return NextResponse.json({ error: "A valid status is required" }, { status: 400 })
    }
    if (!hasDraft && status === undefined && published_loop_id === null) {
      return NextResponse.json({ error: "No session changes were supplied" }, { status: 400 })
    }
    if (typeof body.draft_title === "string" && body.draft_title.length > 500) {
      return NextResponse.json({ error: "Draft titles cannot exceed 500 characters" }, { status: 400 })
    }
    if (typeof body.draft_content === "string" && body.draft_content.length > 40000) {
      return NextResponse.json({ error: "Draft content cannot exceed 40,000 characters" }, { status: 400 })
    }

    const { data: current, error: readError } = await supabase
      .from("co_loop_sessions")
      .select("owner_id, co_authors, locked, deleted_at, status")
      .eq("session_id", session_id)
      .maybeSingle()
    if (readError) {
      console.error("Co-Loop session access check failed:", readError.message)
      return NextResponse.json({ error: "Could not verify this room" }, { status: 500 })
    }
    if (!current) return NextResponse.json({ error: "This room does not exist" }, { status: 404 })
    if (current.deleted_at) return NextResponse.json({ error: "This room has been deleted" }, { status: 410 })
    if (!isCoLoopParticipant(current, callingUser.id)) {
      return NextResponse.json({ error: "You are not a participant in this room" }, { status: 403 })
    }
    const isHost = current.owner_id === callingUser.id
    if (current.locked && !isHost) {
      return NextResponse.json({ error: "The host has locked this room" }, { status: 403 })
    }
    if ((status !== undefined || published_loop_id !== null) && !isHost) {
      return NextResponse.json({ error: "Only the host can change room status or publish it" }, { status: 403 })
    }
    if (hasDraft && current.status !== "active" && !isHost) {
      return NextResponse.json({ error: "This room is no longer accepting draft edits" }, { status: 409 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status !== undefined) patch.status = status
    if (published_loop_id !== null) patch.published_loop_id = published_loop_id
    if (hasDraft) {
      // Autosave of the shared draft — durable so the room can rehydrate it.
      if (typeof body.draft_title === "string") patch.draft_title = body.draft_title.slice(0, 500)
      if (typeof body.draft_content === "string") patch.draft_content = body.draft_content.slice(0, 40_000)
      patch.draft_updated_at = new Date().toISOString()
    }

    const { error } = await supabase.from("co_loop_sessions").update(patch).eq("session_id", session_id).eq("owner_id", current.owner_id)

    if (error) {
      // Older deployments may not have the draft columns yet.
      console.warn("co_loop_sessions update failed:", error.message)
      if (hasDraft) return NextResponse.json({ success: true, session_id, draft_persisted: false })
    }

    return NextResponse.json({ success: true, session_id, status, draft_persisted: hasDraft ? !error : undefined })
  } catch (error: any) {
    console.error("Session info PATCH error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session_id = searchParams.get("session") || searchParams.get("id")
    const invited_by = searchParams.get("invitedBy") || searchParams.get("inviter")
    const is_invited_flag = searchParams.get("invited") === "true"

    if (!session_id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Extract calling user if present (best-effort — this GET is guest-safe)
    const callingUser = await getUserFromRequest(request).catch(() => null)

    let inviterProfile: any = null
    let coAuthors: any[] = []

    // 1. Check existing co_loop_sessions table
    const { data: sessionRecord } = await supabase
      .from("co_loop_sessions")
      .select("*, owner:profiles!owner_id(id, username, display_name, avatar_url, video_avatar_url, bio, is_verified)")
      .eq("session_id", session_id)
      .maybeSingle()

    if (sessionRecord) {
      coAuthors = Array.isArray(sessionRecord.co_authors) ? sessionRecord.co_authors : []
    }

    if (sessionRecord?.owner) {
      inviterProfile = sessionRecord.owner
    } else if (sessionRecord?.owner_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, video_avatar_url, bio, is_verified")
        .eq("id", sessionRecord.owner_id)
        .maybeSingle()
      if (p) inviterProfile = p
    }

    // 2. Fallback: check invitedBy parameter
    if (!inviterProfile && invited_by) {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, video_avatar_url, bio, is_verified")
        .ilike("username", invited_by.trim())
        .maybeSingle()
      if (data) inviterProfile = data
    }

    // 3. Fallback: check notifications table for co_loop_invite
    if (!inviterProfile) {
      const { data: notif } = await supabase
        .from("notifications")
        .select("data")
        .eq("type", "co_loop_invite")
        .filter("data->>session_id", "eq", session_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (notif?.data?.inviter_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, video_avatar_url, bio, is_verified")
          .eq("id", notif.data.inviter_id)
          .maybeSingle()
        if (p) inviterProfile = p
      }
    }

    // 4. Fallback: check direct messages for co_loop_invite
    if (!inviterProfile) {
      const { data: msg } = await supabase
        .from("messages")
        .select("sender_id, author_id")
        .eq("message_type", "co_loop_invite")
        .like("media_url", `%${session_id}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const senderId = msg?.sender_id || msg?.author_id
      if (senderId) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, video_avatar_url, bio, is_verified")
          .eq("id", senderId)
          .maybeSingle()
        if (p) inviterProfile = p
      }
    }

    // If an inviter Profile was resolved but sessionRecord wasn't in DB, record it now
    if (inviterProfile && !sessionRecord) {
      try {
        await supabase
          .from("co_loop_sessions")
          .insert({
            session_id,
            owner_id: inviterProfile.id,
            owner_username: inviterProfile.username,
            co_authors: [],
          })
      } catch (err) {
        // ignore duplicate
      }
    }

    // 5. If session STILL does not exist and caller is NOT explicitly invited, caller is the creator
    if (!sessionRecord && !inviterProfile && callingUser && !is_invited_flag && !invited_by) {
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, video_avatar_url, bio, is_verified")
        .eq("id", callingUser.id)
        .maybeSingle()

      if (callerProfile) {
        inviterProfile = callerProfile
        try {
          await supabase
            .from("co_loop_sessions")
            .insert({
              session_id,
              owner_id: callerProfile.id,
              owner_username: callerProfile.username,
              co_authors: [],
            })
        } catch (err) {
          // ignore duplicate
        }
      }
    }

    return NextResponse.json({
      success: true,
      session_id,
      inviter: inviterProfile || (invited_by ? {
        username: invited_by,
        display_name: invited_by,
        avatar_url: null,
      } : null),
      owner_id: inviterProfile?.id || null,
      owner_username: inviterProfile?.username || null,
      co_authors: coAuthors,
    })
  } catch (error: any) {
    console.error("Session info API error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
