/**
 * End-to-end check of the admin delete payload against PostgREST.
 *
 * Creates a throwaway profile row, applies the exact update the fixed helper
 * sends (which previously failed silently on a non-existent `cover_url`), and
 * asserts the account is masked and gone from the admin list. The throwaway
 * row is deleted in `finally`, so no real account is touched.
 *
 *   node scripts/verify-admin-delete-live.mjs
 */
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing Supabase env")
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await db.connect()

const id = randomUUID()
const username = `delcheck_${id.slice(0, 8)}`
let failures = 0
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`)
  if (!ok) failures++
}

try {
  const { error: insertError } = await db.query(
    `insert into profiles (id, username, display_name, email, bio, avatar_url, is_verified, is_premium)
     values ($1, $2, 'Delete Check', 'delcheck@example.invalid', 'temp bio', 'https://example.invalid/a.png', true, true)`,
    [id, username],
  )
  if (insertError) throw new Error(`could not create throwaway profile: ${insertError.message}`)

  // Exactly what lib/admin-delete-account.ts sends.
  const now = new Date().toISOString()
  const { error: updateError } = await sb
    .from("profiles")
    .update({
      is_deleted: true,
      deleted_at: now,
      deletion_requested_at: now,
      deletion_executed_at: now,
      is_banned: false,
      ban_reason: null,
      suspended_at: null,
      display_name: "Deleted Account",
      username: `deleted_${id.replace(/-/g, "").slice(0, 8)}`,
      email: null,
      bio: null,
      avatar_url: null,
      banner_url: null,
      video_avatar_url: null,
      video_cover_url: null,
      location: null,
      website: null,
      is_premium: false,
      is_verified: false,
      is_sponsor: false,
      is_team_member: false,
      is_moderator: false,
      loop_coins: 0,
    })
    .eq("id", id)

  check("the delete update succeeds (was a silent no-op before)", !updateError, updateError?.message || "")

  const { data: row } = await db.query(
    `select username, display_name, email, is_deleted, deletion_executed_at, is_verified, is_premium
       from profiles where id = $1`,
    [id],
  ).then((r) => ({ data: r.rows[0] }))
  check("account is masked as deleted", row?.is_deleted === true && Boolean(row?.deletion_executed_at))
  check("identity fields are cleared", row?.email === null && row?.username.startsWith("deleted_"))
  check("badges are dropped", row?.is_verified === false && row?.is_premium === false)

  const { data: listed, error: listError } = await sb
    .from("profiles")
    .select("id")
    .is("deletion_executed_at", null)
    .not("is_deleted", "is", true)
    .eq("id", id)
  check("admin user list no longer returns it", !listError && (listed || []).length === 0, listError?.message || "")

  const { data: listedBeforeFilters } = await sb.from("profiles").select("id").eq("id", id)
  check("the row still exists for FK integrity", (listedBeforeFilters || []).length === 1)
} catch (error) {
  check("admin delete verification", false, error.message)
} finally {
  await db.query(`delete from profiles where id = $1`, [id])
  const { rows } = await db.query(`select count(*)::int n from profiles where id = $1`, [id])
  check("throwaway profile removed", rows[0].n === 0)
  await db.end()
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
