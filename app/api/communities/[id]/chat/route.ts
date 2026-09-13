import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * Community Space Chat API
 *
 * Uses circle_room_messages (the actual community chat table)
 * linked via circle_rooms (room_id → circle_rooms.id → circle_id → community)
 *
 * GET  ?limit=80&offset=0&space_id=...  — fetch messages for this community
 * POST { content, space_id?, reply_to_id?, media_url?, media_type? }  — send a message
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: communityId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    // Verify membership
    const { data: membership } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", communityId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: "You must be a member to view chat" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit") || "80"), 200)
    const offset = Number(searchParams.get("offset") || "0")
    const spaceId = searchParams.get("space_id")

    // If space_id is provided, find the room_id for that space
    let roomIds: number[] | null = null
    if (spaceId) {
      const { data: room } = await supabase
        .from("circle_rooms")
        .select("id")
        .eq("circle_id", communityId)
        .eq("id", spaceId)
        .maybeSingle()
      if (room) roomIds = [room.id]
    } else {
      // Get all rooms for this community
      const { data: rooms } = await supabase
        .from("circle_rooms")
        .select("id")
        .eq("circle_id", communityId)
      if (rooms) roomIds = rooms.map((r: any) => r.id)
    }

    if (!roomIds || roomIds.length === 0) {
      return NextResponse.json({ success: true, messages: [] })
    }

    const { data: messages, error } = await supabase
      .from("circle_room_messages")
      .select(`
        id,
        content,
        media_url,
        media_type,
        room_id,
        author_id,
        reply_to_id,
        reactions,
        is_edited,
        is_bot,
        bot_name,
        created_at,
        author:profiles!circle_room_messages_author_id_fkey(
          id, username, display_name, avatar_url, is_verified, is_premium
        )
      `)
      .in("room_id", roomIds)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Community chat fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, messages: messages || [] })
  } catch (error: any) {
    console.error("Community chat GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: communityId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    // Verify membership
    const { data: membership } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", communityId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: "You must be a member to chat" }, { status: 403 })
    }

    // Check if user is muted
    const { data: memberData } = await supabase
      .from("circle_members")
      .select("is_muted, muted_until")
      .eq("circle_id", communityId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memberData?.is_muted) {
      if (!memberData.muted_until || new Date(memberData.muted_until) > new Date()) {
        return NextResponse.json({ error: "You are muted in this community" }, { status: 403 })
      }
    }

    const body = await request.json()
    const content = String(body.content || "").trim()
    const spaceId = body.space_id || null
    const replyToId = body.reply_to_id || null
    const mediaUrl = body.media_url || null
    const mediaType = body.media_type || null

    if (!content && !mediaUrl) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 })
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: "Message is too long (max 5000 characters)" }, { status: 400 })
    }

    // Resolve room_id from space_id (or use the default "general" room)
    let roomId: number | null = null
    if (spaceId) {
      const { data: room } = await supabase
        .from("circle_rooms")
        .select("id")
        .eq("circle_id", communityId)
        .eq("id", spaceId)
        .maybeSingle()
      if (room) roomId = room.id
    }
    if (!roomId) {
      const { data: defaultRoom } = await supabase
        .from("circle_rooms")
        .select("id")
        .eq("circle_id", communityId)
        .eq("name", "general")
        .maybeSingle()
      if (defaultRoom) roomId = defaultRoom.id
    }
    if (!roomId) {
      // Create a default general room if none exists
      const { data: newRoom } = await supabase
        .from("circle_rooms")
        .insert({
          circle_id: communityId,
          name: "general",
          type: "chat",
          created_by: user.id,
        })
        .select("id")
        .single()
      if (newRoom) roomId = newRoom.id
    }

    if (!roomId) {
      return NextResponse.json({ error: "Could not find or create a chat room" }, { status: 500 })
    }

    const { data: message, error } = await supabase
      .from("circle_room_messages")
      .insert({
        room_id: roomId,
        author_id: user.id,
        content: content || null,
        media_url: mediaUrl,
        media_type: mediaType,
        reply_to_id: replyToId,
      })
      .select(`
        id,
        content,
        media_url,
        media_type,
        room_id,
        author_id,
        reply_to_id,
        reactions,
        is_edited,
        is_bot,
        bot_name,
        created_at,
        author:profiles!circle_room_messages_author_id_fkey(
          id, username, display_name, avatar_url, is_verified, is_premium
        )
      `)
      .single()

    if (error) {
      console.error("Community chat send error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message })
  } catch (error: any) {
    console.error("Community chat POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
