import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { notifyUsers } from "@/lib/notifications"
import { getUserFromRequest } from "@/lib/server-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const streamId = id

    const { data: stream, error } = await supabase
      .from('live_streams')
      .select(`
        *,
        streamer:profiles!streamer_id (
          id,
          username,
          display_name,
          avatar_url, video_avatar_url,
          is_verified,
          is_premium,
          followers_count
        )
      `)
      .eq('id', streamId)
      .single()

    if (error || !stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { stream }
    })

  } catch (error) {
    console.error("Get stream error:", error)
    return NextResponse.json({ error: "Failed to fetch stream" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const streamId = id
    
    // Get user from session

    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    // Check if user owns this stream
    const { data: stream } = await supabase
      .from('live_streams')
      .select('streamer_id, started_at, stream_type')
      .eq('id', streamId)
      .single()

    if (!stream || stream.streamer_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, status, category, tags, chat_enabled, gifts_enabled } = body
    if (status === "live" && stream.stream_type !== "audio") {
      return NextResponse.json({ error: "Only audio rooms are supported now." }, { status: 400 })
    }

    const updates: any = {}
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    const isGoingLive = status === 'live' && !stream.started_at
    if (status !== undefined) {
      updates.status = status
      if (isGoingLive) {
        updates.started_at = new Date().toISOString()
      } else if (status === 'ended') {
        updates.ended_at = new Date().toISOString()
      }
    }
    if (category !== undefined) updates.category = category
    if (tags !== undefined) updates.tags = tags
    if (chat_enabled !== undefined) updates.chat_enabled = chat_enabled
    if (gifts_enabled !== undefined) updates.gifts_enabled = gifts_enabled

    const { data: updatedStream, error } = await supabase
      .from('live_streams')
      .update(updates)
      .eq('id', streamId)
      .select(`
        *,
        streamer:profiles!streamer_id (
          id,
          username,
          display_name,
          avatar_url, video_avatar_url,
          is_verified
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notify followers that this creator just went live (best-effort, never
    // blocks the response).
    if (isGoingLive) {
      void (async () => {
        try {
          const { data: followers } = await supabase
            .from('follows')
            .select('follower_id')
            .eq('following_id', user.id)
          const followerIds = (followers || []).map((f: any) => f.follower_id).filter(Boolean)
          if (followerIds.length) {
            const streamerName = updatedStream?.streamer?.display_name || updatedStream?.streamer?.username || 'Someone you follow'
            await notifyUsers(supabase, followerIds, {
              type: 'creator_live',
              title: `${streamerName} is live!`,
              message: updatedStream?.title || 'Tap to join the stream now.',
              actionUrl: `/streams/${streamId}`,
              pushCategory: 'liveStreams',
              data: { stream_id: streamId },
            })
          }
        } catch (notifyErr) {
          console.error('Follower live notification failed:', notifyErr)
        }
      })()
    }

    return NextResponse.json({
      success: true,
      data: { stream: updatedStream }
    })

  } catch (error) {
    console.error("Update stream error:", error)
    return NextResponse.json({ error: "Failed to update stream" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()
    const streamId = id
    
    // Get user from session

    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    // Check if user owns this stream
    const { data: stream } = await supabase
      .from('live_streams')
      .select('streamer_id')
      .eq('id', streamId)
      .single()

    if (!stream || stream.streamer_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // End the stream instead of deleting
    const { error } = await supabase
      .from('live_streams')
      .update({ 
        status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('id', streamId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Stream ended successfully"
    })

  } catch (error) {
    console.error("Delete stream error:", error)
    return NextResponse.json({ error: "Failed to end stream" }, { status: 500 })
  }
}
