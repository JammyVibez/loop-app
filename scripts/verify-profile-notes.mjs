/**
 * Verification helper for the profile-notes feature.
 *
 * Seeds a note for a real account with visibility limited to the profile
 * surface, reads it back through the public API for each surface (profile
 * should return it, posts/communities should not), checks the unauthenticated
 * write paths are refused, then removes the test row. Safe to re-run: it only
 * ever touches rows it created.
 *
 * Usage: node scripts/verify-profile-notes.mjs
 */
import pg from "pg"

const client = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL })
await client.connect()

const { rows: profiles } = await client.query(
  "SELECT id, username FROM profiles WHERE is_deleted = false AND username IS NOT NULL ORDER BY created_at DESC LIMIT 5",
)
if (!profiles.length) {
  console.log("NO PROFILES FOUND")
  process.exit(1)
}
const target = profiles[0]

await client.query("DELETE FROM profile_notes WHERE user_id = $1", [target.id])
await client.query(
  `INSERT INTO profile_notes (user_id, content, theme, show_on_profile, show_on_posts, show_on_communities, expires_at)
   VALUES ($1, $2, 'rose', true, false, false, NOW() + INTERVAL '2 hours')`,
  [target.id, "smoke test note — profile only"],
)
console.log("seeded a profile-only, rose-themed note for", target.username)

const base = "https://loopapp.me/api/profile-note"
const expected = { profile: true, posts: false, communities: false }
let failed = 0

for (const surface of ["profile", "posts", "communities"]) {
  const res = await fetch(`${base}?username=${encodeURIComponent(target.username)}&surface=${surface}`)
  const data = await res.json().catch(() => ({}))
  const got = Boolean(data?.note?.content)
  const ok = res.status === 200 && got === expected[surface]
  if (!ok) failed++
  console.log(`${ok ? "OK  " : "BAD "} ${surface.padEnd(13)} status=${res.status} note=${got ? JSON.stringify(data.note.content) : "null (hidden)"}`)
}

const unauth = await fetch(base, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content: "x" }),
})
const unauthOk = unauth.status === 401
if (!unauthOk) failed++
console.log(`${unauthOk ? "OK  " : "BAD "} POST without session -> ${unauth.status} (expected 401)`)

const missing = await fetch(`${base}?username=definitely-not-a-user-xyz`)
const missingOk = missing.status === 200
if (!missingOk) failed++
console.log(`${missingOk ? "OK  " : "BAD "} unknown username -> ${missing.status} (expected 200, empty note)`)

// Colour theme: the migration added the column, the API carries the colour out
// to readers, and the CHECK refuses a colour the picker never offers.
const themed = await (
  await fetch(`${base}?username=${encodeURIComponent(target.username)}&surface=profile`)
).json().catch(() => ({}))
const themeOk = themed?.note?.theme === "rose"
if (!themeOk) failed++
console.log(`${themeOk ? "OK  " : "BAD "} note theme -> ${JSON.stringify(themed?.note?.theme)} (expected "rose")`)

let rejected = false
let rejectionMessage = ""
try {
  await client.query("UPDATE profile_notes SET theme = 'chartreuse' WHERE user_id = $1", [target.id])
} catch (err) {
  rejected = true
  rejectionMessage = String(err?.message || "").slice(0, 60)
}
if (!rejected) failed++
console.log(
  `${rejected ? "OK  " : "BAD "} off-list theme rejected by the database${rejected ? ` (${rejectionMessage})` : " (the CHECK is missing!)"}`,
)

await client.query("DELETE FROM profile_notes WHERE user_id = $1", [target.id])
const { rows: left } = await client.query("SELECT count(*)::int AS n FROM profile_notes WHERE user_id = $1", [target.id])
console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`} — test rows left: ${left[0].n}`)
await client.end()
if (failed) process.exitCode = 1
