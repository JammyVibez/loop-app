
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { interaction_type } = await request.json()
    const loopId = params.id

    if (!['like', 'save', 'share', 'view'].includes(interaction_type)) {
      return NextResponse.json({ error: "Invalid interaction type" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Check if interaction already exists
    const { data: existingInteraction } = await supabase
      .from('loop_interactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('loop_id', loopId)
      .eq('interaction_type', interaction_type)
      .single()

    let isLiked = false
    let isSaved = false

    if (existingInteraction) {
      // Remove interaction (unlike/unsave)
      await supabase
        .from('loop_interactions')
        .delete()
        .eq('id', existingInteraction.id)

      // Update stats
      if (interaction_type === 'like') {
        await supabase.rpc('decrement_loop_likes', { loop_id: loopId })
      } else if (interaction_type === 'save') {
        // No decrement for saves
      }
    } else {
      // Add interaction
      await supabase
        .from('loop_interactions')
        .insert({
          user_id: user.id,
          loop_id: loopId,
          interaction_type
        })

      // Update stats
      if (interaction_type === 'like') {
        await supabase.rpc('increment_loop_likes', { loop_id: loopId })
        isLiked = true
      } else if (interaction_type === 'save') {
        isSaved = true
      } else if (interaction_type === 'share') {
        await supabase.rpc('increment_loop_shares', { loop_id: loopId })
      } else if (interaction_type === 'view') {
        await supabase.rpc('increment_loop_views', { loop_id: loopId })
      }

      // Create notification for loop author (except for views)
      if (interaction_type !== 'view') {
        const { data: loop } = await supabase
          .from('loops')
          .select('author_id')
          .eq('id', loopId)
          .single()

        if (loop && loop.author_id !== user.id) {
          await supabase
            .from('notifications')
            .insert({
              user_id: loop.author_id,
              type: interaction_type,
              title: `${user.user_metadata?.display_name || user.email} ${interaction_type}d your loop`,
              message: `Your loop received a new ${interaction_type}`,
              data: {
                loop_id: loopId,
                user_id: user.id,
                interaction_type
              }
            })
        }
      }
    }

    // Get updated stats
    const { data: stats } = await supabase
      .from('loop_stats')
      .select('*')
      .eq('loop_id', loopId)
      .single()

    // Broadcast real-time update
    await supabase.channel(`loop:${loopId}`)
      .send({
        type: 'broadcast',
        event: 'loop_interaction',
        payload: {
          loop_id: loopId,
          user_id: user.id,
          interaction_type,
          is_liked: isLiked,
          is_saved: isSaved,
          stats
        }
      })

    return NextResponse.json({
      success: true,
      interaction_type,
      is_active: existingInteraction ? false : true,
      stats
    })

  } catch (error: any) {
    console.error("Interaction error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    const loopId = params.id
    const supabase = createServerClient()

    // Get loop stats
    const { data: stats } = await supabase
      .from('loop_stats')
      .select('*')
      .eq('loop_id', loopId)
      .single()

    let userInteractions = {}
    if (user) {
      // Get user's interactions with this loop
      const { data: interactions } = await supabase
        .from('loop_interactions')
        .select('interaction_type')
        .eq('user_id', user.id)
        .eq('loop_id', loopId)

      userInteractions = {
        is_liked: interactions?.some(i => i.interaction_type === 'like') || false,
        is_saved: interactions?.some(i => i.interaction_type === 'save') || false,
        has_viewed: interactions?.some(i => i.interaction_type === 'view') || false,
        has_shared: interactions?.some(i => i.interaction_type === 'share') || false,
      }
    }

    return NextResponse.json({
      success: true,
      stats: stats || {
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        views_count: 0,
        branches_count: 0
      },
      user_interactions: userInteractions
    })

  } catch (error: any) {
    console.error("Get interactions error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
