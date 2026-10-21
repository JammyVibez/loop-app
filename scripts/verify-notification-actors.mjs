import pg from "pg"

/**
 * Confirms every recent notification can be attributed to a real profile.
 * Mirrors the API's resolution order: actor_id column → data.user_id →
 * data.sender_id → data.actor_id.
 */
const c = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

const { rows } = await c.query(`
  SELECT n.type, n.actor_id,
         COALESCE(n.actor_id::text, n.data->>'user_id', n.data->>'sender_id', n.data->>'actor_id') AS resolved_id,
         p.display_name, p.username, n.title
  FROM notifications n
  LEFT JOIN profiles p
    ON p.id::text = COALESCE(n.actor_id::text, n.data->>'user_id', n.data->>'sender_id', n.data->>'actor_id')
  ORDER BY n.created_at DESC
  LIMIT 15
`)

let named = 0
let unnamed = 0
for (const r of rows) {
  const name = r.display_name || r.username
  if (name) named += 1
  else unnamed += 1
  console.log(`${(r.type || "?").padEnd(20)} | actor_id:${r.actor_id ? "yes" : "no "} | ${(name || "(no actor — system)").padEnd(24)} | ${String(r.title || "").slice(0, 36)}`)
}

const { rows: totals } = await c.query(
  `SELECT count(*)::int AS total, count(actor_id)::int AS with_actor,
          count(*) FILTER (WHERE actor_id IS NULL)::int AS without_actor
   FROM notifications`,
)
console.log("\ntotals:", totals[0])
console.log(`resolved names: ${named}, system/no-actor rows: ${unnamed}`)

// A row with an actor must resolve — that is the exact bug that showed "Someone".
const broken = rows.filter((r) => r.resolved_id && !(r.display_name || r.username))
if (broken.length) {
  console.error(`\nFAIL: ${broken.length} notification(s) have an actor id that resolves to no profile`)
  process.exit(1)
}
console.log("\nOK: every notification with an actor resolves to a real name")
await c.end()
