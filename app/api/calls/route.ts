import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { createHmsRoom, createHmsAppToken, hmsHostRole, hmsRoomName } from "@/lib/hms"
import { createLiveKitToken, livekitRoomName } from "@/lib/livekit"
import { getRealtimeProvider, providerLabel, providerNotConfiguredMessage, type RealtimeProvider } from "@/lib/realtime-provider"
import { notifyUser } from "@/lib/notifications"

export const dynamic = "force-dynamic"

type Supabase = ReturnType<typeof createServerClient>

async function isConversationParticipant(supabase: Supabase, conversationId: string, userId: string) {
  const { data } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle()
  return Boolean(data)
}

async function isCircleMember(supabase: Supabase, circleId: string, userId: string) {
  const { data } = await supabase
    .from("circle_members")
    .select("id")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()
  return Boolean(data)
}

/** POST /api/calls — start a voice/video call in a DM or a Circle. */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { conversation_id, circle_id, is_video } = body
    if (!conversation_id && !circle_id) {
      return NextResponse.json({ error: "conversation_id or circle_id is required" }, { status: 400 })
    }

    // Membership checks (server-side, never trust the client).
    if (conversation_id && !(await isConversationParticipant(supabase, conversation_id, user.id))) {
      return NextResponse.json({ error: "You are not part of this conversation" }, { status: 403 })
    }
    if (circle_id && !(await isCircleMember(supabase, circle_id, user.id))) {
      return NextResponse.json({ error: "You are not a member of this circle" }, { status: 403 })
    }

    const provider = getRealtimeProvider()
    if (!provider) {
      return NextResponse.json({ error: providerNotConfiguredMessage() }, { status: 503 })
    }

    // Derive the room type.
    let room_type = "dm_video"
    if (conversation_id) {
      const { data: convo } = await supabase
        .from("conversations")
        .select("is_group")
        .eq("id", conversation_id)
        .maybeSingle()
      if (convo?.is_group) room_type = is_video ? "group_video" : "group_audio"
      else room_type = is_video ? "dm_video" : "dm_audio"
    } else if (circle_id) {
      room_type = is_video ? "circle_video" : "circle_audio"
    }

    // Create the room + session row. 100ms rooms are created via REST;
    // LiveKit rooms are implicit — the room name alone is enough.
    const roomName = provider === "100ms" ? hmsRoomName(circle_id ? "circle" : "call") : livekitRoomName(circle_id ? "circle" : "call")
    let room = { id: roomName, name: roomName }
    if (provider === "100ms") {
      room = await createHmsRoom(roomName, `Loop ${room_type} call`)
    }

    const { data: session, error } = await supabase
      .from("call_sessions")
      .insert({
        room_type,
        provider,
        hms_room_id: room.id,
        hms_room_name: room.name,
        creator_id: user.id,
        conversation_id: conversation_id || null,
        circle_id: circle_id || null,
        status: "ringing",
        is_video: Boolean(is_video),
      })
      .select("*")
      .single()

    if (error) {
      console.error("[calls] insert session failed:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let token: string
    let url: string | null = null
    if (provider === "100ms") {
      token = createHmsAppToken({ roomId: room.id, userId: user.id, role: hmsHostRole() })
    } else {
      const minted = await createLiveKitToken({
        room: room.name,
        identity: user.id,
        name: String((user.user_metadata as any)?.display_name || (user.user_metadata as any)?.username || user.email || user.id),
        canPublish: true,
      })
      token = minted.token
      url = minted.url
    }

    // Notify the other side(s) — best effort, never blocks the response.
    void (async () => {
      try {
        const targetIds: string[] = []
        if (conversation_id) {
          const { data: participants } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", conversation_id)
            .neq("user_id", user.id)
          targetIds.push(...(participants || []).map((p: any) => p.user_id))
        }
        if (circle_id) {
          const { data: members } = await supabase
            .from("circle_members")
            .select("user_id")
            .eq("circle_id", circle_id)
            .eq("status", "active")
            .neq("user_id", user.id)
          targetIds.push(...(members || []).map((m: any) => m.user_id))
        }

        for (const targetId of [...new Set(targetIds)].slice(0, 50)) {
          await notifyUser(supabase, {
            userId: targetId,
            type: "call_incoming",
            title: is_video ? "Incoming video call" : "Incoming voice call",
            message: `@${(user.user_metadata as any)?.username || (user.user_metadata as any)?.display_name || "Someone"} is calling you`,
            actionUrl: conversation_id
              ? `/messages?c=${conversation_id}&call=${session.id}`
              : circle_id
                ? `/circles/${circle_id}?call=${session.id}`
                : undefined,
            data: { call_session_id: session.id, conversation_id, circle_id, is_video },
            pushCategory: "directMessages",
          })
        }
      } catch (err) {
        console.error("[calls] notify failed:", err)
      }
    })()

    return NextResponse.json({
      success: true,
      data: { session, token, room, provider, url },
    })
  } catch (error: any) {
    console.error("[calls] create call error:", error)
    return NextResponse.json({ error: error?.message || "Failed to start the call" }, { status: 500 })
  }
}

/** GET /api/calls — the user's active (ringing/active) call sessions. */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("call_sessions")
      .select("*")
      .in("status", ["ringing", "active"])
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      console.error("[calls] list error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to list calls" }, { status: 500 })
  }
}
