import pg from "pg"

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
const { rows } = await c.query(
  `select id, content_text from loops
    where coalesce(visibility,'public') = 'public' and parent_loop_id is null
    order by created_at desc limit 3`,
)
console.log(rows.map((r) => `${r.id} :: ${String(r.content_text || "").slice(0, 50)}`).join("\n"))
await c.end()
