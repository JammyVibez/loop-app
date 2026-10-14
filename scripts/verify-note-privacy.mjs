/**
 * Verification helper for note privacy: finds profiles whose visibility is
 * restricted, seeds a note for one, and confirms an anonymous read of the
 * profile surface returns nothing while a public profile's note still comes
 * back. Cleans up its own row. Re-run safe.
 *
 * Usage: node scripts/verify-note-privacy.mjs
 */
import pg from "pg"

const client = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL })
await client.connect()

const { rows: restricted } = await client.query(
  `SELECT id, username, privacy_settings->>'profile_visibility' AS visibility
   FROM profiles
   WHERE is_deleted = false
     AND username IS NOT NULL
     AND (privacy_settings->>'profile_visibility') IN ('private', 'followers')
   LIMIT 5`,
)

const { rows: open } = await client.query(
  `SELECT id, username FROM profiles
   WHERE is_deleted = false AND username IS NOT NULL
     AND (privacy_settings->>'profile_visibility' IS NULL
          OR privacy_settings->>'profile_visibility' = 'public')
   LIMIT 1`,
)

let failed = 0
const base = "https://loopapp.me/api/profile-note"

async function seed(userId) {
  await client.query("DELETE FROM profile_notes WHERE user_id = $1", [userId])
  await client.query(
    `INSERT INTO profile_notes (user_id, content, show_on_profile, show_on_posts, show_on_communities, expires_at)
     VALUES ($1, 'privacy check note', true, true, true, NOW() + INTERVAL '2 hours')`,
    [userId],
  )
}

async function read(username, surface) {
  const res = await fetch(`${base}?username=${encodeURIComponent(username)}&surface=${surface}`)
  const data = await res.json().catch(() => ({}))
  return { status: res.status, note: data?.note?.content || null }
}

// Public profile's note must be visible to anyone.
if (open.length) {
  const { id, username } = open[0]
  await seed(id)
  const { note } = await read(username, "profile")
  const ok = note === "privacy check note"
  if (!ok) failed++
  console.log(`${ok ? "OK  " : "BAD "} public profile note visible to anon -> ${JSON.stringify(note)}`)
} else {
  console.log("SKIP no public profile found")
}

// Restricted profile's note must be hidden from an anonymous reader.
if (restricted.length) {
  const { id, username, visibility } = restricted[0]
  await seed(id)
  const { note } = await read(username, "profile")
  const ok = note === null
  if (!ok) failed++
  console.log(`${ok ? "OK  " : "BAD "} ${visibility} profile note hidden from anon -> ${JSON.stringify(note)}`)
} else {
  console.log("SKIP no private/followers profile found")
}

for (const row of [...restricted, ...(open.length ? [open[0]] : [])]) {
  await client.query("DELETE FROM profile_notes WHERE user_id = $1", [row.id])
}
const { rows: left } = await client.query("SELECT count(*)::int AS n FROM profile_notes WHERE content = 'privacy check note'")
console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`} — test rows left: ${left[0].n}`)
await client.end()
if (failed) process.exitCode = 1
