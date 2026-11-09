import pg from "pg"

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

const { rows } = await c.query(
  `SELECT tc.table_name, kcu.column_name, rc.delete_rule
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     JOIN information_schema.referential_constraints rc
       ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'loops'
    ORDER BY tc.table_name, kcu.column_name`,
)
console.log("loops FKs:", rows)

const { rows: cols } = await c.query(
  `select table_name, column_name from information_schema.columns
    where table_schema='public' and column_name in ('loop_id','parent_loop_id','post_id')
    order by table_name`,
)
console.log("loop-ish columns:", cols)

await c.end()
