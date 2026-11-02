import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { checkBlockStatus } from "@/lib/user-blocks"
import { isCoLoopParticipant } from "@/lib/co-loop-session-access"

export async function POST(request: NextRequest) {
  try {
    const inviter = await getUserFromRequest(request)
    if (!inviter) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    const body = await request.json().catch(() => ({}))
    const invitee_id = body.invitee_id
    const session_id = body.session_id
    const session_title = typeof body.session_title === "string" ? body.session_title.trim().slice(0, 120) : ""

    if (typeof invitee_id !== "string" || !invitee_id || typeof session_id !== "string" || !session_id.trim() || session_id.length > 160) {
      return NextResponse.json({ error: "A valid invitee_id and session_id are required" }, { status: 400 })
    }
    if (invitee_id === inviter.id) return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 })

    const { data: session, error: sessionError } = await supabase
      .from("co_loop_sessions")
      .select("owner_id, co_authors, status, locked, deleted_at")
      .eq("session_id", session_id)
      .maybeSingle()
    if (sessionError) return NextResponse.json({ error: "Could not verify this Co-Loop" }, { status: 500 })
    if (!session) return NextResponse.json({ error: "Co-Loop session not found" }, { status: 404 })
    if (session.deleted_at) return NextResponse.json({ error: "This Co-Loop has been deleted" }, { status: 410 })
    if (session.status !== "active") return NextResponse.json({ error: "This Co-Loop is no longer accepting collaborators" }, { status: 410 })
    const isHost = session.owner_id === inviter.id
    if (!isCoLoopParticipant(session, inviter.id)) return NextResponse.json({ error: "Only room participants can invite collaborators" }, { status: 403 })
    if (session.locked && !isHost) return NextResponse.json({ error: "The host has locked this room" }, { status: 423 })
    if (isCoLoopParticipant(session, invitee_id)) return NextResponse.json({ error: "That person is already in this Co-Loop" }, { status: 409 })

    const { data: inviteeProfile, error: inviteeError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", invitee_id)
      .maybeSingle()
    if (inviteeError) return NextResponse.json({ error: "Could not verify the invitee" }, { status: 500 })
    if (!inviteeProfile) return NextResponse.json({ error: "Invitee not found" }, { status: 404 })
    const block = await checkBlockStatus(supabase, inviter.id, invitee_id)
    if (block.blocked) return NextResponse.json({ error: "Invitations are unavailable for this user" }, { status: 403 })

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url")
      .eq("id", inviter.id)
      .single()

    const inviterName = inviterProfile?.display_name || inviterProfile?.username || "A collaborator"
    const titleText = session_title ? `"${session_title}"` : "a new Co-Loop"

    const inviterUsername = inviterProfile?.username || ""
    const joinUrl = `/co-loop/join?session=${encodeURIComponent(session_id)}&invitedBy=${encodeURIComponent(inviterUsername)}&invited=true`

    // Persist an in-app invitation before the recipient can enter the room.
    let notificationSent = false
    try {
      const { notifyUser } = await import("@/lib/notifications")
      const result = await notifyUser(supabase, {
        userId: invitee_id,
        type: "co_loop_invite",
        title: "Co-Loop Session Invitation 🚀",
        message: `${inviterName} invited you to collaborate on ${titleText}!`,
        actorId: inviter.id,
        actionUrl: joinUrl,
        data: {
          session_id,
          inviter_id: inviter.id,
          inviter_name: inviterName,
          inviter_avatar: inviterProfile?.avatar_url,
          action_url: joinUrl,
        },
        pushCategory: "circleInvites",
        priority: "high",
      })
      notificationSent = Boolean(result.notificationId)
    } catch (notifyErr) {
      console.warn("Co-loop invite notify failed:", notifyErr)
    }

    // 2. Locate or Create DM conversation with invitee
    let conversationId: string | null = null

    const { data: myMemberships } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", inviter.id)
      .is("left_at", null)

    const myConvIds = (myMemberships || []).map((m) => m.conversation_id)
    if (myConvIds.length > 0) {
      const { data: shared } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", invitee_id)
        .in("conversation_id", myConvIds)
        .is("left_at", null)
        .maybeSingle()

      if (shared) {
        conversationId = shared.conversation_id
      }
    }

    if (!conversationId) {
      // Create new conversation
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({
          type: "direct",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (newConv) {
        conversationId = newConv.id
        await supabase.from("conversation_participants").insert([
          { conversation_id: conversationId, user_id: inviter.id, role: "owner" },
          { conversation_id: conversationId, user_id: invitee_id, role: "member" },
        ])
      }
    }

    // Post direct message with studio link
    let messageSent = false
    if (conversationId) {
      const inviteMsg = `🚀 **Co-Loop Collaboration Invitation**\n${inviterName} invited you to edit live on ${titleText}.\n\n👉 [Click here to Accept & Join Session](${joinUrl})`

      const { error: messageError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: inviter.id,
        author_id: inviter.id,
        recipient_id: invitee_id,
        content: inviteMsg,
        message_type: "co_loop_invite",
        media_url: joinUrl,
        created_at: new Date().toISOString(),
      })

      messageSent = !messageError
      if (messageError) console.warn("Co-Loop invite DM failed:", messageError.message)
      if (messageSent) {
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId)
      }
    }

    if (!notificationSent && !messageSent) {
      return NextResponse.json({ error: "Could not deliver the invitation" }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      delivered_via: [notificationSent ? "notification" : null, messageSent ? "message" : null].filter(Boolean),
      message: "Invitation sent successfully.",
    })
  } catch (error: any) {
    console.error("Co-loop invite error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
