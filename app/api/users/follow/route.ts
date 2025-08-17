
import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { target_user_id, action } = await request.json()
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    if (action === 'follow') {
      // Create follow relationship
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: target_user_id,
        })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Update follower/following counts
      await supabase.rpc('update_user_stats_and_check_achievements', {
        target_user_id: target_user_id,
        stat_type: 'follower_gained',
        increment_value: 1
      })

      await supabase.rpc('update_user_stats_and_check_achievements', {
        target_user_id: user.id,
        stat_type: 'following_added',
        increment_value: 1
      })

    } else if (action === 'unfollow') {
      // Remove follow relationship
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', target_user_id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Update follower/following counts
      await supabase.rpc('update_user_stats_and_check_achievements', {
        target_user_id: target_user_id,
        stat_type: 'follower_gained',
        increment_value: -1
      })

      await supabase.rpc('update_user_stats_and_check_achievements', {
        target_user_id: user.id,
        stat_type: 'following_added',
        increment_value: -1
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Follow error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
