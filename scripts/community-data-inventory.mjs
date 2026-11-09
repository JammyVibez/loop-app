/**
 * Community data inventory (read-only).
 *
 * Answers three questions before any wipe is proposed:
 *   1. Which tables are Community-only (owned by the Communities feature)?
 *   2. Which *shared* tables hold community-scoped rows (a circle_id /
 *      community_id column), and how many of those rows exist?
 *   3. What belongs to the rest of Loop (accounts, global feed, DMs) and must
 *      never be touched.
 *
 * It only SELECTs. It writes a JSON report (and, with --backup, full row
 * exports) and never deletes or mutates anything.
 *
 *   node scripts/community-data-inventory.mjs           # counts only
 *   node scripts/community-data-inventory.mjs --backup  # counts + full export
 */
import fs from "node:fs"
import path from "node:path"
import pg from "pg"

const { Client } = pg

const BACKUP_DIR = path.join(process.cwd(), "backups", "community-wipe")
const doBackup = process.argv.includes("--backup")

/** Tables that exist only for the Communities feature. */
const isCommunityOwned = (name) => /^(circles$|circle_|community_)/.test(name)

/** Rows in a shared table are community-scoped when this column is set. */
const SCOPE_COLUMNS = ["circle_id", "community_id"]

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!connectionString) {
    console.error("No DATABASE_URL / SUPABASE_DB_URL in the environment.")
    process.exit(1)
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    const { rows: tables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    const owned = []   // Community-only tables
    const shared = []  // global tables with community-scoped rows
    const global = []  // untouched application tables

    for (const { table_name: t } of tables) {
      const { rows: cols } = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [t],
      )
      const colNames = cols.map((c) => c.column_name)
      const scopeCol = SCOPE_COLUMNS.find((c) => colNames.includes(c)) || null

      if (isCommunityOwned(t)) {
        const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${t}"`)
        owned.push({ table: t, rows: rows[0].n, scope_column: null })
      } else if (scopeCol) {
        const { rows } = await client.query(
          `SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE "${scopeCol}" IS NOT NULL)::int AS scoped
           FROM "${t}"`,
        )
        if (rows[0].scoped > 0) {
          shared.push({ table: t, rows: rows[0].scoped, total_rows: rows[0].total, scope_column: scopeCol })
        } else {
          global.push({ table: t, rows: rows[0].total, note: "no community-scoped rows" })
        }
      } else {
        const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${t}"`)
        global.push({ table: t, rows: rows[0].n })
      }
    }

    const report = {
      generated_at: new Date().toISOString(),
      mode: doBackup ? "inventory+backup" : "inventory",
      community_owned_tables: owned,
      shared_tables_with_community_rows: shared,
      untouched_global_tables: global,
      totals: {
        community_owned_rows: owned.reduce((s, r) => s + r.rows, 0),
        community_scoped_rows_in_shared_tables: shared.reduce((s, r) => s + r.rows, 0),
        global_tables: global.length,
      },
    }

    if (doBackup) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
      const exported = []

      const dump = async (table, whereSql, params, label) => {
        const { rows: cnt } = await client.query(
          `SELECT count(*)::int AS n FROM "${table}" ${whereSql}`,
          params,
        )
        if (!cnt[0]?.n) return
        const out = []
        const BATCH = 1000
        let offset = 0
        for (;;) {
          const { rows } = await client.query(
            `SELECT * FROM "${table}" ${whereSql} ORDER BY 1 LIMIT ${BATCH} OFFSET ${offset}`,
            params,
          )
          out.push(...rows)
          if (rows.length < BATCH) break
          offset += BATCH
        }
        const file = path.join(BACKUP_DIR, `${stamp}__${label}.json`)
        fs.writeFileSync(file, JSON.stringify({ table, where: whereSql, params, count: out.length, rows: out }, null, 2))
        exported.push({ table: file, rows: out.length })
      }

      for (const r of owned) await dump(r.table, "", [], r.table)
      for (const r of shared) await dump(r.table, `WHERE "${r.scope_column}" IS NOT NULL`, [], `${r.table}__community-scoped`)

      report.backup = { dir: BACKUP_DIR, files: exported }
      const reportFile = path.join(BACKUP_DIR, `${stamp}__report.json`)
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2))
      console.log(JSON.stringify({ ...report.totals, backup_dir: BACKUP_DIR, files: exported.length, report: reportFile }, null, 2))
    } else {
      const reportFile = path.join(process.cwd(), "backups", "community-wipe", "inventory.json")
      fs.mkdirSync(path.dirname(reportFile), { recursive: true })
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2))
      console.log(JSON.stringify({ ...report.totals, report: reportFile }, null, 2))
      console.log("\nCommunity-only tables:")
      for (const r of owned) console.log(`  ${r.table.padEnd(40)} ${String(r.rows).padStart(8)}`)
      console.log("\nShared tables with community-scoped rows:")
      for (const r of shared) console.log(`  ${r.table.padEnd(40)} ${String(r.rows).padStart(8)} scoped / ${r.total_rows} total (${r.scope_column})`)
      console.log(`\nUntouched global tables: ${global.length}`)
    }
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error("inventory failed:", err.message)
  process.exit(1)
})
