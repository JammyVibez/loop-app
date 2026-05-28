import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

if (!databaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required to run production setup SQL.")
  process.exit(1)
}

const files = [
  "scripts/complete-database-setup.sql",
  "scripts/launch-schema-alignment.sql",
  "scripts/loops-and-media.sql",
  "scripts/moderation-schema.sql",
  "scripts/circles-schema-alignment.sql",
  "scripts/rls-policies.sql",
  "scripts/realtime-functions.sql",
]

for (const file of files) {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) {
    console.error(`Missing SQL file: ${file}`)
    process.exit(1)
  }

  console.log(`Applying ${file}...`)
  const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", path], {
    stdio: "inherit",
  })

  if (result.status !== 0) {
    console.error(`Failed applying ${file}`)
    process.exit(result.status || 1)
  }
}

if (process.argv.includes("--with-seed")) {
  const seedPath = resolve(process.cwd(), "scripts/seed-data-v2.sql")
  if (existsSync(seedPath)) {
    console.log("Applying scripts/seed-data-v2.sql...")
    const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", seedPath], {
      stdio: "inherit",
    })
    if (result.status !== 0) process.exit(result.status || 1)
  }
}

console.log("Production database setup complete.")
