/**
 * Read-only: compact list of foreign keys from tables OUTSIDE the Community
 * wipe scope into Community-owned tables, where the child column still has
 * live rows. Those are the only real blockers for a scope-A wipe.
 */
import pg from "pg"

const { Client } = pg
const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const { rows } = await client.query(`
  SELECT rel.relname AS child_table, a.attname AS child_col,
         conf.relname AS parent_table, con.conname AS constraint_name
  FROM pg_constraint con
  JOIN pg_class rel   ON rel.oid = con.conrelid
  JOIN pg_class conf  ON conf.oid = con.confrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord) ON TRUE
  JOIN unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord = ck.ord
  JOIN pg_attribute a  ON a.attrelid = con.conrelid  AND a.attnum = ck.attnum
  JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = fk.attnum
  WHERE con.contype = 'f' AND n.nspname = 'public'
    AND conf.relname IN ('circles','community_bots')
  ORDER BY conf.relname, rel.relname, a.attname
`)

const isCommunity = (t) => /^(circles$|circle_|community_)/.test(t)
const blockers = []
const clear = []
for (const r of rows) {
  if (isCommunity(r.child_table)) continue
  const { rows: c } = await client.query(
    `SELECT count(*)::int AS n FROM "${r.child_table}" WHERE "${r.child_col}" IS NOT NULL`,
  )
  const line = `${r.child_table}.${r.child_col} -> ${r.parent_table} (${c[0].n} live rows)`
  if (c[0].n > 0) blockers.push(line)
  else clear.push(line)
}

console.log("BLOCKERS (live rows outside scope):")
console.log(blockers.length ? blockers.map((b) => "  " + b).join("\n") : "  none")
console.log("\nNo live rows (safe):")
console.log(clear.length ? clear.map((c) => "  " + c).join("\n") : "  none")
await client.end()
