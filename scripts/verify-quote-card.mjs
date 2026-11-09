/**
 * Read-only check for the embedded quote card.
 *
 *   node scripts/verify-quote-card.mjs
 *
 * Runs the exact PostgREST selection the card's API uses and asserts the
 * fields the richer card renders (stats, tags, multi-media, author badges)
 * actually come back for a real quote, then confirms the notifications table
 * accepts the new `quote` type without a constraint rejecting it.
 */
import pg from "pg"
import { createClient } from "@supabase/supabase-js"

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await db.connect()

let failures = 0
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

const { rows: quotes } = await db.query(
  `select id, quoted_loop_id from loops where quoted_loop_id is not null order by created_at desc limit 3`,
)
check("real quote posts exist to test with", quotes.length > 0, `${quotes.length} found`)

const ids = quotes.map((q) => q.quoted_loop_id)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const { data, error } = await supabase
  .from("loops")
  .select(`
        id, author_id, content_text, content_title, content_type, content_media_url, media_url, media_type,
        visibility, circle_id, created_at, hashtags, quote_count, content_metadata,
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count),
        author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, is_team_member, is_deleted, deletion_executed_at, is_banned)
      `)
  .in("id", ids)

check("quote card selection is valid against the live schema", !error, error?.message || "")
check("quoted posts come back", (data || []).length > 0, `${(data || []).length} rows`)

for (const row of data || []) {
  const stats = Array.isArray(row.loop_stats) ? row.loop_stats[0] : row.loop_stats
  check(`stats present for ${row.id}`, Boolean(stats), JSON.stringify(stats || null))
  check(
    `hashtags + quote count present for ${row.id}`,
    Array.isArray(row.hashtags) && row.quote_count !== undefined,
    `tags=${JSON.stringify(row.hashtags || [])} quotes=${row.quote_count}`,
  )
  check(`author identity present for ${row.id}`, Boolean(row.author?.username), row.author?.username || "")
}

// The notification writer inserts `type: "quote"`; make sure no CHECK
// constraint on the table can reject that value.
const { rows: constraints } = await db.query(
  `select conname, pg_get_constraintdef(oid) def
     from pg_constraint
    where conrelid = 'public.notifications'::regclass and contype = 'c'`,
)
const typeConstraint = constraints.find((c) => /type/i.test(c.def))
check(
  "notifications.type accepts the new quote type",
  !typeConstraint || /quote/i.test(typeConstraint.def),
  typeConstraint ? typeConstraint.def : "no type constraint",
)

await db.end()
console.log(failures === 0 ? "\nAll quote-card checks passed." : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
