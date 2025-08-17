import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'hashtags'
    const limit = parseInt(searchParams.get('limit') || '20')

    switch (type) {
      case 'hashtags':
        // Get trending hashtags from the last 7 days
        const { data: hashtags, error: hashtagError } = await supabase
          .rpc('get_trending_hashtags', { 
            days_back: 7,
            result_limit: limit 
          })

        if (hashtagError) {
          console.error('Error fetching trending hashtags:', hashtagError)
          return NextResponse.json({ error: 'Failed to fetch trending hashtags' }, { status: 500 })
        }

        return NextResponse.json({ data: hashtags })

      case 'users':
        // Get trending users based on recent activity
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select(`
            *,
            follower_count:followers(count),
            loop_count:loops(count)
          `)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (usersError) {
          console.error('Error fetching trending users:', usersError)
          return NextResponse.json({ error: 'Failed to fetch trending users' }, { status: 500 })
        }

        return NextResponse.json({ data: users })

      case 'loops':
        // Get trending loops based on interactions
        const { data: loops, error: loopsError } = await supabase
          .from('loops')
          .select(`
            *,
            user:profiles!inner(*),
            interaction_count:loop_interactions(count),
            comment_count:comments(count)
          `)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (loopsError) {
          console.error('Error fetching trending loops:', loopsError)
          return NextResponse.json({ error: 'Failed to fetch trending loops' }, { status: 500 })
        }

        return NextResponse.json({ data: loops })

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Trending API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { hashtag, loop_id } = body

    if (!hashtag || !loop_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Record hashtag usage
    const { error } = await supabase
      .from('hashtag_usage')
      .insert({
        hashtag: hashtag.toLowerCase(),
        loop_id,
        user_id: user.id
      })

    if (error) {
      console.error('Error recording hashtag usage:', error)
      return NextResponse.json({ error: 'Failed to record hashtag usage' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Hashtag tracking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
