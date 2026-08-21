import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder")

async function getUserFromToken(token: string) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

// Get room messages
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string, roomId: string }> }) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const before = searchParams.get("before") // cursor for pagination
    const threadOf = searchParams.get("thread_of") // show only replies to this message

    const { id: circleId, roomId } = await params

    // Check if room exists and user has access
    const { data: room } = await supabase
      .from("circle_rooms")
      .select("id, is_private")
      .eq("id", roomId)
      .eq("circle_id", circleId)
      .single()

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Check if user is a member of the circle
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { data: member } = await supabase
      .from("circle_members")
      .select("id, role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("status", ["active", "approved"])
      .single()

    if (!member) {
      return NextResponse.json({ error: "You must be a member to view messages" }, { status: 403 })
    }

    // Private channels ("for community subscribers") are only visible to
    // members an admin explicitly granted access to, not every circle member.
    if (room.is_private && !["owner", "admin", "moderator"].includes(member.role)) {
      const { data: grant } = await supabase
        .from("circle_room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!grant) {
        return NextResponse.json({ error: "You don't have access to this private channel" }, { status: 403 })
      }
    }

    let query = supabase
      .from("circle_room_messages")
      .select("*, author:profiles!inner(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium)")
      .eq("room_id", roomId)
      .neq("moderation_status", "removed") // moderation bot soft-deletes violations
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (threadOf) {
      // Thread view: only the replies to the given parent message.
      query = query.eq("reply_to_id", threadOf)
    } else if (before) {
      query = query.lt("created_at", before)
    }

    const { data: messages, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    // Reverse messages to show oldest first
    const sortedMessages = messages?.reverse() || []
    const messageIds = sortedMessages.map((m: any) => m.id).filter(Boolean)

    let reactionRows: any[] = []
    if (messageIds.length > 0) {
      const { data: reactions } = await supabase
        .from("circle_room_message_reactions")
        .select("message_id, user_id, reaction_type")
        .in("message_id", messageIds)
      reactionRows = reactions || []
    }

    // Reply counts — every message reports how many replies it has so the UI
    // can show the Slack-style thread badge without an extra round trip.
    let replyCounts: Record<string, number> = {}
    if (!threadOf) {
      const { data: replyRows } = await supabase
        .from("circle_room_messages")
        .select("reply_to_id")
        .eq("room_id", roomId)
        .not("reply_to_id", "is", null)
      replyCounts = (replyRows || []).reduce<Record<string, number>>((acc, row) => {
        const parentId = row.reply_to_id as string
        acc[parentId] = Number(acc[parentId] || 0) + 1
        return acc
      }, {})
    }

    // Polls — attach the poll payload (plus the viewer's own vote) to its
    // message row so poll cards render inline in the feed.
    let pollsById: Record<string, any> = {}
    if (messageIds.length > 0) {
      const { data: pollRows } = await supabase
        .from("circle_room_polls")
        .select("*")
        .in("message_id", messageIds)
      const pollIds = (pollRows || []).map((p: any) => p.id)
      let myVotes: Record<string, string> = {}
      if (pollIds.length > 0) {
        const { data: voteRows } = await supabase
          .from("circle_room_poll_votes")
          .select("poll_id, option_id")
          .in("poll_id", pollIds)
          .eq("user_id", user.id)
        for (const v of voteRows || []) {
          if (v.poll_id) myVotes[v.poll_id] = v.option_id
        }
      }
      for (const poll of pollRows || []) {
        if (poll.message_id) pollsById[poll.message_id] = { ...poll, user_vote: myVotes[poll.id] || null }
      }
    }

    const enriched = sortedMessages.map((message: any) => {
      const rows = reactionRows.filter((r) => r.message_id === message.id)
      const reactions: Record<string, number> = {}
      const my_reactions: string[] = []
      for (const row of rows) {
        reactions[row.reaction_type] = Number(reactions[row.reaction_type] || 0) + 1
        if (row.user_id === user.id) my_reactions.push(row.reaction_type)
      }
      return {
        ...message,
        reactions,
        my_reactions,
        reply_count: Number(replyCounts[message.id] || 0),
        poll: pollsById[message.id] || null,
      }
    })

    return NextResponse.json({
      success: true,
      messages: enriched,
      hasMore: messages?.length === limit,
      thread_total: threadOf ? enriched.length : undefined,
    })
  } catch (error) {
    console.error("Error fetching room messages:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Send a message
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string, roomId: string }> }) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { id: circleId, roomId } = await params
    const { content, media_url, media_type, reply_to_id } = await request.json()

    // Check if room exists
    const { data: room } = await supabase
      .from("circle_rooms")
      .select("id, is_private, type")
      .eq("id", roomId)
      .eq("circle_id", circleId)
      .single()

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Check if user is a member of the circle
    const { data: member } = await supabase
      .from("circle_members")
      .select("id, role, permissions")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("status", ["active", "approved"])
      .single()

    if (!member) {
      return NextResponse.json({ error: "You must be a member to send messages" }, { status: 403 })
    }

    const isCircleAdmin = ["owner", "admin", "moderator"].includes(member.role)

    // Announcement channels: everyone can read, only admins/moderators (or
    // a member explicitly granted can_post_announcements) can post.
    if (room.type === "announcement" && !isCircleAdmin && !member.permissions?.can_post_announcements) {
      return NextResponse.json({ error: "Only circle admins can post in an announcement channel" }, { status: 403 })
    }

    // Private channels: posting requires the same explicit grant as reading.
    if (room.is_private && !isCircleAdmin) {
      const { data: grant } = await supabase
        .from("circle_room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!grant) {
        return NextResponse.json({ error: "You don't have access to this private channel" }, { status: 403 })
      }
    }

    // Validate content
    if (!content?.trim() && !media_url) {
      return NextResponse.json({ error: "Content or media is required" }, { status: 400 })
    }

    let replyToId: string | null = null
    if (reply_to_id) {
      const { data: parent } = await supabase
        .from("circle_room_messages")
        .select("id")
        .eq("id", reply_to_id)
        .eq("room_id", roomId)
        .maybeSingle()
      if (parent?.id) replyToId = parent.id
    }

    // Create message
    const { data: message, error: insertError } = await supabase
      .from("circle_room_messages")
      .insert({
        room_id: roomId,
        author_id: user.id,
        content: content?.trim() || "",
        media_url,
        media_type,
        reply_to_id: replyToId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("*, author:profiles!inner(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium)")
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    const text = String(content || "").trim()
    if (text) {
      try {
        const { processMentions, extractMentions } = await import("@/lib/mentions")
        if (extractMentions(text).length) {
          const author = Array.isArray(message.author) ? message.author[0] : message.author
          await processMentions(supabase, text, {
            source: "circle_room",
            circle_id: circleId,
            room_id: roomId,
            actor_id: user.id,
            actor_username: author?.username,
            actor_display_name: author?.display_name,
          })
        }
      } catch (err) {
        console.error("circle room mentions:", err)
      }
    }

    // Moderation bot — scans every message and removes/flags rule violations.
    if (text) {
      try {
        const { runModerationBot } = await import("@/lib/circle-bots")
        await runModerationBot(supabase, circleId, roomId, {
          id: message.id,
          content: text,
          author_id: user.id,
        })
      } catch (err) {
        console.error("moderation bot:", err)
      }
    }

    return NextResponse.json({
      success: true,
      data: message,
      info: "Message sent successfully"
    })
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update a message
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string, roomId: string }> }) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { id: circleId, roomId } = await params
    const { messageId, content, media_url, media_type } = await request.json()

    // Check if message exists and user is the author
    const { data: message } = await supabase
      .from("circle_room_messages")
      .select("author_id")
      .eq("id", messageId)
      .eq("room_id", roomId)
      .single()

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    if (message.author_id !== user.id) {
      return NextResponse.json({ error: "You can only edit your own messages" }, { status: 403 })
    }

    // Update message
    const { data: updatedMessage, error: updateError } = await supabase
      .from("circle_room_messages")
      .update({
        content: content?.trim() || "",
        media_url,
        media_type,
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId)
      .select("*, author:profiles!inner(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium)")
      .single()

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update message" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: updatedMessage,
      info: "Message updated successfully"
    })
  } catch (error) {
    console.error("Error updating message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Delete a message
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string, roomId: string }> }) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { id: circleId, roomId } = await params
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")

    if (!messageId) {
      return NextResponse.json({ error: "Message ID is required" }, { status: 400 })
    }

    // Check if message exists and user is the author or has admin permissions
    const { data: message } = await supabase
      .from("circle_room_messages")
      .select("author_id")
      .eq("id", messageId)
      .eq("room_id", roomId)
      .single()

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Check if user is author or has admin/moderator permissions
    let hasPermission = message.author_id === user.id
    
    if (!hasPermission) {
      const { data: member } = await supabase
        .from("circle_members")
        .select("role")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .in("role", ["admin", "moderator"])
        .single()
      
      hasPermission = !!member
    }

    if (!hasPermission) {
      return NextResponse.json({ error: "You can only delete your own messages or messages in circles where you have moderator permissions" }, { status: 403 })
    }

    // Delete message
    const { error: deleteError } = await supabase
      .from("circle_room_messages")
      .delete()
      .eq("id", messageId)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      info: "Message deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
