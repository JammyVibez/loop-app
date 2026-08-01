import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const {
      data: { user: inviter },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !inviter) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { invitee_id, session_id, session_title } = await request.json()

    if (!invitee_id || !session_id) {
      return NextResponse.json({ error: "Missing required invitation parameters" }, { status: 400 })
    }

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", inviter.id)
      .single()

    const inviterName = inviterProfile?.display_name || inviterProfile?.username || "A collaborator"
    const titleText = session_title ? `"${session_title}"` : "a new Co-Loop"

    // 1. Create System Notification for invitee
    await supabase.from("notifications").insert({
      user_id: invitee_id,
      type: "co_loop_invite",
      title: "Co-Loop Session Invitation 🚀",
      message: `${inviterName} invited you to collaborate on ${titleText}!`,
      data: {
        session_id,
        inviter_id: inviter.id,
        inviter_name: inviterName,
        inviter_avatar: inviterProfile?.avatar_url,
        action_url: `/co-loop/studio?session=${session_id}&invited=true`,
      },
      is_read: false,
    })

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
    if (conversationId) {
      const inviteMsg = `🚀 **Co-Loop Collaboration Invitation**\n${inviterName} invited you to edit live on ${titleText}.\n\n👉 [Click here to Accept & Join Session](/co-loop/studio?session=${session_id}&invited=true)`

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: inviter.id,
        author_id: inviter.id,
        recipient_id: invitee_id,
        content: inviteMsg,
        message_type: "co_loop_invite",
        media_url: `/co-loop/studio?session=${session_id}&invited=true`,
        created_at: new Date().toISOString(),
      })

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId)
    }

    return NextResponse.json({
      success: true,
      message: "Invitation sent successfully via DM and notification!",
    })
  } catch (error: any) {
    console.error("Co-loop invite error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
