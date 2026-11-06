// Applies scripts/loop-post-analytics-schema.sql to the live database.
// Usage: node scripts/apply-loop-post-analytics.mjs
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import pg from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

const sql = readFileSync(join(__dirname, "loop-post-analytics-schema.sql"), "utf8")
const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(sql)
  const { rows } = await client.query(
    `select column_name, data_type from information_schema.columns
      where table_schema='public' and table_name='loop_view_events' order by ordinal_position`,
  )
  console.log("loop_view_events ready:", rows.map((r) => `${r.column_name}:${r.data_type}`).join(", "))
} finally {
  await client.end()
}
