import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get('status') || 'live'
    const category = searchParams.get('category')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = supabase
      .from('live_streams')
      .select(`
        *,
        streamer:profiles!streamer_id (
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          is_premium
        )
      `)
      .eq('status', status)
      .order('viewer_count', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq('category', category)
    }

    const { data: streams, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        streams,
        page,
        limit,
        has_more: streams?.length === limit
      }
    })

  } catch (error) {
    console.error("Get streams error:", error)
    return NextResponse.json({ error: "Failed to fetch streams" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
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

    // Check if user can stream
    const { data: profile } = await supabase
      .from('profiles')
      .select('can_stream, is_premium')
      .eq('id', user.id)
      .single()

    if (!profile?.can_stream) {
      return NextResponse.json({ 
        error: "Streaming not enabled for this account. Please contact support." 
      }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, category, tags, is_premium_only, thumbnail_url } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: "Stream title is required" }, { status: 400 })
    }

    // Generate stream key and URLs
    const streamKey = uuidv4()
    const streamId = uuidv4()
    
    // In production, you would integrate with a streaming service like:
    // - AWS IVS (Interactive Video Service)
    // - Agora
    // - Twilio Video
    // - Custom RTMP server
    const rtmpUrl = `rtmp://your-streaming-server.com/live/${streamKey}`
    const hlsUrl = `https://your-streaming-server.com/hls/${streamKey}/index.m3u8`

    const { data: stream, error } = await supabase
      .from('live_streams')
      .insert({
        id: streamId,
        streamer_id: user.id,
        title: title.trim(),
        description: description?.trim(),
        category: category || 'general',
        tags: tags || [],
        is_premium_only: is_premium_only || false,
        thumbnail_url,
        stream_key: streamKey,
        rtmp_url: rtmpUrl,
        hls_url: hlsUrl,
        status: 'preparing',
        chat_enabled: true,
        gifts_enabled: true
      })
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
      data: { stream }
    })

  } catch (error) {
    console.error("Create stream error:", error)
    return NextResponse.json({ error: "Failed to create stream" }, { status: 500 })
  }
}
