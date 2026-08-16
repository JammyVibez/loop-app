// Applies scripts/awards-pro-circle-moments-schema.sql to Supabase.
// Usage: node scripts/apply-awards-pro-circle-moments.mjs
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import pg from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local if present so the script can run without inlining secrets.
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
} catch { /* no .env.local — fall through to process env */ }

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required (set it in .env.local or the environment)")
  process.exit(1)
}

const sql = readFileSync(join(__dirname, "awards-pro-circle-moments-schema.sql"), "utf8")

/** Split SQL on top-level semicolons, respecting dollar-quoted blocks, single-quoted
 *  strings, double-quoted identifiers, and line comments. */
function splitStatements(input) {
  const statements = []
  let current = ""
  let i = 0
  const n = input.length
  while (i < n) {
    const ch = input[i]
    const rest = input.slice(i)

    if (ch === "-" && input[i + 1] === "-") {
      const end = input.indexOf("\n", i)
      const stop = end === -1 ? n : end + 1
      current += input.slice(i, stop)
      i = stop
      continue
    }

    if (ch === "$") {
      const m = rest.match(/^\$[A-Za-z_0-9]*\$/)
      if (m) {
        const tag = m[0]
        const close = rest.indexOf(tag, tag.length)
        const stop = close === -1 ? n : i + close + tag.length
        current += input.slice(i, stop)
        i = stop
        continue
      }
    }

    if (ch === "'") {
      let j = i + 1
      while (j < n) {
        if (input[j] === "\\") j += 2
        else if (input[j] === "'") {
          if (input[j + 1] === "'") j += 2
          else { j++; break }
        } else j++
      }
      current += input.slice(i, j)
      i = j
      continue
    }

    if (ch === '"') {
      let j = i + 1
      while (j < n && input[j] !== '"') j++
      current += input.slice(i, Math.min(j + 1, n))
      i = Math.min(j + 1, n)
      continue
    }

    if (ch === ";") {
      statements.push(current.trim())
      current = ""
      i++
      continue
    }

    current += ch
    i++
  }
  if (current.trim()) statements.push(current.trim())
  return statements.filter((s) => s.length > 0)
}

const client = new pg.Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 15_000,
  statement_timeout: 60_000,
})

const statements = splitStatements(sql)
console.log("statements:", statements.length)

try {
  await client.connect()
  let ok = 0
  let failed = 0
  for (let idx = 0; idx < statements.length; idx++) {
    const statement = statements[idx]
    const head = statement.slice(0, 70).replace(/\s+/g, " ")
    try {
      await client.query(statement)
      ok++
      console.log(`[${idx + 1}/${statements.length}] ok — ${head}…`)
    } catch (err) {
      failed++
      console.error(`[${idx + 1}/${statements.length}] FAIL — ${head}…\n→ ${err.message}`)
    }
  }
  console.log(`\nDone. ${ok} applied, ${failed} failed.`)

  // Verify
  const tables = ["awards", "user_awards", "moments"]
  for (const t of tables) {
    const res = await client.query(
      `SELECT to_regclass('public.' || quote_ident($1)) IS NOT NULL AS exists`,
      [t],
    )
    console.log(`${t}: ${res.rows[0].exists ? "EXISTS" : "missing"}`)
  }
  const col = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='circles' AND column_name='is_premium_only'`,
  )
  console.log(`circles.is_premium_only: ${col.rows.length ? "EXISTS" : "missing"}`)
  const trig = await client.query(
    `SELECT tgname FROM pg_trigger WHERE tgname='trg_sync_pro_circle_membership'`,
  )
  console.log(`trigger trg_sync_pro_circle_membership: ${trig.rows.length ? "EXISTS" : "missing"}`)
  await client.end()
} catch (err) {
  console.error("Fatal:", err.message)
  process.exit(1)
}
