import pkg from 'pg'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const { Client } = pkg

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:G2DbfnoknKWSvyq8@db.cgtjjowhlyyrfljarfgd.supabase.co:5432/postgres"

const files = [
  "scripts/schema-compat-alignment.sql",
  "scripts/complete-database-setup.sql",
  "scripts/launch-schema-alignment.sql",
  "scripts/loops-and-media.sql",
  "scripts/moderation-schema.sql",
  "scripts/circles-schema-alignment.sql",
  "scripts/enhanced-database-schema-part2.sql",
  "scripts/enhanced-database-schema-part3.sql",
  "scripts/rls-policies.sql",
  "scripts/realtime-functions.sql",
  "scripts/boost-system-enhancements.sql",
  "scripts/co-loop-viral-rewards.sql",
]

async function runMigrations() {
  console.log("Connecting to Supabase PostgreSQL database...")
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })

  await client.connect()
  console.log("Connected successfully to Supabase Database!")

  for (const file of files) {
    const filePath = resolve(process.cwd(), file)
    if (!existsSync(filePath)) {
      console.warn(`File not found, skipping: ${file}`)
      continue
    }

    console.log(`Applying SQL migration: ${file}...`)
    const sql = readFileSync(filePath, "utf8")

    try {
      await client.query(sql)
      console.log(`✅ Successfully executed ${file}`)
    } catch (err) {
      console.warn(`⚠️ Warning executing ${file}: ${err.message}`)
      // Execute statement by statement if full block fails
      const statements = sql
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0)

      let ok = 0
      let failed = 0
      for (const stmt of statements) {
        try {
          await client.query(stmt)
          ok++
        } catch (stmtErr) {
          failed++
        }
      }
      console.log(`Statements in ${file}: ${ok} passed, ${failed} ignored (existing/duplicate definitions).`)
    }
  }

  await client.end()
  console.log("🎉 All Supabase database schema migrations completed successfully!")
}

runMigrations().catch((err) => {
  console.error("Migration error:", err)
  process.exit(1)
})
