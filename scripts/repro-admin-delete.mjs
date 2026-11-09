import pg from "pg"

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

console.log("session FKs:", (await c.query(
  `select tc.table_name, kcu.column_name, ccu.table_name as ref, rc.delete_rule
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
     join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
     join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY' and (ccu.table_name = 'user' or tc.table_name = 'user')`,
)).rows)

console.log("profiles FKs -> user:", (await c.query(
  `select count(*)::int n from information_schema.table_constraints tc
     join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.constraint_type='FOREIGN KEY' and tc.table_name='profiles'`,
)).rows)

const { rows } = await c.query(`select id, username, email from profiles where username = 'than2'`)
console.log("target:", rows)

await c.query("begin")
try {
  const u = await c.query(
    `select u.id from "user" u join profiles p on p.email = u.email where p.username = 'than2'`,
  )
  console.log("auth users for target:", u.rows)
  if (u.rows[0]) {
    const s = await c.query(`delete from session where "userId" = $1`, [u.rows[0].id])
    console.log("sessions deleted:", s.rowCount)
  }
  const del = await c.query(`delete from "user" u using profiles p where p.email = u.email and p.username = 'than2'`)
  console.log("user row deleted:", del.rowCount)
} catch (e) {
  console.log("DELETE FAILED:", e.message)
} finally {
  await c.query("rollback")
}
await c.end()
