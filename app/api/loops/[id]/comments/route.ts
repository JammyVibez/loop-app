
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const { id: loopId } = await params

    const supabase = createServerClient()

    const { data: allComments, error } = await supabase
      .from('comments')
      .select(`
        *,
        author:profiles!comments_author_id_fkey(
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          is_premium
        )
      `)
      .eq('loop_id', loopId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const commentMap = new Map<string, any>()
    const topLevelComments: any[] = []

    for (const c of allComments || []) {
      commentMap.set(c.id, { ...c, replies: [] })
    }

    for (const c of allComments || []) {
      const node = commentMap.get(c.id)
      if (c.parent_comment_id && commentMap.has(c.parent_comment_id)) {
        commentMap.get(c.parent_comment_id).replies.push(node)
      } else if (!c.parent_comment_id) {
        topLevelComments.push(node)
      }
    }

    topLevelComments.reverse()

    return NextResponse.json({
      success: true,
      comments: topLevelComments,
      pagination: {
        limit,
        offset,
        total: topLevelComments.length
      }
    })

  } catch (error: any) {
    console.error("Get comments error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { content, parent_comment_id, media_url } = await request.json()
    const { id: loopId } = await params

    if (!content?.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Create comment
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        loop_id: loopId,
        author_id: user.id,
        content: content.trim(),
        parent_comment_id,
        media_url
      })
      .select(`
        *,
        author:profiles!comments_author_id_fkey(
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          is_premium
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Increment comment count
    await supabase.rpc('increment_loop_comments', { loop_id: loopId })

    // Create notification for loop author
    const { data: loop } = await supabase
      .from('loops')
      .select('author_id')
      .eq('id', loopId)
      .single()

    const actorName = user.user_metadata?.display_name || user.user_metadata?.username || user.email || "Someone"
    const snippet = content.substring(0, 100) + (content.length > 100 ? '...' : '')

    if (loop && loop.author_id !== user.id) {
      try {
        const { notifyUser } = await import("@/lib/notifications")
        await notifyUser(supabase, {
          userId: loop.author_id,
          type: 'comment',
          title: `${actorName} commented on your loop`,
          message: snippet,
          actorId: user.id,
          actionUrl: `/loop/${loopId}`,
          data: { loop_id: loopId, comment_id: comment.id, user_id: user.id },
          pushCategory: "social",
        })
      } catch (notifyErr) {
        console.warn("Comment notify failed:", notifyErr)
      }
    }

    // If it's a reply, notify the parent comment author
    if (parent_comment_id) {
      const { data: parentComment } = await supabase
        .from('comments')
        .select('author_id')
        .eq('id', parent_comment_id)
        .single()

      if (parentComment && parentComment.author_id !== user.id) {
        try {
          const { notifyUser } = await import("@/lib/notifications")
          await notifyUser(supabase, {
            userId: parentComment.author_id,
            type: 'reply',
            title: `${actorName} replied to your comment`,
            message: snippet,
            actorId: user.id,
            actionUrl: `/loop/${loopId}`,
            data: { loop_id: loopId, comment_id: comment.id, parent_comment_id, user_id: user.id },
            pushCategory: "social",
          })
        } catch (notifyErr) {
          console.warn("Reply notify failed:", notifyErr)
        }
      }
    }

    try {
      const { processMentions, extractMentions, attachMentionsColumn } = await import("@/lib/mentions")
      const usernames = extractMentions(content)
      if (usernames.length) {
        await attachMentionsColumn(supabase, "comments", comment.id, usernames)
        await processMentions(supabase, content, {
          source: "loop_comment",
          loop_id: loopId,
          comment_id: comment.id,
          actor_id: user.id,
          actor_username: user.user_metadata?.username,
          actor_display_name: user.user_metadata?.display_name || user.email,
        })
      }
    } catch (mentionError) {
      console.error("Comment mention processing error:", mentionError)
    }

    // Broadcast real-time update
    await supabase.channel(`loop:${loopId}`)
      .send({
        type: 'broadcast',
        event: 'new_comment',
        payload: {
          comment,
          loop_id: loopId
        }
      })

    return NextResponse.json({
      success: true,
      comment
    })

  } catch (error: any) {
    console.error("Create comment error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
