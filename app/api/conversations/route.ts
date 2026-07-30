import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

async function getUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
  if (!token) return null
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser(token)
  return user || null
}

async function canMessage(supabase: ReturnType<typeof createServerClient>, fromId: string, toId: string) {
  // Allow if either user follows the other (or mutual). Anyone can open chat if at least one follow exists.
  const { data: a } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", fromId)
    .eq("following_id", toId)
    .maybeSingle()
  if (a) return true

  const { data: b } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", toId)
    .eq("following_id", fromId)
    .maybeSingle()
  return Boolean(b)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: memberships, error: membershipError } = await supabase
      .from("conversation_participants")
      .select("conversation_id, role, joined_at")
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
          id, username, display_name, avatar_url, is_verified
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

    const enriched = (conversations || []).map((conversation) => {
      const people = (participants || []).filter((p) => p.conversation_id === conversation.id)
      const other = people.find((p) => p.user_id !== user.id)?.user || null
      return {
        ...conversation,
        participants: people,
        other_user: other,
        last_message: lastByConversation.get(conversation.id) || null,
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
      const allowed = await canMessage(supabase, user.id, recipientId)
      if (!allowed) {
        // Soft allow: still permit starting chat with any existing user (per product request),
        // but prefer follow relationship when present.
        const { data: recipient } = await supabase.from("profiles").select("id").eq("id", recipientId).maybeSingle()
        if (!recipient) {
          return NextResponse.json({ error: "User not found" }, { status: 404 })
        }
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
