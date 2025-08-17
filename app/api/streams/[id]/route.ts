import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const streamId = params.id

    const { data: stream, error } = await supabase
      .from('live_streams')
      .select(`
        *,
        streamer:profiles!streamer_id (
          id,
          username,
          display_name,
          avatar_url,
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
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const streamId = params.id
    
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    // Check if user owns this stream
    const { data: stream } = await supabase
      .from('live_streams')
      .select('streamer_id, started_at')
      .eq('id', streamId)
      .single()

    if (!stream || stream.streamer_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, status, category, tags, chat_enabled, gifts_enabled } = body

    const updates: any = {}
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (status !== undefined) {
      updates.status = status
      if (status === 'live' && !stream.started_at) {
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
          avatar_url,
          is_verified
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
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
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const streamId = params.id
    
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
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
