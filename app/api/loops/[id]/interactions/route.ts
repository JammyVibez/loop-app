
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loopId } = await params
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const interaction_type = body.interaction_type || body.type || body.action

    if (!['like', 'save', 'share', 'view'].includes(interaction_type)) {
      return NextResponse.json({ error: "Invalid interaction type" }, { status: 400 })
    }

    const supabase = createServerClient()

    const adjustStat = async (field: "likes_count" | "shares_count" | "views_count", delta: number) => {
      const { data: current } = await supabase
        .from("loop_stats")
        .select("likes_count, shares_count, views_count, comments_count, branches_count")
        .eq("loop_id", loopId)
        .maybeSingle()

      if (!current) {
        await supabase.from("loop_stats").upsert({
          loop_id: loopId,
          likes_count: field === "likes_count" ? Math.max(0, delta) : 0,
          shares_count: field === "shares_count" ? Math.max(0, delta) : 0,
          views_count: field === "views_count" ? Math.max(0, delta) : 0,
          comments_count: 0,
          branches_count: 0,
        })
        return
      }

      await supabase
        .from("loop_stats")
        .update({
          [field]: Math.max(0, Number(current[field] || 0) + delta),
        })
        .eq("loop_id", loopId)
    }

    const runRpcOrFallback = async (rpcName: string, field: "likes_count" | "shares_count" | "views_count", delta: number) => {
      const { error } = await supabase.rpc(rpcName, { loop_id: loopId })
      if (error) {
        console.warn(`${rpcName} failed, falling back to direct stats update:`, error.message)
        await adjustStat(field, delta)
      }
    }

    // Check if interaction already exists
    const { data: existingInteraction } = await supabase
      .from('loop_interactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('loop_id', loopId)
      .eq('interaction_type', interaction_type)
      .maybeSingle()

    let isLiked = false
    let isSaved = false

    // Views and shares are additive — never toggle off
    if (interaction_type === "view" || interaction_type === "share") {
      if (!existingInteraction) {
        const { error: insertError } = await supabase.from("loop_interactions").insert({
          user_id: user.id,
          loop_id: loopId,
          interaction_type,
        })
        if (insertError && !/duplicate|unique/i.test(insertError.message || "")) {
          return NextResponse.json({ error: insertError.message || "Failed to save interaction" }, { status: 500 })
        }
        if (interaction_type === "share") {
          await runRpcOrFallback("increment_loop_shares", "shares_count", 1)
        } else {
          await runRpcOrFallback("increment_loop_views", "views_count", 1)
        }
      } else if (interaction_type === "share") {
        // Allow multiple share bumps without duplicating the interaction row
        await runRpcOrFallback("increment_loop_shares", "shares_count", 1)
      }

      if (interaction_type === "share") {
        const { data: loop } = await supabase.from("loops").select("author_id").eq("id", loopId).maybeSingle()
        if (loop && loop.author_id !== user.id) {
          await supabase.from("notifications").insert({
            user_id: loop.author_id,
            type: "system",
            title: "Your loop was shared",
            message: "Someone shared your loop",
            data: { loop_id: loopId, user_id: user.id, interaction_type: "share" },
          })
        }
      }

      const { data: stats } = await supabase.from("loop_stats").select("*").eq("loop_id", loopId).maybeSingle()
      return NextResponse.json({
        success: true,
        interaction_type,
        is_active: true,
        action: "added",
        stats,
      })
    }

    if (existingInteraction) {
      // Remove interaction (unlike/unsave)
      await supabase
        .from('loop_interactions')
        .delete()
        .eq('id', existingInteraction.id)

      if (interaction_type === 'like') {
        await runRpcOrFallback('decrement_loop_likes', 'likes_count', -1)
      }
    } else {
      // Add interaction
      const { error: insertError } = await supabase
        .from('loop_interactions')
        .insert({
          user_id: user.id,
          loop_id: loopId,
          interaction_type
        })

      if (insertError) {
        return NextResponse.json({ error: insertError.message || "Failed to save interaction" }, { status: 500 })
      }

      if (interaction_type === 'like') {
        await runRpcOrFallback('increment_loop_likes', 'likes_count', 1)
        isLiked = true
      } else if (interaction_type === 'save') {
        isSaved = true
      }

      // Create notification for loop author
      {
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
              type: interaction_type === "save" ? "system" : interaction_type,
              title: `${user.user_metadata?.display_name || user.email} ${interaction_type}d your loop`,
              message: `Your loop received a new ${interaction_type}`,
              data: {
                loop_id: loopId,
                user_id: user.id,
                interaction_type
              }
            })

          if (interaction_type === "like") {
            try {
              const { awardXp } = await import("@/lib/xp")
              await awardXp(supabase, user.id, "like_given", "Liked a loop")
              await awardXp(supabase, loop.author_id, "like_received", "Received a like")
            } catch (xpError) {
              console.error("Like XP award error:", xpError)
            }
          }
        } else if (interaction_type === "like") {
          try {
            const { awardXp } = await import("@/lib/xp")
            await awardXp(supabase, user.id, "like_given", "Liked a loop")
          } catch {
            /* ignore */
          }
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
      action: existingInteraction ? "removed" : "added",
      is_liked: interaction_type === "like" ? !existingInteraction : undefined,
      is_saved: interaction_type === "save" ? !existingInteraction : undefined,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loopId } = await params
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

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
