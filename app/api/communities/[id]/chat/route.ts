import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * Community Space Chat API
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

    const query = supabase
      .from("messages")
      .select(`
        id,
        content,
        media_url,
        media_type,
        message_type,
        sender_id,
        author_id,
        circle_id,
        reply_to_id,
        reactions,
        is_edited,
        edited_at,
        is_deleted,
        created_at,
        sender:profiles!messages_sender_id_fkey(
          id, username, display_name, avatar_url, is_verified, is_premium
        )
      `)
      .eq("circle_id", communityId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1)

    // Filter by space if provided (using metadata JSONB)
    if (spaceId) {
      query.contains("content_metadata", JSON.stringify({ space_id: spaceId }))
    }

    const { data: messages, error } = await query

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

    const contentMetadata: Record<string, any> = {}
    if (spaceId) contentMetadata.space_id = spaceId

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        author_id: user.id,
        circle_id: communityId,
        content: content || null,
        media_url: mediaUrl,
        media_type: mediaType,
        message_type: mediaUrl ? (mediaType === "image" ? "image" : mediaType === "video" ? "image" : "file") : "text",
        reply_to_id: replyToId,
        content_metadata: Object.keys(contentMetadata).length > 0 ? contentMetadata : null,
      })
      .select(`
        id,
        content,
        media_url,
        media_type,
        message_type,
        sender_id,
        author_id,
        circle_id,
        reply_to_id,
        reactions,
        is_edited,
        edited_at,
        is_deleted,
        created_at,
        sender:profiles!messages_sender_id_fkey(
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
