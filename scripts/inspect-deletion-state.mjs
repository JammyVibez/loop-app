import pg from "pg"

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
for (const t of ["admin_account_deletions", "account_deletions"]) {
  const { rows } = await c.query(`select count(*)::int as n from ${t}`)
  console.log(t, rows[0].n)
}
const { rows } = await c.query(
  "select id, username, is_admin, is_deleted, deletion_executed_at, is_banned from profiles order by created_at desc limit 8",
)
console.log(rows)
const { rows: admins } = await c.query("select id, username from profiles where is_admin = true")
console.log("admins:", admins)
await c.end()
