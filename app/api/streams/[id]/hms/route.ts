import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { createHmsAppToken, createHmsRoom, hmsConfigured, hmsGuestRole, hmsHostRole, hmsRoomName } from "@/lib/hms"

export const dynamic = "force-dynamic"

/**
 * POST /api/streams/[id]/hms — stream owner: ensure the stream has a 100ms
 * room, then mint a host token (publishes camera + mic).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!hmsConfigured()) {
      return NextResponse.json(
        { error: "Livestreams need 100ms keys. Set HMS_ACCESS_KEY and HMS_SECRET." },
        { status: 503 },
      )
    }

    const { data: stream, error: fetchError } = await supabase
      .from("live_streams")
      .select("id, streamer_id, title, hms_room_id, hms_room_name")
      .eq("id", id)
      .maybeSingle()

    if (fetchError || !stream) return NextResponse.json({ error: "Stream not found" }, { status: 404 })
    if (stream.streamer_id !== user.id) {
      return NextResponse.json({ error: "Only the stream owner can get a host token" }, { status: 403 })
    }

    // Reuse the stream's room if one exists, otherwise create + persist it.
    let roomId = stream.hms_room_id as string | null
    let roomName = stream.hms_room_name as string | null
    if (!roomId) {
      roomName = hmsRoomName("live")
      const room = await createHmsRoom(roomName, stream.title || "Loop livestream")
      roomId = room.id
      await supabase
        .from("live_streams")
        .update({ hms_room_id: roomId, hms_room_name: roomName })
        .eq("id", id)
    }

    const token = createHmsAppToken({ roomId, userId: user.id, role: hmsHostRole() })
    return NextResponse.json({ success: true, data: { token, roomId, role: hmsHostRole() } })
  } catch (error: any) {
    console.error("[streams/hms] host token error:", error)
    return NextResponse.json({ error: error?.message || "Failed to start the 100ms room" }, { status: 500 })
  }
}

/**
 * GET /api/streams/[id]/hms — viewer: mint a guest token so they can watch.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: stream, error } = await supabase
      .from("live_streams")
      .select("id, status, hms_room_id")
      .eq("id", id)
      .maybeSingle()

    if (error || !stream) return NextResponse.json({ error: "Stream not found" }, { status: 404 })
    if (!stream.hms_room_id) {
      return NextResponse.json({ error: "This stream has no 100ms room yet" }, { status: 404 })
    }

    if (!hmsConfigured()) {
      return NextResponse.json({ error: "Calls are not configured yet." }, { status: 503 })
    }

    const token = createHmsAppToken({
      roomId: stream.hms_room_id as string,
      userId: user.id,
      role: hmsGuestRole(),
    })
    return NextResponse.json({
      success: true,
      data: { token, roomId: stream.hms_room_id, role: hmsGuestRole() },
    })
  } catch (error: any) {
    console.error("[streams/hms] viewer token error:", error)
    return NextResponse.json({ error: error?.message || "Failed to join the stream" }, { status: 500 })
  }
}
