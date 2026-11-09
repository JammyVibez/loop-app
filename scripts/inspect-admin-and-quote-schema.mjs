/**
 * Read-only: reports the columns the admin-delete and quote-rebranch work
 * depends on, plus how many rows are involved. Never writes.
 *
 *   node scripts/inspect-admin-and-quote-schema.mjs
 */
import pg from "pg"

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

async function columns(table) {
  const { rows } = await c.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  )
  return rows
}

for (const table of ["loops", "user", "session", "profiles", "loop_comments", "account_deletions", "admin_account_deletions"]) {
  const rows = await columns(table)
  console.log(`\n== ${table} (${rows.length} columns) ==`)
  console.log(rows.map((r) => r.column_name).join(", ") || "(missing)")
}

console.log("\n== loops: quote/bookmark-ish columns ==")
console.log((await columns("loops")).filter((r) => /quote|repost|parent|branch|deleted|status|visibility|hidden/.test(r.column_name)))

console.log("\n== user: ban-ish columns ==")
console.log((await columns("user")).filter((r) => /ban|delete|disable|role/.test(r.column_name)))

console.log("\n== profiles: deleted rows ==")
const { rows: deleted } = await c.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE deletion_executed_at IS NOT NULL)::int AS executed,
          count(*) FILTER (WHERE is_deleted)::int AS flagged
     FROM profiles`,
)
console.log(deleted[0])

console.log("\n== loops totals ==")
const { rows: loops } = await c.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE parent_loop_id IS NOT NULL)::int AS branches
     FROM loops`,
)
console.log(loops[0])

console.log("\n== FKs pointing at loops.id ==")
const { rows: fks } = await c.query(
  `SELECT tc.table_name, kcu.column_name, rc.delete_rule
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     JOIN information_schema.referential_constraints rc
       ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'loops'
    ORDER BY tc.table_name`,
)
console.log(fks)

await c.end()
