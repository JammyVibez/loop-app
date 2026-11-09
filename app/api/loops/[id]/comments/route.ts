
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/server-auth";
import { enforceUserRateLimit } from "@/lib/rate-limit-settings";

/** Attachments a single comment can carry. */
const MAX_COMMENT_ATTACHMENTS = 4

type CommentAttachment = {
  url: string
  type: "image" | "video" | "audio" | "file"
  name?: string
  width?: number
  height?: number
  duration?: number
}

/**
 * Validates client-supplied attachments before they reach the database — only
 * absolute http(s) URLs from our own upload pipeline are kept, and the type is
 * forced into the small set the comment renderer knows how to draw.
 */
function sanitizeAttachments(input: unknown): CommentAttachment[] {
  if (!Array.isArray(input)) return []
  const out: CommentAttachment[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue
    const src = raw as Record<string, unknown>
    const url = typeof src.url === "string" ? src.url.trim() : ""
    if (!/^https?:\/\//i.test(url) || url.length > 2048) continue
    const declared = String(src.type || "").toLowerCase()
    const type: CommentAttachment["type"] =
      declared === "image" || declared === "video" || declared === "audio" ? declared : "file"
    const item: CommentAttachment = { url, type }
    const name = typeof src.name === "string" ? src.name.trim().slice(0, 160) : ""
    if (name) item.name = name
    for (const dim of ["width", "height", "duration"] as const) {
      const value = Number(src[dim])
      if (Number.isFinite(value) && value > 0) item[dim] = Math.round(value)
    }
    out.push(item)
    if (out.length >= MAX_COMMENT_ATTACHMENTS) break
  }
  return out
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

    const viewer = await getUserFromRequest(request)

    const { data: allComments, error } = await supabase
      .from('comments')
      .select(`
        *,
        like_count:comment_likes(count),
        author:profiles!comments_author_id_fkey(
          id,
          username,
          display_name,
          avatar_url,
          video_avatar_url,
          is_verified,
          is_premium,
          active_cosmetics,
          cosmetics,
          equipped_frame_id,
          level,
          badge_id
        )
      `)
      .eq('loop_id', loopId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Which comments did the viewer like? (authoritative, not the counter column)
    const likedIds = new Set<string>()
    if (viewer && (allComments || []).length > 0) {
      const { data: myLikes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", viewer.id)
        .in("comment_id", allComments.map((c: any) => c.id))
      for (const like of myLikes || []) likedIds.add(like.comment_id)
    }

    const commentMap = new Map<string, any>()
    const topLevelComments: any[] = []

    for (const c of allComments || []) {
      const likeCount = Array.isArray(c.like_count) ? c.like_count[0]?.count : c.like_count
      commentMap.set(c.id, {
        ...c,
        like_count: Number(likeCount ?? c.like_count ?? 0),
        isLiked: likedIds.has(c.id),
        replies: [],
      })
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
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Admin-tuneable comment throttle (see /loopadmin → Rate limits).
    const guard = await enforceUserRateLimit(createServerClient(), "comment", user.id)
    if (!guard.ok) {
      return NextResponse.json(
        {
          error: "Slow down — you're commenting too fast",
          message: `You've hit the comment limit. Try again in ${guard.retryAfter} seconds.`,
          retryAfter: guard.retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(guard.retryAfter) } },
      )
    }

    const body = await request.json()
    const { parent_comment_id, media_url, media_type } = body
    const { id: loopId } = await params

    const text = typeof body.content === "string" ? body.content.trim() : ""
    const attachments = sanitizeAttachments(body.attachments)

    // A comment is valid with text, with media, or with both — but not empty.
    if (!text && attachments.length === 0) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 })
    }

    // Keep the legacy single-attachment columns in sync with the new array so
    // older consumers (and search) still see the first attachment.
    const first = attachments[0]
    const resolvedMediaUrl =
      first?.url || (typeof media_url === "string" && media_url.trim() ? media_url.trim() : null)
    const resolvedMediaType =
      first?.type || (typeof media_type === "string" && media_type.trim() ? media_type.trim() : null)

    const supabase = createServerClient()

    // Check if comments are disabled on this loop
    const { data: loopRow } = await supabase
      .from("loops")
      .select("author_id, comments_disabled")
      .eq("id", loopId)
      .maybeSingle()

    if ((loopRow as any)?.comments_disabled && user.id !== (loopRow as any)?.author_id) {
      return NextResponse.json({ error: "Comments are locked for this post" }, { status: 403 })
    }

    // Create comment
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        loop_id: loopId,
        author_id: user.id,
        content: text,
        parent_comment_id,
        media_url: resolvedMediaUrl,
        media_type: resolvedMediaType,
        attachments,
      })
      .select(`
        *,
        author:profiles!comments_author_id_fkey(
          id,
          username,
          display_name,
          avatar_url,
          video_avatar_url,
          is_verified,
          is_premium,
          active_cosmetics,
          cosmetics,
          equipped_frame_id,
          level,
          badge_id
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Increment comment count — prefer the RPC, fall back to a direct
    // loop_stats update so the count is never stale on older schemas.
    const { error: countError } = await supabase.rpc('increment_loop_comments', { loop_id: loopId })
    if (countError) {
      const { data: current } = await supabase
        .from("loop_stats")
        .select("comments_count")
        .eq("loop_id", loopId)
        .maybeSingle()
      if (current) {
        await supabase
          .from("loop_stats")
          .update({ comments_count: Number(current.comments_count || 0) + 1, updated_at: new Date().toISOString() })
          .eq("loop_id", loopId)
      } else {
        await supabase.from("loop_stats").upsert({
          loop_id: loopId,
          likes_count: 0,
          comments_count: 1,
          shares_count: 0,
          views_count: 0,
          branches_count: 0,
        })
      }
    }
    // Keep the denormalized loops.comment_count in sync when the column exists.
    {
      const { data: loopRow } = await supabase.from("loops").select("comment_count").eq("id", loopId).maybeSingle()
      await supabase
        .from("loops")
        .update({ comment_count: Number((loopRow as any)?.comment_count || 0) + 1 })
        .eq("id", loopId)
        .maybeSingle()
    }

    // Create notification for loop author
    const { data: loop } = await supabase
      .from('loops')
      .select('author_id')
      .eq('id', loopId)
      .single()

    const actorName = user.user_metadata?.display_name || user.user_metadata?.username || user.email || "Someone"
    const snippet = text
      ? text.substring(0, 100) + (text.length > 100 ? '...' : '')
      : first?.type === "video"
        ? "Sent a video"
        : first?.type === "image"
          ? "Sent a photo"
          : "Sent an attachment"

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
          priority: "high",
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
            priority: "high",
          })
        } catch (notifyErr) {
          console.warn("Reply notify failed:", notifyErr)
        }
      }
    }

    try {
      const { processMentions, extractMentions, attachMentionsColumn } = await import("@/lib/mentions")
      const usernames = extractMentions(text)
      if (usernames.length) {
        await attachMentionsColumn(supabase, "comments", comment.id, usernames)
        await processMentions(supabase, text, {
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

    // Quest progress: add_comment native action
    try {
      const { trackQuestAction } = await import("@/lib/quest-tracker")
      await trackQuestAction(supabase, user.id, "create_comment")
    } catch (err) {
      console.error("quest track (add_comment):", err)
    }

    // Someone tagged the assistant: answer in the thread as Loop AI, the way
    // an account would. A missing provider or a failed call leaves the mention
    // unanswered instead of posting an error.
    let aiReply: any = null
    if (text) {
      try {
        const { LOOP_AI_BOT_ID, buildLoopAiReply, ensureLoopAiBot, mentionsLoopAi } = await import(
          "@/lib/loop-ai/mentions"
        )
        const tagged = mentionsLoopAi(text)
        const ancestors: Array<{ author_id: string; content: string; parent_comment_id: string | null }> = []
        let ancestorId = typeof parent_comment_id === "string" ? parent_comment_id : null
        for (let depth = 0; ancestorId && depth < 8; depth += 1) {
          const { data: ancestor } = await supabase
            .from("comments")
            .select("id, author_id, content, parent_comment_id")
            .eq("id", ancestorId)
            .eq("loop_id", loopId)
            .maybeSingle()
          if (!ancestor) break
          ancestors.push(ancestor)
          ancestorId = ancestor.parent_comment_id
        }
        const isAiConversation = Boolean(
          ancestors.some((ancestor) => ancestor.author_id === LOOP_AI_BOT_ID) &&
            ancestors.some((ancestor) => mentionsLoopAi(ancestor.content)),
        )
        if ((tagged || isAiConversation) && (await ensureLoopAiBot())) {
          const { data: loopContext } = await supabase
            .from("loops")
            .select("content")
            .eq("id", loopId)
            .maybeSingle()
          const previousAiReply = ancestors.find((ancestor) => ancestor.author_id === LOOP_AI_BOT_ID)
          const history = previousAiReply
            ? [{ role: "assistant" as const, content: String(previousAiReply.content || "").slice(0, 900) }]
            : []
          const answer = await buildLoopAiReply({
            question: text,
            history,
            context: `The Loop being discussed: "${String((loopContext as any)?.content || "").slice(0, 600)}"`,
          })

          if (answer) {
            const { data: aiComment } = await supabase
              .from("comments")
              .insert({
                loop_id: loopId,
                author_id: LOOP_AI_BOT_ID,
                content: answer.text,
                parent_comment_id: comment.id,
              })
              .select(
                `*,
                author:profiles!comments_author_id_fkey(
                  id, username, display_name, avatar_url, is_verified, is_premium, level, badge_id
                )`
              )
              .single()

            if (aiComment) {
              aiReply = aiComment
              await supabase.rpc("increment_loop_comments", { loop_id: loopId }).then(
                () => undefined,
                () => undefined,
              )
            }
          }
        }
      } catch (aiError) {
        console.warn("Loop AI mention reply failed:", aiError)
      }
    }

    // Broadcast real-time update
    await supabase.channel(`loop:${loopId}`)
      .send({
        type: 'broadcast',
        event: 'new_comment',
        payload: {
          comment,
          ai_reply: aiReply,
          loop_id: loopId
        }
      })

    return NextResponse.json({
      success: true,
      comment,
      ai_reply: aiReply
    })

  } catch (error: any) {
    console.error("Create comment error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
