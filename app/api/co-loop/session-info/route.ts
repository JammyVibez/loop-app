import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "") || null
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: { user: callingUser }, error: authErr } = await supabase.auth.getUser(token)

    if (authErr || !callingUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const session_id = body.session_id || body.sessionId

    if (!session_id) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 })
    }

    // Check existing session
    const { data: existingSession } = await supabase
      .from("co_loop_sessions")
      .select("*, owner:profiles!owner_id(id, username, display_name, avatar_url, bio, is_verified)")
      .eq("session_id", session_id)
      .maybeSingle()

    if (existingSession) {
      return NextResponse.json({
        success: true,
        session_id,
        owner_id: existingSession.owner_id,
        owner_username: existingSession.owner_username,
        inviter: existingSession.owner || { id: existingSession.owner_id, username: existingSession.owner_username },
        is_owner: existingSession.owner_id === callingUser.id,
      })
    }

    // Get caller profile
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, is_verified")
      .eq("id", callingUser.id)
      .maybeSingle()

    // Create session record setting caller as primary creator owner
    const ownerUsername = callerProfile?.username || callingUser.email?.split("@")[0] || "creator"
    const { data: newSession, error: insertError } = await supabase
      .from("co_loop_sessions")
      .insert({
        session_id,
        owner_id: callingUser.id,
        owner_username: ownerUsername,
      })
      .select("*, owner:profiles!owner_id(id, username, display_name, avatar_url, bio, is_verified)")
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
    })
  } catch (error: any) {
    console.error("Session info POST error:", error)
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

    // Extract calling user token if present
    const authHeader = request.headers.get("authorization")
    let callingUser: any = null
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "")
      const { data: { user } } = await supabase.auth.getUser(token)
      callingUser = user
    }

    let inviterProfile: any = null

    // 1. Check existing co_loop_sessions table
    const { data: sessionRecord } = await supabase
      .from("co_loop_sessions")
      .select("*, owner:profiles!owner_id(id, username, display_name, avatar_url, bio, is_verified)")
      .eq("session_id", session_id)
      .maybeSingle()

    if (sessionRecord?.owner) {
      inviterProfile = sessionRecord.owner
    } else if (sessionRecord?.owner_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, is_verified")
        .eq("id", sessionRecord.owner_id)
        .maybeSingle()
      if (p) inviterProfile = p
    }

    // 2. Fallback: check invitedBy parameter
    if (!inviterProfile && invited_by) {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, is_verified")
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
          .select("id, username, display_name, avatar_url, bio, is_verified")
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
          .select("id, username, display_name, avatar_url, bio, is_verified")
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
          })
      } catch (err) {
        // ignore duplicate
      }
    }

    // 5. If session STILL does not exist and caller is NOT explicitly invited, caller is the creator
    if (!sessionRecord && !inviterProfile && callingUser && !is_invited_flag && !invited_by) {
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, is_verified")
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
    })
  } catch (error: any) {
    console.error("Session info API error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
