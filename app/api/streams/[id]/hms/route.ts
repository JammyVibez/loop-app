import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { createHmsAppToken, createHmsRoom, hmsGuestRole, hmsHostRole, hmsRoomName } from "@/lib/hms"
import { createLiveKitToken, livekitRoomName } from "@/lib/livekit"
import { getRealtimeProvider, providerLabel, providerNotConfiguredMessage, type RealtimeProvider } from "@/lib/realtime-provider"

export const dynamic = "force-dynamic"

/**
 * POST /api/streams/[id]/hms — stream owner: ensure the stream has a media
 * room (100ms via REST, LiveKit implicit), then mint a host token.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let provider: RealtimeProvider | null = null
  try {
    const { id } = await params
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    provider = getRealtimeProvider()
    if (!provider) {
      return NextResponse.json({ error: providerNotConfiguredMessage() }, { status: 503 })
    }

    const { data: stream, error: fetchError } = await supabase
      .from("live_streams")
      .select("id, streamer_id, title, stream_type, hms_room_id, hms_room_name")
      .eq("id", id)
      .maybeSingle()

    if (fetchError || !stream) return NextResponse.json({ error: "Stream not found" }, { status: 404 })
    if (stream.stream_type !== "audio") {
      return NextResponse.json({ error: "Only audio rooms are supported." }, { status: 404 })
    }
    if (stream.streamer_id !== user.id) {
      return NextResponse.json({ error: "Only the audio room host can get a host token" }, { status: 403 })
    }

    // Reuse the stream's room if one exists, otherwise create + persist it.
    let roomId = stream.hms_room_id as string | null
    let roomName = stream.hms_room_name as string | null
    if (!roomId) {
      roomName = provider === "100ms" ? hmsRoomName(`audio-${id}`) : livekitRoomName(`audio-${id}`)
      if (provider === "100ms") {
        const room = await createHmsRoom(roomName, stream.title || "Loop livestream")
        roomId = room.id
      } else {
        roomId = roomName
      }
      await supabase
        .from("live_streams")
        .update({ hms_room_id: roomId, hms_room_name: roomName, provider })
        .eq("id", id)
    }

    if (provider === "100ms") {
      const token = createHmsAppToken({ roomId: roomId!, userId: user.id, role: hmsHostRole() })
      return NextResponse.json({ success: true, data: { token, roomId, role: hmsHostRole(), provider } })
    }

    const minted = await createLiveKitToken({
      room: roomName!,
      identity: user.id,
      name: String((user.user_metadata as any)?.display_name || (user.user_metadata as any)?.username || user.email || user.id),
      canPublish: true,
    })
    return NextResponse.json({
      success: true,
      data: { token: minted.token, roomId, roomName, role: "host", provider, url: minted.url },
    })
  } catch (error: any) {
    console.error("[streams/hms] host token error:", error)
    return NextResponse.json(
      { error: error?.message || `Failed to start the ${provider ? providerLabel(provider) : "media"} room` },
      { status: 500 },
    )
  }
}

/**
 * GET /api/streams/[id]/hms — viewer: mint a guest token so they can watch.
 * LiveKit viewers get a subscribe-only token (canPublish: false).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: stream, error } = await supabase
      .from("live_streams")
      .select("id, status, stream_type, hms_room_id, hms_room_name, provider")
      .eq("id", id)
      .maybeSingle()

    if (error || !stream) return NextResponse.json({ error: "Stream not found" }, { status: 404 })
    if (stream.stream_type !== "audio") {
      return NextResponse.json({ error: "Only audio rooms are available." }, { status: 404 })
    }
    if (!stream.hms_room_id) {
      return NextResponse.json({ error: "This audio room has no media room yet" }, { status: 404 })
    }

    const provider: RealtimeProvider | null = (stream?.provider as RealtimeProvider) || getRealtimeProvider()
    if (!provider) {
      return NextResponse.json({ error: providerNotConfiguredMessage() }, { status: 503 })
    }

    if (provider === "100ms") {
      const token = createHmsAppToken({
        roomId: stream.hms_room_id as string,
        userId: user.id,
        role: hmsGuestRole(),
      })
      return NextResponse.json({
        success: true,
        data: { token, roomId: stream.hms_room_id, role: hmsGuestRole(), provider },
      })
    }

    const minted = await createLiveKitToken({
      room: (stream.hms_room_name as string) || (stream.hms_room_id as string),
      identity: user.id,
      name: String((user.user_metadata as any)?.display_name || (user.user_metadata as any)?.username || user.email || user.id),
      canPublish: false,
    })
    return NextResponse.json({
      success: true,
      data: { token: minted.token, roomId: stream.hms_room_id, roomName: stream.hms_room_name, role: "guest", provider, url: minted.url },
    })
  } catch (error: any) {
    console.error("[streams/hms] viewer token error:", error)
    return NextResponse.json({ error: error?.message || "Failed to join the stream" }, { status: 500 })
  }
}
