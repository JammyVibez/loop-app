/**
 * Scoped Community data wipe — scope A only: the Community-OWNED tables
 * (circles / circle_* / community_*). Nothing else is deleted.
 *
 *   node scripts/community-wipe.mjs --plan      dry run: FK order, blockers, counts
 *   node scripts/community-wipe.mjs --execute   fresh backup -> scoped DELETE -> verify
 *
 * Safety rules:
 *  - Never TRUNCATE, never a blanket reset, never touches a shared table.
 *  - Refuses to run if any table outside scope references a Community table
 *    with live rows (that would force deleting shared data).
 *  - A fresh full-row backup is written first and re-read for row counts
 *    before a single DELETE runs.
 *  - Non-community row counts are snapshotted before and after and must match.
 */
import fs from "node:fs"
import path from "node:path"
import pg from "pg"

const { Client } = pg

const BACKUP_ROOT = path.join(process.cwd(), "backups", "community-wipe")
const isCommunityOwned = (t) => /^(circles$|circle_|community_)/.test(t)

const mode = process.argv.includes("--execute") ? "execute" : "plan"

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await client.connect()

  const { rows: tableRows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name
  `)
  const allTables = tableRows.map((r) => r.table_name)
  const communityTables = allTables.filter(isCommunityOwned)
  const sharedTables = allTables.filter((t) => !isCommunityOwned(t))

  // ── counts ──
  const counts = {}
  for (const t of allTables) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${t}"`)
    counts[t] = rows[0].n
  }
  const scopeCount = communityTables.reduce((s, t) => s + counts[t], 0)

  // ── foreign keys (pg_catalog: exact, no phantom edges) ──
  const { rows: fks } = await client.query(`
    SELECT rel.relname AS child, conf.relname AS parent,
           a.attname AS child_col
    FROM pg_constraint con
    JOIN pg_class rel   ON rel.oid = con.conrelid
    JOIN pg_class conf  ON conf.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace AND n.nspname = 'public'
    JOIN unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord) ON TRUE
    JOIN unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord = ck.ord
    JOIN pg_attribute a  ON a.attrelid = con.conrelid  AND a.attnum = ck.attnum
    WHERE con.contype = 'f'
  `)

  const inScope = new Set(communityTables)
  // Self-references (parent_comment_id, reply_to_id) are handled by a plain
  // table DELETE, so they are not ordering edges.
  const edges = fks.filter((f) => f.child !== f.parent && inScope.has(f.child) && inScope.has(f.parent))

  // Live references from OUTSIDE the scope would block the wipe. Counted per
  // column, so a nullable FK with no values is not a blocker.
  const blockers = []
  for (const f of fks) {
    if (!inScope.has(f.parent) || inScope.has(f.child)) continue
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM "${f.child}" WHERE "${f.child_col}" IS NOT NULL`,
    )
    if (rows[0].n > 0) blockers.push({ table: f.child, column: f.child_col, references: f.parent, rows: rows[0].n })
  }

  // ── delete order: children before parents ──
  const remaining = new Set(communityTables)
  const order = []
  for (;;) {
    const ready = [...remaining]
      .filter((t) => !edges.some((e) => e.child === t && remaining.has(e.parent)))
      .sort()
    if (ready.length === 0) break
    for (const t of ready) {
      remaining.delete(t)
      order.push(t)
    }
  }
  const cyclic = [...remaining].sort()

  console.log(`\nWIPE SCOPE A — Community-owned tables (${communityTables.length} tables, ${scopeCount} rows)`)
  console.log(`Delete order (${order.length} tables, children first):`)
  console.log(`  ${order.join("\n  ")}`)
  if (cyclic.length) console.log(`\nFK cycle (needs manual handling): ${cyclic.join(", ")}`)
  if (blockers.length) {
    console.log("\nOut-of-scope rows still referencing Community tables (these BLOCK a scope-A wipe):")
    for (const b of blockers) console.log(`  ${b.table}.${b.column} -> ${b.references}  (${b.rows} rows)`)
  } else {
    console.log("\nNo out-of-scope table references a Community table with live rows.")
  }
  console.log(
    `\nUntouched shared/global tables: ${sharedTables.length} (${sharedTables.reduce((s, t) => s + counts[t], 0)} rows)`,
  )

  const abort = (msg) => {
    console.error(`\nABORT: ${msg}`)
    process.exitCode = 1
  }

  if (mode === "plan") {
    if (cyclic.length) return abort(`FK cycle among: ${cyclic.join(", ")}`)
    if (blockers.length) return abort("out-of-scope rows reference Community tables — see list above")
    console.log("\nPlan complete. Nothing was changed. Run with --execute to wipe.")
    return
  }

  // ── execute ──
  if (cyclic.length) return abort(`FK cycle among: ${cyclic.join(", ")} — refusing to guess`)
  if (blockers.length) return abort("out-of-scope rows reference Community tables — refusing to delete shared data")
  if (order.length !== communityTables.length) return abort("could not order every Community table")

  // 1. Fresh, complete backup of everything about to be deleted.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const dir = path.join(BACKUP_ROOT, `pre-wipe-${stamp}`)
  fs.mkdirSync(dir, { recursive: true })
  let backedUp = 0
  for (const t of order) {
    const { rows } = await client.query(`SELECT * FROM "${t}"`)
    if (rows.length !== counts[t]) return abort(`${t} changed between counting and backup — aborting`)
    fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify({ table: t, count: rows.length, rows }, null, 2))
    backedUp += rows.length
  }
  console.log(`\nBackup written: ${dir} (${backedUp} rows across ${order.length} tables)`)

  // 2. Scoped delete, one transaction.
  await client.query("BEGIN")
  try {
    let deleted = 0
    for (const t of order) {
      const { rowCount } = await client.query(`DELETE FROM "${t}"`)
      deleted += rowCount
      console.log(`  deleted ${String(rowCount).padStart(5)}  ${t}`)
    }
    await client.query("COMMIT")
    console.log(`\nDeleted ${deleted} rows inside one transaction.`)
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  }

  // 3. Verify: Community tables empty, everything else untouched.
  const problems = []
  for (const t of communityTables) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${t}"`)
    if (rows[0].n !== 0) problems.push(`${t} still has ${rows[0].n} rows`)
  }
  for (const t of sharedTables) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${t}"`)
    if (rows[0].n !== counts[t]) problems.push(`${t} changed ${counts[t]} -> ${rows[0].n} (must not change)`)
  }
  if (problems.length) {
    console.error("\nVERIFICATION FAILED:")
    for (const p of problems) console.error(`  ${p}`)
    return abort("verification failed")
  }
  console.log(
    `\nVERIFIED: all ${communityTables.length} Community tables are empty; all ${sharedTables.length} shared/global tables unchanged.`,
  )
  console.log(`Backup for restore: ${dir}`)
}

main()
  .catch((err) => {
    console.error(`\nABORT: ${err.message}`)
    process.exitCode = 1
  })
  .finally(() => client.end().catch(() => {}))
