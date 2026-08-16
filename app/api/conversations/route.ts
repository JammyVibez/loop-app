import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const getUser = getUserFromRequest

async function canMessage(supabase: ReturnType<typeof createServerClient>, fromId: string, toId: string) {
  // Recipient privacy gate first.
  const { data: recipient } = await supabase
    .from("profiles")
    .select("privacy_settings")
    .eq("id", toId)
    .maybeSingle()
  const privacy = (recipient as any)?.privacy_settings || {}
  const messagePrivacy = privacy.message_privacy || "everyone"

  if (messagePrivacy === "nobody" || messagePrivacy === "none") {
    return { allowed: false, reason: "This user has disabled direct messages." }
  }

  if (messagePrivacy === "followers") {
    const { data: senderFollows } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", fromId)
      .eq("following_id", toId)
      .maybeSingle()
    const { data: recipientFollows } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", toId)
      .eq("following_id", fromId)
      .maybeSingle()
    if (!senderFollows && !recipientFollows) {
      return { allowed: false, reason: "This user only accepts messages from people they follow or who follow them." }
    }
    return { allowed: true }
  }

  // "everyone" (default): allow if either user follows the other, otherwise still allow
  // (matches the pre-existing product behavior).
  return { allowed: true }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: memberships, error: membershipError } = await supabase
      .from("conversation_participants")
      .select("conversation_id, role, joined_at, last_read_at")
      .eq("user_id", user.id)
      .is("left_at", null)

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    const ids = (memberships || []).map((m) => m.conversation_id)
    if (!ids.length) {
      return NextResponse.json({ success: true, conversations: [] })
    }

    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("*")
      .in("id", ids)
      .order("updated_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: participants } = await supabase
      .from("conversation_participants")
      .select(`
        conversation_id,
        user_id,
        role,
        user:profiles!conversation_participants_user_id_fkey(
          id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id, active_cosmetics, cosmetics
        )
      `)
      .in("conversation_id", ids)
      .is("left_at", null)

    const { data: recentMessages } = await supabase
      .from("messages")
      .select("id, conversation_id, content, sender_id, author_id, created_at, message_type")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(200)

    const lastByConversation = new Map<string, any>()
    for (const message of recentMessages || []) {
      if (!lastByConversation.has(message.conversation_id)) {
        lastByConversation.set(message.conversation_id, message)
      }
    }

    // Unread counts per conversation — WhatsApp-style badges in the inbox.
    const unreadCounts = new Map<string, number>()
    const { data: unreadRows, error: unreadError } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", ids)
      .neq("author_id", user.id)
      .neq("sender_id", user.id)
      .eq("is_read", false)
    if (!unreadError && unreadRows) {
      for (const row of unreadRows) {
        unreadCounts.set(row.conversation_id, (unreadCounts.get(row.conversation_id) || 0) + 1)
      }
    }

    const enriched = (conversations || []).map((conversation) => {
      const people = (participants || []).filter((p) => p.conversation_id === conversation.id)
      const other = people.find((p) => p.user_id !== user.id)?.user || null
      return {
        ...conversation,
        participants: people,
        other_user: other,
        last_message: lastByConversation.get(conversation.id) || null,
        unread_count: unreadCounts.get(conversation.id) || 0,
      }
    })

    return NextResponse.json({ success: true, conversations: enriched })
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const participantIdsRaw = body.participant_ids || (body.participant_id ? [body.participant_id] : [])
    const participantIds = Array.from(
      new Set((participantIdsRaw as string[]).filter((id) => id && id !== user.id)),
    )

    if (!participantIds.length) {
      return NextResponse.json({ error: "Participant IDs are required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const isGroup = participantIds.length > 1 || body.type === "group" || body.is_group === true

    if (!isGroup) {
      const recipientId = participantIds[0]
      const { allowed, reason } = await canMessage(supabase, user.id, recipientId)
      if (!allowed) {
        return NextResponse.json({ error: reason || "You cannot message this user" }, { status: 403 })
      }
      const { data: recipient } = await supabase.from("profiles").select("id").eq("id", recipientId).maybeSingle()
      if (!recipient) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      // Reuse existing direct conversation if both users already share one with exactly 2 people
      const { data: myMemberships } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id)
        .is("left_at", null)

      const myIds = (myMemberships || []).map((m) => m.conversation_id)
      if (myIds.length) {
        const { data: theirMemberships } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", recipientId)
          .in("conversation_id", myIds)
          .is("left_at", null)

        for (const membership of theirMemberships || []) {
          const { data: people } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", membership.conversation_id)
            .is("left_at", null)
          if ((people || []).length === 2) {
            const { data: conversation } = await supabase
              .from("conversations")
              .select("*")
              .eq("id", membership.conversation_id)
              .single()
            return NextResponse.json({ success: true, conversation, reused: true })
          }
        }
      }
    }

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .insert({
        name: body.name || null,
        is_group: isGroup,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (convError) {
      return NextResponse.json({ error: convError.message || "Failed to create conversation" }, { status: 500 })
    }

    const participantData = [user.id, ...participantIds].map((userId) => ({
      conversation_id: conversation.id,
      user_id: userId,
      role: userId === user.id ? "owner" : "member",
      joined_at: new Date().toISOString(),
    }))

    const { error: participantError } = await supabase.from("conversation_participants").insert(participantData)
    if (participantError) {
      return NextResponse.json({ error: participantError.message || "Failed to add participants" }, { status: 500 })
    }

    return NextResponse.json({ success: true, conversation })
  } catch (error) {
    console.error("Error creating conversation:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/conversations?conversation_id=<id>&mode=delete|clear
 *
 * - mode=delete (default): remove the conversation for THIS user (marks the
 *   participant as left). If a 1:1 where the other side has also left, the
 *   conversation and its messages are hard-deleted from the database.
 * - mode=clear: hard-delete every message in the conversation from the
 *   database (affects both sides — "clear for everyone").
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversation_id")
    const mode = searchParams.get("mode") === "clear" ? "clear" : "delete"

    if (!conversationId) {
      return NextResponse.json({ error: "conversation_id is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Must be an active participant.
    const { data: membership } = await supabase
      .from("conversation_participants")
      .select("id, user_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .is("left_at", null)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (mode === "clear") {
      const { error: clearError } = await supabase.from("messages").delete().eq("conversation_id", conversationId)
      if (clearError) {
        return NextResponse.json({ error: clearError.message || "Failed to clear messages" }, { status: 500 })
      }
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId)
      return NextResponse.json({ success: true, message: "Chat cleared for everyone" })
    }

    // mode=delete: leave the conversation (delete for me).
    const { error: leaveError } = await supabase
      .from("conversation_participants")
      .update({ left_at: new Date().toISOString(), last_read_at: new Date().toISOString() })
      .eq("id", membership.id)

    if (leaveError) {
      return NextResponse.json({ error: leaveError.message || "Failed to delete conversation" }, { status: 500 })
    }

    // 1:1 where the other side already left → hard-delete conversation + messages.
    const { data: activeParticipants } = await supabase
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .is("left_at", null)

    const { data: conversation } = await supabase
      .from("conversations")
      .select("is_group")
      .eq("id", conversationId)
      .maybeSingle()

    if ((activeParticipants || []).length === 0 && conversation && !conversation.is_group) {
      await supabase.from("messages").delete().eq("conversation_id", conversationId)
      await supabase.from("conversation_participants").delete().eq("conversation_id", conversationId)
      await supabase.from("conversations").delete().eq("id", conversationId)
      return NextResponse.json({ success: true, message: "Conversation deleted", hard_deleted: true })
    }

    return NextResponse.json({ success: true, message: "Conversation deleted for you" })
  } catch (error) {
    console.error("Error deleting conversation:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
