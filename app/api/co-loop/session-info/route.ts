import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

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
        co_authors: coAuthors,
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
      co_authors: newSession?.co_authors || [],
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

    if (!session_id || !["active", "published", "ended"].includes(status)) {
      return NextResponse.json({ error: "session_id and a valid status are required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("co_loop_sessions")
      .update({ status, published_loop_id, updated_at: new Date().toISOString() })
      .eq("session_id", session_id)

    if (error) {
      console.warn("co_loop_sessions status update failed:", error.message)
    }

    return NextResponse.json({ success: true, session_id, status })
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
