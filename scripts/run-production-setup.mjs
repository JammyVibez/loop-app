import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

if (!databaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required to run production setup SQL.")
  process.exit(1)
}

const files = [
  "scripts/schema-compat-alignment.sql",
  "scripts/complete-database-setup.sql",
  "scripts/launch-schema-alignment.sql",
  "scripts/loops-and-media.sql",
  "scripts/moderation-schema.sql",
  "scripts/circles-schema-alignment.sql",
  "scripts/enhanced-database-schema-part2.sql",
  "scripts/enhanced-database-schema-part3.sql",
  // Wallet ledger, coin gifts, and withdrawal request tables. Required for the
  // Stripe-backed coin economy (see /api/payments/webhook and /api/wallet/*).
  "scripts/wallet-and-events-schema.sql",
  // developer_projects and related tables backing the real Developers gallery
  // (see /api/developers/projects and components/developers/developers-content.tsx).
  "scripts/developer-features.sql",
  // Durable Co-Loop Studio session ownership + co-author roster (see
  // /api/co-loop/session-info and components/loops/co-loop-studio.tsx).
  "scripts/co-loop-sessions-schema.sql",
  // DM reaction schema fix — see /api/messages/reactions.
  "scripts/message-reactions-schema-fix.sql",
  // Circle multi-media posts, polls, and per-member custom roles/permissions.
  "scripts/circles-enhancements-schema.sql",
  // Dev Quests & bounties — coin-reward challenges in the Developer Hub
  // (see /api/developers/quests and components/developers/developer-quests.tsx).
  "scripts/dev-quests-schema.sql",
  // Developer Hub v2 — realtime for projects/comments/snippets, RLS deletes,
  // and project -> Marketplace listing link.
  "scripts/developer-hub-v2.sql",
  // project_collaborators — RLS policies, realtime, owner backfill + auto-add
  // trigger (see /api/developers/projects/[id]/collaborators).
  "scripts/dev-collaborators-schema.sql",
  // ZIP repo projects — file_tree / repo_zip_url / forked_from_id columns,
  // fork backfill, realtime + RLS (see lib/dev-project-zip.ts).
  "scripts/dev-repo-schema.sql",
  "scripts/rls-policies.sql",
  "scripts/realtime-functions.sql",
]

const ignorable = [
  /already exists/i,
  /duplicate key value/i,
  /multiple primary keys/i,
  /must be owner of/i,
  /policy .* already exists/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /is already a? ?member of publication/i,
  /type .* already exists/i,
  /constraint .* already exists/i,
  /trigger .* already exists/i,
  /cannot change name of type/i,
  /cannot alter type/i,
  /unsafe use of new value/i,
  /cannot change return type of existing function/i,
  /syntax error at or near \"RAISE\"/i,
]

function shouldIgnore(stderr) {
  return ignorable.some((re) => re.test(stderr))
}

function applyFile(file) {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) {
    console.error(`Missing SQL file: ${file}`)
    process.exit(1)
  }

  console.log(`\n=== Applying ${file} ===`)
  // Prefer full-file apply first (faster). On failure, retry statement-by-statement
  // so existing/divergent schemas can still receive the rest of the migration.
  const full = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", path], {
    encoding: "utf8",
  })

  if (full.status === 0) {
    if (full.stdout) process.stdout.write(full.stdout)
    if (full.stderr) process.stderr.write(full.stderr)
    console.log(`OK ${file}`)
    return { applied: 1, skipped: 0, failed: 0 }
  }

  console.warn(`Full apply failed for ${file}; retrying statement-by-statement...`)
  if (full.stderr) process.stderr.write(full.stderr)

  const sql = readFileSync(path, "utf8")
  // Split on semicolons at end of statements while keeping DO $$ ... $$ blocks intact.
  const statements = []
  let buf = ""
  let inDollar = false
  for (const line of sql.split(/\n/)) {
    const trimmed = line.trim()
    if (!inDollar && /\$\$/.test(line)) {
      const count = (line.match(/\$\$/g) || []).length
      inDollar = count % 2 === 1 ? !inDollar : inDollar
      // handle open+close on same line
      if (count === 1) inDollar = true
      if (count >= 2 && trimmed.endsWith("$$;") || (count >= 2 && /\$\$;?\s*$/.test(trimmed) && trimmed.indexOf("$$") !== trimmed.lastIndexOf("$$"))) {
        inDollar = false
      }
    } else if (inDollar && /\$\$/.test(line)) {
      inDollar = false
    }
    buf += line + "\n"
    if (!inDollar && /;\s*$/.test(line)) {
      const stmt = buf.trim()
      if (stmt && !stmt.split("\n").every((l) => !l.trim() || l.trim().startsWith("--"))) {
        statements.push(stmt)
      }
      buf = ""
    }
  }
  if (buf.trim()) statements.push(buf.trim())

  let applied = 0
  let skipped = 0
  let failed = 0

  for (const statement of statements) {
    const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", statement], {
      encoding: "utf8",
    })
    if (result.status === 0) {
      applied += 1
      continue
    }
    const err = `${result.stderr || ""}\n${result.stdout || ""}`
    if (shouldIgnore(err)) {
      skipped += 1
      process.stderr.write(`skip: ${err.split("\n").find((l) => /ERROR:/i.test(l)) || "ignorable error"}\n`)
      continue
    }
    failed += 1
    process.stderr.write(`FAIL in ${file}:\n${err}\n`)
  }

  console.log(`Done ${file}: applied=${applied} skipped=${skipped} failed=${failed}`)
  if (failed > 0) process.exit(1)
  return { applied, skipped, failed }
}

for (const file of files) {
  applyFile(file)
}

if (process.argv.includes("--with-seed")) {
  const seedPath = resolve(process.cwd(), "scripts/seed-data-v2.sql")
  if (existsSync(seedPath)) {
    applyFile("scripts/seed-data-v2.sql")
  }
}

console.log("\nProduction database setup complete.")
