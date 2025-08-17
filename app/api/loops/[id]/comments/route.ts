
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const loopId = params.id

    const supabase = createServerClient()

    const { data: comments, error } = await supabase
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
        ),
        replies:comments!parent_comment_id(
          *,
          author:profiles!comments_author_id_fkey(
            id,
            username,
            display_name,
            avatar_url,
            is_verified,
            is_premium
          )
        )
      `)
      .eq('loop_id', loopId)
      .is('parent_comment_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      comments: comments || [],
      pagination: {
        limit,
        offset,
        total: comments?.length || 0
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

    const { content, parent_comment_id, media_url } = await request.json()
    const loopId = params.id

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

    if (loop && loop.author_id !== user.id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: loop.author_id,
          type: 'comment',
          title: `${user.user_metadata?.display_name || user.email} commented on your loop`,
          message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          data: {
            loop_id: loopId,
            comment_id: comment.id,
            user_id: user.id
          }
        })
    }

    // If it's a reply, notify the parent comment author
    if (parent_comment_id) {
      const { data: parentComment } = await supabase
        .from('comments')
        .select('author_id')
        .eq('id', parent_comment_id)
        .single()

      if (parentComment && parentComment.author_id !== user.id) {
        await supabase
          .from('notifications')
          .insert({
            user_id: parentComment.author_id,
            type: 'reply',
            title: `${user.user_metadata?.display_name || user.email} replied to your comment`,
            message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            data: {
              loop_id: loopId,
              comment_id: comment.id,
              parent_comment_id,
              user_id: user.id
            }
          })
      }
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
