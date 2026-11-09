import pg from "pg"
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const { rows } = await c.query(
  `select q.id, q.content_text, q.quoted_loop_id, p.username, p.display_name
     from loops q join profiles p on p.id = q.author_id
    where q.quoted_loop_id is not null order by q.created_at desc limit 5`,
)
console.log(rows.map((r) => `${r.id} :: @${r.username} (${r.display_name}) quotes ${r.quoted_loop_id} :: ${String(r.content_text).slice(0, 60)}`).join("\n") || "(none found)")
await c.end()
