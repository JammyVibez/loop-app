import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function getUserFromToken(token: string) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
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

    const loopId = params.id
    const { action } = await request.json()

    if (!action || !['like', 'save', 'share', 'view'].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'like', 'save', 'share', or 'view'" },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Check if loop exists
    const { data: loop, error: loopError } = await supabase
      .from("loops")
      .select("id, author_id")
      .eq("id", loopId)
      .single()

    if (loopError || !loop) {
      return NextResponse.json({ error: "Loop not found" }, { status: 404 })
    }

    // Handle different actions
    if (action === 'like') {
      // Check if already liked
      const { data: existingLike } = await supabase
        .from("loop_interactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("loop_id", loopId)
        .eq("interaction_type", "like")
        .single()

      if (existingLike) {
        // Unlike - remove the interaction
        const { error: deleteError } = await supabase
          .from("loop_interactions")
          .delete()
          .eq("id", existingLike.id)

        if (deleteError) {
          console.error("Unlike error:", deleteError)
          return NextResponse.json({ error: "Failed to unlike" }, { status: 500 })
        }

        // Decrement likes count
        await supabase.rpc('decrement_loop_likes', { loop_id: loopId })

        return NextResponse.json({
          success: true,
          action: 'unliked',
          is_liked: false,
        })
      } else {
        // Like - add the interaction
        const { error: insertError } = await supabase
          .from("loop_interactions")
          .insert({
            user_id: user.id,
            loop_id: loopId,
            interaction_type: "like",
          })

        if (insertError) {
          console.error("Like error:", insertError)
          return NextResponse.json({ error: "Failed to like" }, { status: 500 })
        }

        // Increment likes count
        await supabase.rpc('increment_loop_likes', { loop_id: loopId })

        // Create notification for loop author (if not self)
        if (loop.author_id !== user.id) {
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("username, display_name")
            .eq("id", user.id)
            .single()

          await supabase.from("notifications").insert({
            user_id: loop.author_id,
            type: "like",
            title: "New Like",
            message: `${userProfile?.display_name || userProfile?.username || 'Someone'} liked your loop`,
            data: {
              loop_id: loopId,
              user_id: user.id,
              username: userProfile?.username,
            },
          })
        }

        return NextResponse.json({
          success: true,
          action: 'liked',
          is_liked: true,
        })
      }
    }

    if (action === 'save') {
      // Check if already saved
      const { data: existingSave } = await supabase
        .from("loop_interactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("loop_id", loopId)
        .eq("interaction_type", "save")
        .single()

      if (existingSave) {
        // Unsave
        const { error: deleteError } = await supabase
          .from("loop_interactions")
          .delete()
          .eq("id", existingSave.id)

        if (deleteError) {
          console.error("Unsave error:", deleteError)
          return NextResponse.json({ error: "Failed to unsave" }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          action: 'unsaved',
          is_saved: false,
        })
      } else {
        // Save
        const { error: insertError } = await supabase
          .from("loop_interactions")
          .insert({
            user_id: user.id,
            loop_id: loopId,
            interaction_type: "save",
          })

        if (insertError) {
          console.error("Save error:", insertError)
          return NextResponse.json({ error: "Failed to save" }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          action: 'saved',
          is_saved: true,
        })
      }
    }

    if (action === 'share') {
      // Add share interaction
      const { error: insertError } = await supabase
        .from("loop_interactions")
        .insert({
          user_id: user.id,
          loop_id: loopId,
          interaction_type: "share",
        })

      if (insertError) {
        console.error("Share error:", insertError)
        return NextResponse.json({ error: "Failed to record share" }, { status: 500 })
      }

      // Increment shares count
      await supabase.rpc('increment_loop_shares', { loop_id: loopId })

      return NextResponse.json({
        success: true,
        action: 'shared',
      })
    }

    if (action === 'view') {
      // Check if already viewed recently (within last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      
      const { data: recentView } = await supabase
        .from("loop_interactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("loop_id", loopId)
        .eq("interaction_type", "view")
        .gte("created_at", oneHourAgo)
        .single()

      if (!recentView) {
        // Add view interaction
        const { error: insertError } = await supabase
          .from("loop_interactions")
          .insert({
            user_id: user.id,
            loop_id: loopId,
            interaction_type: "view",
          })

        if (insertError) {
          console.error("View error:", insertError)
          return NextResponse.json({ error: "Failed to record view" }, { status: 500 })
        }

        // Increment views count
        await supabase.rpc('increment_loop_views', { loop_id: loopId })
      }

      return NextResponse.json({
        success: true,
        action: 'viewed',
      })
    }

  } catch (error) {
    console.error("Error in loop interaction:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Get interaction status for a loop
export async function GET(
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

    const loopId = params.id
    const supabase = createServerClient()

    // Get user's interactions with this loop
    const { data: interactions } = await supabase
      .from("loop_interactions")
      .select("interaction_type")
      .eq("user_id", user.id)
      .eq("loop_id", loopId)

    const interactionTypes = interactions?.map(i => i.interaction_type) || []

    // Get loop stats
    const { data: stats } = await supabase
      .from("loop_stats")
      .select("*")
      .eq("loop_id", loopId)
      .single()

    return NextResponse.json({
      success: true,
      interactions: {
        is_liked: interactionTypes.includes('like'),
        is_saved: interactionTypes.includes('save'),
        has_viewed: interactionTypes.includes('view'),
      },
      stats: stats || {
        likes_count: 0,
        comments_count: 0,
        branches_count: 0,
        shares_count: 0,
        views_count: 0,
      },
    })
  } catch (error) {
    console.error("Error fetching loop interactions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
