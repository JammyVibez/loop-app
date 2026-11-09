import pg from "pg"
const { Client } = pg
const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
const { rows } = await client.query(`
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema='public'
    AND (table_name = 'circles' OR table_name LIKE 'circle_%' OR table_name LIKE 'community_%')
  ORDER BY table_name, ordinal_position
`)
const byTable = {}
for (const r of rows) {
  ;(byTable[r.table_name] ||= []).push(r)
}
for (const [t, cols] of Object.entries(byTable)) {
  const { rows: c } = await client.query(`SELECT count(*)::int n FROM "${t}"`)
  console.log(`\n=== ${t}  (${c[0].n} rows) ===`)
  console.log(cols.map((x) => `${x.column_name}:${x.data_type}${x.is_nullable === "NO" ? "!" : ""}`).join(", "))
}
await client.end()
