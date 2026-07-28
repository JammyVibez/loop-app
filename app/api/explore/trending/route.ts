import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
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
          // Fallback when RPC is missing: derive from loops.hashtags
          const { data: loops } = await supabase
            .from('loops')
            .select('hashtags')
            .not('hashtags', 'is', null)
            .order('created_at', { ascending: false })
            .limit(100)

          const counts = new Map<string, number>()
          for (const loop of loops || []) {
            for (const tag of loop.hashtags || []) {
              const key = String(tag).toLowerCase()
              counts.set(key, (counts.get(key) || 0) + 1)
            }
          }
          const hashtags = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([tag, usage_count]) => ({ tag, usage_count }))

          return NextResponse.json({ data: hashtags, hashtags })
        }

        return NextResponse.json({ data: hashtags, hashtags })

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
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
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
