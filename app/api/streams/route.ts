import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";
import { generateSnowflakeIdString } from "@/lib/snowflake-id"

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
          avatar_url, video_avatar_url,
          is_verified,
          is_premium
        )
      `)

    if (status === "live") {
      query = query.eq("status", "live").order("viewer_count", { ascending: false })
    } else if (status === "popular") {
      query = query.in("status", ["live", "ended", "paused"]).order("max_viewers", { ascending: false })
    } else {
      // recent
      query = query.in("status", ["live", "ended", "paused", "preparing"]).order("created_at", { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    query = query.eq("stream_type", "audio")

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

    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    // Allow any signed-in user to create a stream (premium still gets priority features later)
    const { data: profile } = await supabase
      .from('profiles')
      .select('can_stream, is_premium, is_admin')
      .eq('id', user.id)
      .single()

    if (profile && profile.can_stream === false && !profile.is_premium && !profile.is_admin) {
      // Only block when explicitly disabled
      return NextResponse.json({ 
        error: "Streaming is disabled for this account. Please contact support." 
      }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, category, tags, is_premium_only, thumbnail_url } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: "Stream title is required" }, { status: 400 })
    }

    // Live is real browser WebRTC over Supabase Realtime signaling on
    // /streams/[id] — camera/screen-share, no RTMP/HLS ingest exists yet.
    // Only set rtmp_url/hls_url when a real ingest server is actually
    // configured; never store fabricated placeholder URLs that look like
    // working OBS/HLS endpoints but go nowhere.
    const streamKey = crypto.randomUUID()
    const rtmpUrl = process.env.RTMP_SERVER_URL ? `${process.env.RTMP_SERVER_URL.replace(/\/$/, "")}/${streamKey}` : null
    const hlsUrl = process.env.HLS_SERVER_URL
      ? `${process.env.HLS_SERVER_URL.replace(/\/$/, "")}/${streamKey}/index.m3u8`
      : null
    const payload = {
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
      stream_type: 'audio',
      chat_enabled: true,
      gifts_enabled: true,
    }
    let streamId = generateSnowflakeIdString()
    const selectStream = () => supabase
      .from('live_streams')
      .insert({ id: streamId, ...payload })
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

    let { data: stream, error } = await selectStream()

    // Older installations still use UUID primary keys. Retry with their native
    // ID format only when Postgres specifically rejects the bigint Snowflake.
    if (error && /invalid input syntax for type uuid/i.test(error.message || "")) {
      streamId = crypto.randomUUID()
      const legacy = await supabase
        .from('live_streams')
        .insert({ id: streamId, ...payload })
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
      stream = legacy.data
      error = legacy.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      // Keep 64-bit Snowflake IDs as strings; JSON numbers lose precision above 2^53.
      data: { stream: { ...stream, id: streamId } }
    })

  } catch (error) {
    console.error("Create stream error:", error)
    return NextResponse.json({ error: "Failed to create stream" }, { status: 500 })
  }
}
