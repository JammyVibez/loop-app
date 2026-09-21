// Backfill: create the missing `profiles` row for every registered account.
//
// The broken `sync_pro_circle_membership` trigger (fixed in
// scripts/fix-pro-circle-membership-trigger.sql) rejected EVERY insert into
// profiles, so 14 registered accounts never got a profile row: invisible in
// the admin dashboard, blocked in onboarding.
//
// For each "user" row without a profiles row:
//   • normal UUID ids  → profile row keyed by the same id
//   • non-UUID ids (e.g. "rkK4NH4rOFXNxNfo4nYTH2gM7gKcP2wf") → profile row
//     keyed by a fresh UUID; lib/server-auth.ts resolves these accounts to it
//     at request time via the email match.
//
// Username uniqueness: base is derived from the account name/email; on
// collision a short numeric suffix is appended. Idempotent — safe to rerun.
//
// Usage: node scripts/backfill-missing-profiles.mjs [--dry-run]
import { randomUUID } from "node:crypto"
import pg from "pg"

const DRY_RUN = process.argv.includes("--dry-run")
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function baseUsername(user) {
  const source = (user.name || user.email?.split("@")[0] || "user").toLowerCase()
  const cleaned = source.replace(/[^a-z0-9_]/g, "").slice(0, 16)
  return cleaned.length >= 3 ? cleaned : `user${cleaned || ""}`
}

async function uniqueUsername(client, base) {
  let candidate = base
  for (let n = 1; n < 100; n++) {
    const { rows } = await client.query("SELECT 1 FROM profiles WHERE username = $1 LIMIT 1", [candidate])
    if (rows.length === 0) return candidate
    candidate = `${base}${n}`
  }
  return `${base}${Date.now().toString(36)}`
}

async function main() {
  const client = await pool.connect()
  try {
    const { rows: orphans } = await client.query(`
      SELECT u.id, u.email, u.name, u."createdAt"
        FROM "user" u
        LEFT JOIN profiles p ON p.id::text = u.id::text
       WHERE p.id IS NULL
       ORDER BY u."createdAt" ASC
    `)

    console.log(`accounts without a profile row: ${orphans.length}${DRY_RUN ? " (dry run)" : ""}`)

    let created = 0
    for (const user of orphans) {
      const profileId = UUID_RE.test(user.id) ? user.id : randomUUID()
      const username = await uniqueUsername(client, baseUsername(user))
      const displayName = user.name?.trim() || username
      const bridged = profileId !== user.id

      if (DRY_RUN) {
        console.log(`[dry] ${user.email} -> ${profileId}${bridged ? " (bridged from non-uuid id)" : ""} @${username}`)
        created++
        continue
      }

      try {
        await client.query(
          `INSERT INTO profiles (id, email, username, display_name, loop_coins, onboarding_completed, has_seen_feature_tour)
           VALUES ($1, $2, $3, $4, 50, false, false)`,
          [profileId, user.email || null, username, displayName],
        )
        console.log(`created ${profileId} @${username} for ${user.email}${bridged ? ` (bridged from "${user.id}")` : ""}`)
        created++
      } catch (err) {
        console.error(`FAILED for ${user.email}:`, err.message)
      }
    }

    const { rows: verify } = await client.query(`
      SELECT (SELECT count(*)::int FROM "user")                                   AS auth_accounts,
             (SELECT count(*)::int FROM profiles)                                 AS profiles,
             (SELECT count(*)::int FROM "user" u LEFT JOIN profiles p ON p.id::text = u.id::text WHERE p.id IS NULL) AS still_missing
    `)
    console.log(`\ncreated ${created} profile rows`)
    console.log(`verify: auth_accounts=${verify[0].auth_accounts} profiles=${verify[0].profiles} still_missing=${verify[0].still_missing}`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
