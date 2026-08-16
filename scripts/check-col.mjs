// Diagnostic: check a specific column, add if missing.
import pg from "pg"

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const table = process.argv[2]
const column = process.argv[3]
const ddl = process.argv[4] || "TIMESTAMP WITH TIME ZONE"

const { rows } = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
  [table, column],
)
console.log(`${table}.${column}: ${rows.length ? "EXISTS" : "MISSING"}`)

if (!rows.length) {
  try {
    await client.query(`ALTER TABLE public.${table} ADD COLUMN ${column} ${ddl}`)
    console.log("ADDED")
  } catch (err) {
    console.error("FAILED:", err.message)
  }
}

await client.end()
