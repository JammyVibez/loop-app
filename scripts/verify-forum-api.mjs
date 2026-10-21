import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error("Missing Supabase env")
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

const { data: circles, error: circleErr } = await sb.from("circles").select("id, name").limit(3)
if (circleErr) throw circleErr
console.log("circles:", circles?.map((c) => `${c.id}:${c.name}`).join(", "))

let failures = 0
for (const circle of circles || []) {
  const id = circle.id
  const checks = []

  const threads = await sb
    .from("circle_posts")
    .select(
      `id, author_id, content, content_metadata, tags, post_type, space_id, is_pinned,
       comments_locked, comment_count, like_count, view_count, status, created_at, updated_at,
       last_activity_at, feed_loop_id,
       author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, badge_id, equipped_frame_id),
       space:community_spaces!space_id(id, name, icon, type)`,
    )
    .eq("circle_id", id)
    .order("is_pinned", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .limit(5)
  checks.push(["threads+author+space", threads])

  const spaces = await sb
    .from("community_spaces")
    .select("id, name, icon, type, description, sort_order, is_archived")
    .eq("circle_id", id)
    .eq("is_archived", false)
    .order("sort_order")
  checks.push(["forums", spaces])

  const staff = await sb
    .from("circle_members")
    .select(`role, user:profiles!user_id(id, username, display_name, avatar_url, is_verified, is_premium)`)
    .eq("circle_id", id)
    .in("role", ["owner", "admin", "moderator"])
    .in("status", ["active", "approved"])
    .limit(5)
  checks.push(["staff", staff])

  const coloops = await sb
    .from("circle_coloop_sessions")
    .select(`id, session_id, title, description, status, created_by, created_at,
             creator:profiles!created_by(id, username, display_name, avatar_url)`)
    .eq("circle_id", id)
    .order("created_at", { ascending: false })
    .limit(3)
  checks.push(["coloops", coloops])

  const duels = await sb
    .from("loop_duels")
    .select(`id, prompt, status, created_at, expires_at, creator_id,
             creator:profiles!creator_id(id, username, display_name, avatar_url),
             entries:loop_duel_entries(id, side, votes_count)`)
    .eq("circle_id", id)
    .order("created_at", { ascending: false })
    .limit(3)
  checks.push(["duels", duels])

  // Replies for the newest thread, if there is one.
  const threadId = threads.data?.[0]?.id
  if (threadId) {
    const replies = await sb
      .from("circle_post_comments")
      .select(
        `id, post_id, author_id, content, media_url, media_type, parent_comment_id, created_at, updated_at, hidden_at,
         author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, badge_id, equipped_frame_id)`,
      )
      .eq("post_id", threadId)
      .order("created_at", { ascending: true })
      .limit(20)
    checks.push(["replies+author", replies])
  }

  for (const [label, result] of checks) {
    if (result.error) {
      failures += 1
      console.error(`  ✗ ${label}: ${result.error.message}`)
    } else {
      console.log(`  ✓ ${label}: ${result.data?.length ?? 0} rows`)
    }
  }

  // Upvote interactions shape
  const votes = await sb
    .from("circle_post_interactions")
    .select("user_id")
    .eq("interaction_type", "upvote")
    .limit(3)
  if (votes.error) {
    failures += 1
    console.error("  ✗ interactions:", votes.error.message)
  } else {
    console.log(`  ✓ interactions(upvote): ${votes.data?.length ?? 0} sample rows`)
  }
}

console.log(failures === 0 ? "\nALL FORUM QUERIES OK" : `\n${failures} FORUM QUERY FAILURES`)
process.exit(failures === 0 ? 0 : 1)
