import pg from "pg"
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
const { rows } = await client.query(
  `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='loop_duels' ORDER BY ordinal_position`,
)
console.log(rows.map((r) => `${r.column_name}:${r.data_type}`).join(", "))
await client.end()
