import { type } from "next/server"
import { } from "@/lib/supabase"
import { } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * "While you were away" recap — the return experience.
 *
 * Surfaces meaningful participation events that happened since the user's
 * last visit so opening Loop feels like something is waiting for them:
 *   - new comments / replies on their content
 *   - pending follow requests
 *   - their active duels changing (vote movement)
 *   - activity in circles they belong to
 *   - pending co-loop invitations
 *
 * Every section is best-effort: one failing query never blocks the others,
 * and an empty recap renders nothing (never fake items).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const sinceRaw = searchParams.get("since")
    const since = sinceRaw && !Number.isNaN(new Date(sinceRaw).getTime()) ? new Date(sinceRaw) : null

    const supabase = createServerClient()
    const items: Array<{
      kind: string
      title: string
      detail: string
      href: string
      icon: "comment" | "duel" | "circle" | "follow" | "co_loop"
    }> = []

    // 1) Comments & replies on the user's content
    try {
      const { data: myLoops } = await supabase
        .from("loops")
        .select("id")
        .eq("author_id", user.id)
        .limit(200)
      const loopIds = (myLoops || []).map((l) => l.id)

      if (loopIds.length) {
        let commentsQuery = supabase
          .from("comments")
          .select(
            `id, content, created_at, loop_id, author_id,
             author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url, video_avatar_url)`,
          )
          .in("loop_id", loopIds)
          .neq("author_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20)
        if (since) commentsQuery = commentsQuery.gt("created_at", since.toISOString())

        const { data: comments } = await commentsQuery
        const fresh = (comments || []).filter(
          (c: any) => !since || new Date(c.created_at).getTime() > since.getTime(),
        )
        if (fresh.length) {
          const author =
            (Array.isArray(fresh[0].author) ? fresh[0].author[0] : fresh[0].author) || {}
          items.push({
            kind: "comment",
            title: `Someone responded to your post`,
            detail:
              fresh.length === 1
                ? `@${author.username || "someone"} commented: "${String(fresh[0].content || "").slice(0, 72)}"`
                : `${fresh.length} new comments on your loops — the latest from @${author.username || "someone"}`,
            href: `/loop/${fresh[0].loop_id}`,
            icon: "comment",
          })
        }
      }

      // Replies to the user's comments
      const { data: myComments } = await supabase
        .from("comments")
        .select("id")
        .eq("author_id", user.id)
        .limit(100)
      const myCommentIds = (myComments || []).map((c) => c.id)
      if (myCommentIds.length) {
        let repliesQuery = supabase
          .from("comments")
          .select(
            `id, content, created_at, loop_id, author_id,
             author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url, video_avatar_url)`,
          )
          .in("parent_comment_id", myCommentIds)
          .neq("author_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20)
        if (since) repliesQuery = repliesQuery.gt("created_at", since.toISOString())
        const { data: replies } = await repliesQuery
        const freshReplies = (replies || []).filter(
          (c: any) => !since || new Date(c.created_at).getTime() > since.getTime(),
        )
        if (freshReplies.length) {
          const author =
            (Array.isArray(freshReplies[0].author) ? freshReplies[0].author[0] : freshReplies[0].author) || {}
          items.push({
            kind: "comment",
            title: `Someone replied to your comment`,
            detail: `@${author.username || "someone"}: "${String(freshReplies[0].content || "").slice(0, 72)}"`,
            href: `/loop/${freshReplies[0].loop_id}`,
            icon: "comment",
          })
        }
      }
    } catch (err) {
      console.warn("recap comments:", err)
    }

    // 2) Pending follow requests
    try {
      const { data: requests } = await supabase
        .from("follow_requests")
        .select("id, requester_id, requester:profiles!requester_id(username, display_name, avatar_url, video_avatar_url)")
        .eq("target_id", user.id)
        .eq("status", "pending")
        .limit(10)
      if ((requests || []).length) {
        const requester =
          (Array.isArray(requests![0].requester) ? requests![0].requester[0] : requests![0].requester) || {}
        items.push({
          kind: "follow",
          title: "You have follow requests",
          detail:
            requests!.length === 1
              ? `@${requester.username || "someone"} wants to follow you`
              : `@${requester.username || "someone"} and ${requests!.length - 1} more want to follow you`,
          href: "/notifications",
          icon: "follow",
        })
      }
    } catch (err) {
      console.warn("recap follow requests:", err)
    }

    // 3) Active duels the user is part of — did the vote move?
    try {
      const { data: duels } = await supabase
        .from("loop_duels")
        .select(
          `id, prompt, status, created_at, loop_id,
           creator_id, opponent_id,
           entries:loop_duel_entries(id, side, votes_count),
           creator:profiles!creator_id(username, display_name),
           opponent:profiles!opponent_id(username, display_name)`,
        )
        .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .eq("status", "active")
        .limit(10)

      for (const duel of duels || []) {
        const entries = duel.entries || []
        const totalVotes = entries.reduce((sum: number, e: any) => sum + Number(e.votes_count || 0), 0)
        const a = Number(entries[0]?.votes_count || 0)
        const b = Number(entries[1]?.votes_count || 0)
        const pct = (n: number) =>
          totalVotes > 0 ? Math.round((n / totalVotes) * 100) : 50
        const leader = a > b ? entries[0] : b > a ? entries[1] : null
        items.push({
          kind: "duel",
          title: "Your Duel is still changing",
          detail:
            totalVotes > 0
              ? `"${String(duel.prompt || "The duel").slice(0, 60)}" is at ${pct(a)}%–${pct(b)}% with ${totalVotes} votes${
                  leader ? ` — ${leader.side || "one side"} is pulling ahead` : ""
                }`
              : `"${String(duel.prompt || "The duel").slice(0, 60)}" is waiting for its first votes`,
          href: `/loop/${duel.loop_id}`,
          icon: "duel",
        })
      }
    } catch (err) {
      console.warn("recap duels:", err)
    }

    // 4) Activity in circles the user belongs to
    try {
      const { data: memberships } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", user.id)
        .in("status", ["active", "approved"])
        .limit(100)
      const circleIds = (memberships || []).map((m) => m.circle_id)
      if (circleIds.length) {
        let postsQuery = supabase
          .from("circle_posts")
          .select(
            `id, title, content, created_at, circle_id,
             author:profiles!author_id(username, display_name),
             circle:circles!circle_id(id, name)`,
          )
          .in("circle_id", circleIds)
          .neq("author_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20)
        if (since) postsQuery = postsQuery.gt("created_at", since.toISOString())
        const { data: posts } = await postsQuery
        const freshPosts = (posts || []).filter(
          (p: any) => !since || new Date(p.created_at).getTime() > since.getTime(),
        )
        if (freshPosts.length) {
          const post = freshPosts[0]
          const circle = Array.isArray(post.circle) ? post.circle[0] : post.circle
          const author = Array.isArray(post.author) ? post.author[0] : post.author
          items.push({
            kind: "circle",
            title: `Your Circle is active`,
            detail:
              freshPosts.length === 1
                ? `@${author?.username || "someone"} posted in ${circle?.name || "a circle you joined"}`
                : `${freshPosts.length} new posts in ${circle?.name || "your circles"} — latest from @${author?.username || "someone"}`,
            href: `/circles/${post.circle_id}`,
            icon: "circle",
          })
        }
      }
    } catch (err) {
      console.warn("recap circles:", err)
    }

    // 5) Pending co-loop invitations
    try {
      const { data: invites } = await supabase
        .from("invitations")
        .select("id, created_at, inviter:profiles!invitations_inviter_id_fkey(username, display_name)")
        .eq("invitee_id", user.id)
        .eq("status", "pending")
        .limit(10)
      if ((invites || []).length) {
        const inviter =
          (Array.isArray(invites![0].inviter) ? invites![0].inviter[0] : invites![0].inviter) || {}
        items.push({
          kind: "co_loop",
          title: "You've been invited to collaborate",
          detail: `@${inviter.username || "someone"} invited you to join a Co-Loop`,
          href: "/co-loop",
          icon: "co_loop",
        })
      }
    } catch (err) {
      console.warn("recap invites:", err)
    }

    return NextResponse.json({
      success: true,
      since: since ? since.toISOString() : null,
      count: items.length,
      items,
    })
  } catch (error: any) {
    console.error("Recap error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
