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
    if (!(m[1] in process.env)) process.env[m[1]] = m[2]
  }
} catch { /* no .env.local */ }

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

const res = await client.query(
  `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public' AND p.proname IN (
     'increment_loop_comments','decrement_loop_comments','increment_loop_likes','decrement_loop_likes',
     'increment_loop_shares','increment_loop_views','decrement_circle_member_count'
   ) ORDER BY p.proname`,
)
console.log("RPCs present:", res.rows.map((r) => r.proname).join(", "))

const cols = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='loops' AND column_name IN ('comment_count','like_count','share_count','view_count','branch_count')`,
)
console.log("loops denorm cols:", cols.rows.map((r) => r.column_name).join(", "))

await client.end()
