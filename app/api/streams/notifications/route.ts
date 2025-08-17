import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { streamId, action } = await request.json() // action: 'start' or 'end'
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get stream details
    const { data: stream, error: streamError } = await supabase
      .from('live_streams')
      .select(`
        *,
        streamer:profiles!live_streams_streamer_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('id', streamId)
      .eq('streamer_id', user.id)
      .single()

    if (streamError || !stream) {
      return NextResponse.json({ error: 'Stream not found or access denied' }, { status: 404 })
    }

    if (action === 'start') {
      // Update stream status to live
      await supabase
        .from('live_streams')
        .update({ 
          is_live: true,
          started_at: new Date().toISOString()
        })
        .eq('id', streamId)

      // Get all followers of the streamer
      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id)

      if (followers && followers.length > 0) {
        // Create notifications for all followers
        const notifications = followers.map(follow => ({
          user_id: follow.follower_id,
          type: 'live_stream_started',
          title: `${stream.streamer.display_name} is now live!`,
          message: `${stream.streamer.display_name} started streaming: ${stream.title}`,
          data: {
            stream_id: streamId,
            streamer_id: user.id,
            streamer_username: stream.streamer.username,
            stream_title: stream.title,
            stream_category: stream.category
          },
          action_url: `/streams/${streamId}`
        }))

        await supabase
          .from('notifications')
          .insert(notifications)

        // Send real-time notifications (if using Supabase realtime)
        const channel = supabase.channel('live_notifications')
        followers.forEach(follow => {
          channel.send({
            type: 'broadcast',
            event: 'live_stream_started',
            payload: {
              user_id: follow.follower_id,
              stream_id: streamId,
              streamer: stream.streamer,
              stream_title: stream.title
            }
          })
        })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Stream started and notifications sent',
        notified_followers: followers?.length || 0
      })

    } else if (action === 'end') {
      // Update stream status
      await supabase
        .from('live_streams')
        .update({ 
          is_live: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', streamId)

      return NextResponse.json({ 
        success: true, 
        message: 'Stream ended'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error handling stream notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get live streams from users the current user follows
    const { data: liveStreams, error } = await supabase
      .from('live_streams')
      .select(`
        *,
        streamer:profiles!live_streams_streamer_id_fkey(
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .eq('is_live', true)
      .in('streamer_id', 
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
      )
      .order('started_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      live_streams: liveStreams || [],
      count: liveStreams?.length || 0
    })
  } catch (error) {
    console.error('Error fetching live streams:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
