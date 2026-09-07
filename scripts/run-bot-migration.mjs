// One-off migration runner for the Loop Bot System + profile pronouns.
//
// Usage:
//   node scripts/run-bot-migration.mjs "postgresql://postgres.cgtjjowhlyyrfljarfgd:PASSWORD@aws-1-eu-west-3.pooler.supabase.com:6543/postgres"
//
// Safe to re-run — every statement is idempotent (IF NOT EXISTS).

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const connectionString = process.argv[2]
if (!connectionString) {
  console.error("Usage: node scripts/run-bot-migration.mjs \"<postgres connection string>\"")
  process.exit(1)
}

const files = [
  "bot-system-schema.sql",
  "profile-pronouns-schema.sql",
]

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

async function run() {
  await client.connect()
  console.log("Connected to Supabase Postgres.\n")
  for (const file of files) {
    const path = join(__dirname, file)
    const sql = readFileSync(path, "utf8")
    // Strip comment lines first so statements that START with a comment block
    // (e.g. "-- 1. Bots …\nCREATE TABLE …") are not mistaken for comments.
    const cleaned = sql
      .split(/\n/)
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
    // Split on the statement separator used in the schema files.
    const statements = cleaned
      .split(/;\s*(?:\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    console.log(`→ ${file}: ${statements.length} statements`)
    for (const stmt of statements) {
      try {
        await client.query(stmt)
        console.log("  ✓ ok")
      } catch (err) {
        console.error("  ✗ failed:", err.message)
      }
    }
    console.log("")
  }
  console.log("Migration complete.")
}

run()
  .catch((err) => {
    console.error("Migration aborted:", err.message)
    process.exitCode = 1
  })
  .finally(() => client.end())