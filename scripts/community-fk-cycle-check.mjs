/** Read-only: foreign keys whose parent and child are both Community-owned. */
import pg from "pg"

const { Client } = pg
const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const { rows } = await client.query(`
  SELECT rel.relname AS child_table, a.attname AS child_col,
         conf.relname AS parent_table, af.attname AS parent_col,
         con.conname AS constraint_name
  FROM pg_constraint con
  JOIN pg_class rel   ON rel.oid = con.conrelid
  JOIN pg_class conf  ON conf.oid = con.confrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace AND n.nspname = 'public'
  JOIN unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord) ON TRUE
  JOIN unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord = ck.ord
  JOIN pg_attribute a  ON a.attrelid = con.conrelid  AND a.attnum = ck.attnum
  JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = fk.attnum
  WHERE con.contype = 'f'
    AND rel.relname   ~ '^(circles$|circle_|community_)'
    AND conf.relname  ~ '^(circles$|circle_|community_)'
  ORDER BY rel.relname, conf.relname
`)

for (const r of rows) {
  const kind = r.child_table === r.parent_table ? "SELF" : r.child_table > r.parent_table ? "mutual?" : "child->parent"
  console.log(
    `${kind.padEnd(10)} ${r.child_table}.${r.child_col} -> ${r.parent_table}.${r.parent_col}  (${r.constraint_name})`,
  )
}
await client.end()
