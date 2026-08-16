// Diagnostic: list all BASE TABLEs in the public schema (ground truth).
import pg from "pg"

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const { rows } = await client.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
)
console.log(rows.map((r) => r.table_name).join(", "))

// Also dump any views named like *_stats / loop_stats (used in .select()).
const { rows: views } = await client.query(
  `SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name ILIKE '%stats%' ORDER BY table_name`,
)
if (views.length) console.log("\nSTATS VIEWS:", views.map((r) => r.table_name).join(", "))

await client.end()
