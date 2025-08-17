import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const reelId = params.id
    
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

    const body = await request.json()
    const { type, action } = body

    if (!type || !['like', 'save', 'share', 'view'].includes(type)) {
      return NextResponse.json({ error: "Invalid interaction type" }, { status: 400 })
    }

    if (!action || !['add', 'remove'].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Check if reel exists
    const { data: reel } = await supabase
      .from('reels')
      .select('id, author_id')
      .eq('id', reelId)
      .single()

    if (!reel) {
      return NextResponse.json({ error: "Reel not found" }, { status: 404 })
    }

    if (action === 'add') {
      // Check if interaction already exists
      const { data: existingInteraction } = await supabase
        .from('reel_interactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('reel_id', reelId)
        .eq('interaction_type', type)
        .single()

      if (existingInteraction) {
        return NextResponse.json({ 
          success: true, 
          message: "Interaction already exists" 
        })
      }

      // Add interaction
      const { error: insertError } = await supabase
        .from('reel_interactions')
        .insert({
          user_id: user.id,
          reel_id: reelId,
          interaction_type: type
        })

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      // Update reel counts
      const updateField = `${type}_count`
      await supabase.rpc('increment_reel_interaction', {
        reel_id: reelId,
        interaction_type: type
      })

      // Create notification for reel author (except for views)
      if (type !== 'view' && reel.author_id !== user.id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: reel.author_id,
            type: type,
            title: `New ${type}`,
            message: `Someone ${type}d your reel`,
            data: {
              reel_id: reelId,
              user_id: user.id
            }
          })
      }

    } else {
      // Remove interaction
      const { error: deleteError } = await supabase
        .from('reel_interactions')
        .delete()
        .eq('user_id', user.id)
        .eq('reel_id', reelId)
        .eq('interaction_type', type)

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }

      // Update reel counts
      await supabase.rpc('decrement_reel_interaction', {
        reel_id: reelId,
        interaction_type: type
      })
    }

    // Get updated counts
    const { data: updatedReel } = await supabase
      .from('reels')
      .select('like_count, view_count, share_count')
      .eq('id', reelId)
      .single()

    return NextResponse.json({
      success: true,
      data: {
        interaction_type: type,
        action,
        counts: updatedReel
      }
    })

  } catch (error) {
    console.error("Reel interaction error:", error)
    return NextResponse.json({ error: "Failed to process interaction" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const reelId = params.id
    const { searchParams } = new URL(request.url)
    
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = supabase
      .from('reel_interactions')
      .select(`
        *,
        user:profiles!user_id (
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .eq('reel_id', reelId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('interaction_type', type)
    }

    const { data: interactions, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        interactions,
        page,
        limit,
        has_more: interactions?.length === limit
      }
    })

  } catch (error) {
    console.error("Get reel interactions error:", error)
    return NextResponse.json({ error: "Failed to fetch interactions" }, { status: 500 })
  }
}
