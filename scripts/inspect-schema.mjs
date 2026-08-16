// Diagnostic: lists live columns for the tables this feature set touches.
// Prints column names/types only — never connection strings or secrets.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import pg from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))

try {
  const envPath = join(__dirname, "..", ".env.local")
  const envRaw = readFileSync(envPath, "utf8")
  for (const line of envRaw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let value = m[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(m[1] in process.env)) process.env[m[1]] = value
  }
} catch { /* no .env.local */ }

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL
if (!dbUrl) {
  console.error("DATABASE_URL not found")
  process.exit(1)
}
const masked = dbUrl.replace(/\/\/[^@]+@/, "//***:***@")
console.log("URL shape:", masked)

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
try {
  await client.connect()
  console.log("Connected OK")
} catch (err) {
  console.error("Connect failed:", err.message)
  process.exit(1)
}

const tables = [
  "profiles",
  "messages",
  "conversations",
  "conversation_participants",
  "circles",
  "circle_members",
  "circle_posts",
  "loops",
  "comments",
  "loop_interactions",
  "loop_stats",
  "follow_requests",
  "notifications",
  "subscriptions",
]

for (const table of tables) {
  const res = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table],
  )
  if (res.rows.length === 0) {
    console.log(`\n== ${table}: DOES NOT EXIST`)
    continue
  }
  console.log(`\n== ${table}:`)
  console.log(res.rows.map((r) => `  ${r.column_name} ${r.data_type}`).join("\n"))
}

const candidates = [
  "awards",
  "user_awards",
  "award_definitions",
  "moments",
  "circle_rooms",
  "circle_room_members",
  "subscription_plans",
]
for (const table of candidates) {
  const res = await client.query(
    `SELECT to_regclass('public.' || quote_ident($1)) IS NOT NULL AS exists`,
    [table],
  )
  console.log(`${table}: ${res.rows[0].exists ? "EXISTS" : "missing"}`)
}

await client.end()
