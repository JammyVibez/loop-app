import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session_id = searchParams.get("session") || searchParams.get("id")
    const invited_by = searchParams.get("invitedBy") || searchParams.get("inviter")

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

    // 5. If session does not exist in co_loop_sessions and caller is authenticated, register caller as owner
    if (!sessionRecord && callingUser) {
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, is_verified")
        .eq("id", callingUser.id)
        .maybeSingle()

      if (callerProfile) {
        // Only set caller as owner if no inviter profile was found from invitedBy / notifications
        if (!inviterProfile) {
          inviterProfile = callerProfile
        }

        // Record session
        const { error: insertErr } = await supabase
          .from("co_loop_sessions")
          .insert({
            session_id,
            owner_id: inviterProfile.id,
            owner_username: inviterProfile.username,
          })

        if (insertErr) {
          console.warn("co_loop_sessions insert fallback:", insertErr.message)
        }
      }
    }

    return NextResponse.json({
      success: true,
      session_id,
      inviter: inviterProfile || {
        username: invited_by || "a collaborator",
        display_name: invited_by || "A Creator on Loop",
        avatar_url: null,
      },
      owner_id: inviterProfile?.id || null,
      owner_username: inviterProfile?.username || null,
    })
  } catch (error: any) {
    console.error("Session info API error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
