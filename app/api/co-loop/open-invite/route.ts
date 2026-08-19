import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

/**
 * POST – Creator publishes an open Co-Loop invite as a feed post.
 * Body: { session_id, topic, max_collaborators? }
 * Creates a loop post of type "open_coloop_invite" + updates the session record.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { session_id, topic, max_collaborators = 4 } = await request.json()

    if (!session_id || !topic?.trim()) {
      return NextResponse.json({ error: "session_id and topic are required" }, { status: 400 })
    }

    if (max_collaborators < 2 || max_collaborators > 4) {
      return NextResponse.json({ error: "max_collaborators must be between 2 and 4" }, { status: 400 })
    }

    // Get creator profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_verified, is_premium, level, active_cosmetics, cosmetics, badge_id")
      .eq("id", user.id)
      .single()

    // Ensure session exists and user is owner
    const { data: session } = await supabase
      .from("co_loop_sessions")
      .select("*")
      .eq("session_id", session_id)
      .maybeSingle()

    if (session && session.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the session owner can create an open invite" }, { status: 403 })
    }

    // If session doesn't exist yet, create it
    if (!session) {
      await supabase.from("co_loop_sessions").insert({
        session_id,
        owner_id: user.id,
        owner_username: profile?.username || user.email?.split("@")[0] || "creator",
        co_authors: [],
        is_open_invite: true,
        max_collaborators,
        open_invite_topic: topic.trim(),
      })
    } else {
      // Update existing session with open invite info
      await supabase
        .from("co_loop_sessions")
        .update({
          is_open_invite: true,
          max_collaborators,
          open_invite_topic: topic.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", session_id)
    }

    // Create the feed post (open co-loop invite card)
    const { data: loop, error: loopError } = await supabase
      .from("loops")
      .insert({
        author_id: user.id,
        content_text: topic.trim(),
        content_title: `🤝 Open Co-Loop: ${topic.trim()}`,
        post_type: "open_coloop_invite",
        content_type: "open_coloop_invite",
        visibility: "public",
        content_metadata: {
          is_open_coloop_invite: true,
          session_id,
          max_collaborators,
          topic: topic.trim(),
          current_participants: 1,
          status: "open",
        },
      })
      .select("*, author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium, level, active_cosmetics, cosmetics, badge_id)")
      .single()

    if (loopError) {
      console.error("Failed to create open co-loop invite post:", loopError)
      return NextResponse.json({ error: "Failed to create feed post" }, { status: 500 })
    }

    // Link the post back to the session
    await supabase
      .from("co_loop_sessions")
      .update({ feed_post_id: loop.id, updated_at: new Date().toISOString() })
      .eq("session_id", session_id)

    // Initialize loop_stats
    await supabase.from("loop_stats").insert({
      loop_id: loop.id,
      likes_count: 0,
      comments_count: 0,
      branches_count: 0,
      shares_count: 0,
      views_count: 0,
    })

    // Broadcast open invite to realtime channel
    try {
      const channel = supabase.channel(`co-loop-studio:${session_id}`)
      await channel.send({
        type: "broadcast",
        event: "open_invite_published",
        payload: {
          session_id,
          topic: topic.trim(),
          max_collaborators,
          post_id: loop.id,
          creator: profile?.display_name || profile?.username,
        },
      })
    } catch {
      // best-effort
    }

    return NextResponse.json({
      success: true,
      loop,
      session_id,
      post_id: loop.id,
    })
  } catch (error: any) {
    console.error("Open co-loop invite error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH – Join an open Co-Loop invite (any user can join up to the max).
 * Body: { session_id, post_id? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { session_id } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 })
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from("co_loop_sessions")
      .select("*")
      .eq("session_id", session_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (!session.is_open_invite) {
      return NextResponse.json({ error: "This is not an open invite session" }, { status: 400 })
    }

    if (session.status !== "active") {
      return NextResponse.json({ error: "This session is no longer active" }, { status: 400 })
    }

    // Already the owner?
    if (session.owner_id === user.id) {
      return NextResponse.json({ error: "You are the creator of this session" }, { status: 400 })
    }

    // Check if already a participant
    const { data: existing } = await supabase
      .from("open_co_loop_participants")
      .select("id")
      .eq("session_id", session_id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "You have already joined this session" }, { status: 400 })
    }

    // Count current participants (owner + participants table)
    const { count: participantCount } = await supabase
      .from("open_co_loop_participants")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session_id)

    const totalJoined = (participantCount || 0) + 1 // +1 for owner
    if (totalJoined >= session.max_collaborators) {
      return NextResponse.json({ error: "This session is full" }, { status: 400 })
    }

    // Add participant
    const { error: insertError } = await supabase
      .from("open_co_loop_participants")
      .insert({ session_id, user_id: user.id })

    if (insertError) {
      console.error("Failed to add participant:", insertError)
      return NextResponse.json({ error: "Failed to join session" }, { status: 500 })
    }

    // Get user profile for co_authors update
    const { data: joinerProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_verified")
      .eq("id", user.id)
      .single()

    const coAuthorEntry = {
      id: user.id,
      username: joinerProfile?.username || "collaborator",
      display_name: joinerProfile?.display_name || joinerProfile?.username || "Co-Author",
      avatar_url: joinerProfile?.avatar_url || null,
      role: "Co-Author",
    }

    // Update co_authors in session
    const currentCoAuthors = Array.isArray(session.co_authors) ? session.co_authors : []
    const alreadyInCoAuthors = currentCoAuthors.some((c: any) => c.id === user.id)
    if (!alreadyInCoAuthors) {
      await supabase
        .from("co_loop_sessions")
        .update({
          co_authors: [...currentCoAuthors, coAuthorEntry],
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", session_id)
    }

    // Update feed post content_metadata with new count
    const newCount = totalJoined + 1
    const isFull = newCount >= session.max_collaborators
    if (session.feed_post_id) {
      await supabase
        .from("loops")
        .update({
          content_metadata: {
            ...(session.open_invite_topic ? {} : {}),
            is_open_coloop_invite: true,
            session_id,
            max_collaborators: session.max_collaborators,
            topic: session.open_invite_topic || "",
            current_participants: newCount,
            status: isFull ? "full" : "open",
          },
        })
        .eq("id", session.feed_post_id)
    }

    // Notify the session owner
    try {
      const { notifyUser } = await import("@/lib/notifications")
      await notifyUser(supabase, {
        userId: session.owner_id,
        type: "co_loop_open_join",
        title: "Someone Joined Your Open Co-Loop! 🤝",
        message: `${joinerProfile?.display_name || joinerProfile?.username || "A user"} joined your open session: "${session.open_invite_topic || "Co-Loop"}"`,
        actorId: user.id,
        actionUrl: `/co-loop/studio?session=${session_id}`,
        data: {
          session_id,
          joiner_id: user.id,
          joiner_name: joinerProfile?.display_name || joinerProfile?.username,
          joiner_avatar: joinerProfile?.avatar_url,
          topic: session.open_invite_topic,
        },
        pushCategory: "social",
      })
    } catch (notifyErr) {
      console.warn("Open co-loop join notification failed:", notifyErr)
    }

    // Broadcast join to studio
    try {
      const channel = supabase.channel(`co-loop-studio:${session_id}`)
      await channel.send({
        type: "broadcast",
        event: "co-author-accepted",
        payload: { user: coAuthorEntry },
      })
    } catch {
      // best-effort
    }

    return NextResponse.json({
      success: true,
      message: "You joined the Co-Loop session!",
      studio_url: `/co-loop/studio?session=${session_id}`,
      current_count: newCount,
      max: session.max_collaborators,
      is_full: isFull,
    })
  } catch (error: any) {
    console.error("Open co-loop join error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
