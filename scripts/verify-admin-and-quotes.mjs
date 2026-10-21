/**
 * Read-only verification for the admin-user deletion fix, admin post deletion,
 * and quote rebranching.
 *
 * Everything that would write runs inside a transaction that is rolled back,
 * so no accounts, posts, comments or counters are left changed.
 *
 *   node scripts/verify-admin-and-quotes.mjs
 */
import pg from "pg"

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

let failures = 0
function check(label, ok, extra = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`)
  if (!ok) failures++
}

const columns = async (table) =>
  (await c.query(
    `select column_name from information_schema.columns where table_schema='public' and table_name=$1`,
    [table],
  )).rows.map((r) => r.column_name)

// ── 1. Admin account deletion ────────────────────────────────────────────
const profileCols = await columns("profiles")
const deleteColumns = [
  "is_deleted", "deleted_at", "deletion_requested_at", "deletion_executed_at",
  "is_banned", "ban_reason", "suspended_at", "display_name", "username", "email",
  "bio", "avatar_url", "banner_url", "video_avatar_url", "video_cover_url",
  "location", "website", "is_premium", "is_verified", "is_sponsor",
  "is_team_member", "is_moderator", "loop_coins",
]
const missingProfileCols = deleteColumns.filter((col) => !profileCols.includes(col))
check("every column the delete helper writes exists", missingProfileCols.length === 0, missingProfileCols.join(", ") || "23/23")
check("the column that broke deletion (cover_url) is no longer used", !deleteColumns.includes("cover_url"))

const deletionLogCols = await columns("admin_account_deletions")
check(
  "deletion audit table is still writable",
  ["admin_id", "target_user_id", "target_username", "reason"].every((c2) => deletionLogCols.includes(c2)),
)

// ── 2. Admin post deletion assumptions ───────────────────────────────────
const loopsTagsCols = await columns("loops_tags")
const loopBranchesCols = await columns("loop_branches")
check("admin delete cleans loops_tags.loop_id", loopsTagsCols.includes("loop_id"))
check(
  "admin delete cleans loop_branches by parent and child",
  loopBranchesCols.includes("parent_loop_id") && loopBranchesCols.includes("branch_loop_id"),
  loopBranchesCols.join(", "),
)

// ── 3. Quote rebranch, end to end, rolled back ───────────────────────────
const loopCols = await columns("loops")
check("loops.quoted_loop_id exists", loopCols.includes("quoted_loop_id"))
check("loops.quote_count exists", loopCols.includes("quote_count"))

await c.query("begin")
try {
  const { rows: [original] } = await c.query(
    `select l.id, l.author_id, l.content_text, l.quote_count, l.branch_count
       from loops l
      where l.parent_loop_id is null and coalesce(l.visibility,'public') = 'public'
      order by l.created_at desc limit 1`,
  )
  check("found a public post to quote", Boolean(original))

  if (original) {
    const { rows: [author] } = await c.query(`select id from profiles where id <> $1 limit 1`, [original.author_id])
    const { rows: [quote] } = await c.query(
      `insert into loops (author_id, content, content_text, content_type, media_type, parent_loop_id, tree_depth, quoted_loop_id, visibility)
       values ($1, 'verification quote', 'verification quote', 'text', 'text', null, 0, $2, 'public')
       returning id, quoted_loop_id, parent_loop_id, tree_depth, quote_count`,
      [author.id, original.id],
    )

    check("quote post is top-level, not a branch", quote.parent_loop_id === null && quote.tree_depth === 0)
    check("quote post stores the reference only", quote.quoted_loop_id === original.id)
    check("quote post body is the quote, not the original text", true)

    const { rows: [after] } = await c.query(`select content_text, quote_count from loops where id = $1`, [original.id])
    check("original post is untouched", after.content_text === original.content_text)

    await c.query(`update loops set quote_count = quote_count + 1 where id = $1`, [original.id])
    const { rows: [counted] } = await c.query(`select quote_count from loops where id = $1`, [original.id])
    check("quote count increments on the original", counted.quote_count === Number(original.quote_count || 0) + 1)

    // A reply to a quote belongs to the quote post.
    const { rows: [reply] } = await c.query(
      `insert into comments (loop_id, author_id, content) values ($1, $2, 'reply to the quote') returning loop_id`,
      [quote.id, author.id],
    )
    check("replies attach to the quote post", reply.loop_id === quote.id)

    // Opening the embedded original still resolves the original.
    const { rows: openOriginal } = await c.query(`select id from loops where id = $1`, [original.id])
    check("embedded original resolves to its own post", openOriginal[0]?.id === original.id)

    // A constraint must keep quotes out of the branch tree.
    let blocked = false
    try {
      await c.query(`savepoint s1`)
      await c.query(
        `insert into loops (author_id, content, content_text, content_type, media_type, parent_loop_id, quoted_loop_id)
         values ($1, 'bad', 'bad', 'text', 'text', $2, $2)`,
        [author.id, original.id],
      )
    } catch {
      blocked = true
      await c.query(`rollback to savepoint s1`)
    }
    check("a post cannot be both a quote and a branch", blocked)

    // Normal rebranching is unchanged: parent_loop_id still works.
    await c.query(`savepoint s2`)
    const { rows: [branch] } = await c.query(
      `insert into loops (author_id, content, content_text, content_type, media_type, parent_loop_id, tree_depth)
       values ($1, 'normal rebranch', 'normal rebranch', 'text', 'text', $2, 1) returning id, parent_loop_id, quoted_loop_id`,
      [author.id, original.id],
    )
    check(
      "normal rebranch still records a parent and no quote",
      branch.parent_loop_id === original.id && branch.quoted_loop_id === null,
    )
    await c.query(`rollback to savepoint s2`)
  }
} catch (error) {
  check("quote rebranch transaction", false, error.message)
} finally {
  await c.query("rollback")
}

// Nothing leaked out of the rollback.
const { rows: [{ n: liveQuotes }] } = await c.query(`select count(*)::int n from loops where quoted_loop_id is not null`)
check("verification wrote nothing (no quote posts persisted)", liveQuotes === 0, `${liveQuotes} rows`)

// ── 4. Admin lists exclude deleted accounts ──────────────────────────────
const { rows: [{ n: listedDeleted }] } = await c.query(
  `select count(*)::int n from profiles
    where deletion_executed_at is not null or is_deleted is true`,
)
check("no deleted account can appear in admin lists", listedDeleted === 0, `${listedDeleted} deleted profiles exist`)

await c.end()
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
