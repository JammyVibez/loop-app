/**
 * Read-only: exact foreign keys pointing at the Community-owned tables, with
 * the live child row count for the specific column. Used to decide whether a
 * scope-A wipe can run without touching shared tables.
 */
import pg from "pg"

const { Client } = pg
const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const { rows } = await client.query(`
  SELECT rel.relname  AS child_table,
         a.attname    AS child_col,
         conf.relname AS parent_table,
         af.attname   AS parent_col,
         con.conname  AS constraint_name
  FROM pg_constraint con
  JOIN pg_class rel   ON rel.oid = con.conrelid
  JOIN pg_class conf  ON conf.oid = con.confrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord) ON TRUE
  JOIN unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord = ck.ord
  JOIN pg_attribute a  ON a.attrelid = con.conrelid  AND a.attnum = ck.attnum
  JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = fk.attnum
  WHERE con.contype = 'f'
    AND n.nspname = 'public'
    AND conf.relname IN ('circles','community_bots','community_roles','circle_members','circle_rooms','circle_posts')
  ORDER BY conf.relname, rel.relname, a.attname
`)

const isCommunity = (t) => /^(circles$|circle_|community_)/.test(t)
const out = []
for (const r of rows) {
  if (isCommunity(r.child_table)) {
    out.push({ ...r, scope: "in-scope", live_rows: null })
    continue
  }
  const { rows: c } = await client.query(
    `SELECT count(*)::int AS n FROM "${r.child_table}" WHERE "${r.child_col}" IS NOT NULL`,
  )
  out.push({ ...r, scope: "OUT-OF-SCOPE", live_rows: c[0].n })
}

console.log(JSON.stringify(out, null, 2))
await client.end()
