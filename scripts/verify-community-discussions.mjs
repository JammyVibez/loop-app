// Read-only verification for the discussion-first community home.
//
// Confirms the migrated columns exist on the live database and that the exact
// queries /api/communities/[id]/discussions runs against it are accepted by
// PostgREST. Nothing is written, so it is safe to run at any time.
import pg from "pg"
import { createClient } from "@supabase/supabase-js"

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!databaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required.")
  process.exit(1)
}
if (!supabaseUrl || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and a Supabase key are required.")
  process.exit(1)
}

let failures = 0
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
await client.connect()

// ── 1. Columns the redesign depends on ──
const { rows: columns } = await client.query(`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (
      (table_name = 'circle_posts' AND column_name IN ('post_type','content_metadata','last_activity_at','feed_loop_id'))
      OR (table_name = 'circle_coloop_sessions' AND column_name IN ('discussion_post_id','published_loop_id'))
      OR (table_name = 'loop_duels' AND column_name = 'circle_post_id')
      OR (table_name = 'loops' AND column_name = 'circle_id')
      OR (table_name = 'circle_posts' AND column_name IN ('comments_locked','hidden_at','hidden_by'))
      OR (table_name = 'circle_post_comments' AND column_name IN ('hidden_at','hidden_by'))
    )
`)
const found = new Set(columns.map((r) => `${r.table_name}.${r.column_name}`))
for (const needed of [
  "circle_posts.post_type",
  "circle_posts.content_metadata",
  "circle_posts.last_activity_at",
  "circle_posts.feed_loop_id",
  "circle_coloop_sessions.discussion_post_id",
  "circle_coloop_sessions.published_loop_id",
  "loop_duels.circle_post_id",
  "loops.circle_id",
  "circle_posts.comments_locked",
  "circle_posts.hidden_at",
  "circle_posts.hidden_by",
  "circle_post_comments.hidden_at",
  "circle_post_comments.hidden_by",
]) {
  check(`column ${needed}`, found.has(needed))
}

// The moderation panel reads reports + the reported content itself.
try {
  await client.query("SELECT 1 FROM community_reports LIMIT 1")
  check("community_reports table", true)
} catch (e) {
  check("community_reports table", false, String(e?.message || e))
}
try {
  await client.query("SELECT count(*)::int AS n FROM circle_posts WHERE status = 'hidden'")
  check("circle_posts accepts the 'hidden' status", true)
} catch (e) {
  check("circle_posts accepts the 'hidden' status", false, String(e?.message || e))
}

// ── 2. The reply-activity trigger ──
const { rows: trigger } = await client.query(`
  SELECT tgname FROM pg_trigger WHERE tgname = 'trg_bump_discussion_activity'
`)
check("trigger trg_bump_discussion_activity", trigger.length > 0)

// ── 3. The exact PostgREST queries the endpoint issues ──
const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

const { data: circle, error: circleErr } = await sb
  .from("circles")
  .select("id, name, handle, is_private, is_active")
  .eq("is_active", true)
  .limit(1)
  .maybeSingle()
check("circles select", !circleErr, circleErr?.message)
check("a live circle exists to test with", Boolean(circle))

if (circle) {
  const { error: postsErr } = await sb
    .from("circle_posts")
    .select(
      `id, author_id, content, media_url, media_urls, media_type, post_type, content_metadata,
       space_id, is_pinned, comment_count, like_count, share_count, status,
       created_at, updated_at, last_activity_at, feed_loop_id,
       author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, badge_id, equipped_frame_id),
       space:community_spaces!space_id(id, name, icon, type)`,
    )
    .eq("circle_id", circle.id)
    .or("status.is.null,status.eq.published")
    .order("is_pinned", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .limit(5)
  check("circle_posts discussion select", !postsErr, postsErr?.message)

  const { error: loopsErr } = await sb
    .from("loops")
    .select(
      `id, author_id, content, content_text, content_title, media_url, media_urls, content_type, post_type,
       visibility, created_at, updated_at, content_metadata,
       author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium, badge_id),
       loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)`,
    )
    .eq("circle_id", circle.id)
    .order("created_at", { ascending: false })
    .limit(5)
  check("community loops select", !loopsErr, loopsErr?.message)

  const { error: spacesErr } = await sb
    .from("community_spaces")
    .select("id, name, icon, type, sort_order")
    .eq("circle_id", circle.id)
    .eq("is_archived", false)
    .order("sort_order")
  check("community_spaces topic select", !spacesErr, spacesErr?.message)

  // Moderation panel: reports joined with author profiles.
  const { error: reportsErr } = await sb
    .from("community_reports")
    .select(
      `*, reporter:profiles!reporter_id(id, username, display_name, avatar_url), target_author:profiles!target_author_id(id, username, display_name, avatar_url)`,
    )
    .eq("circle_id", circle.id)
    .order("created_at", { ascending: false })
    .limit(5)
  check("moderation reports select", !reportsErr, reportsErr?.message)

  // The reported content lookup uses the new hidden / lock columns.
  const { error: commentErr } = await sb
    .from("circle_post_comments")
    .select("id, content, post_id, hidden_at, author:profiles!author_id(id, username, display_name, avatar_url)")
    .is("hidden_at", null)
    .limit(5)
  check("visible replies select (hidden filtered)", !commentErr, commentErr?.message)

  // Hidden discussions must stay out of the community home query.
  const { error: visiblePostsErr } = await sb
    .from("circle_posts")
    .select("id, status, comments_locked, hidden_at")
    .eq("circle_id", circle.id)
    .or("status.is.null,status.eq.published")
    .limit(5)
  check("published-only discussions select", !visiblePostsErr, visiblePostsErr?.message)
}

await client.end()
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
