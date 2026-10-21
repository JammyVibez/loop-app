import { authDbPool } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase"

type SupabaseServer = ReturnType<typeof createServerClient>

export interface AdminDeleteResult {
  ok: boolean
  error?: string
  username?: string
}

/**
 * Admin account deletion.
 *
 * The account is deleted for real: the Better Auth `user` row (and therefore
 * every session and credential) is removed, so the person cannot sign back in,
 * while the `profiles` row survives — masked as "Deleted Account" — so their
 * loops, comments and messages keep their FK target instead of vanishing.
 *
 * Every write is checked. This route used to update `profiles.cover_url`, a
 * column that does not exist (it is `banner_url`), swallow the Postgres error
 * and still report success: the admin saw "Account deleted" and the account
 * stayed exactly as it was.
 */
export async function deleteAccountAsAdmin({
  actorId,
  targetId,
  reason,
}: {
  actorId: string
  targetId: string | null | undefined
  reason?: string | null
}): Promise<AdminDeleteResult> {
  if (!targetId) return { ok: false, error: "user_id is required" }
  if (targetId === actorId) return { ok: false, error: "You cannot delete your own account" }

  const supabase = createServerClient()

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, username, email, is_admin, is_deleted, deletion_executed_at")
    .eq("id", targetId)
    .maybeSingle()

  if (targetError) return { ok: false, error: `Could not load that account: ${targetError.message}` }
  if (!target) return { ok: false, error: "User not found" }
  if (target.is_admin) return { ok: false, error: "Cannot delete another admin account" }
  if (target.is_deleted || target.deletion_executed_at) {
    return { ok: false, error: "That account is already deleted" }
  }

  // 1. Take the login away first. Deleting the auth user cascades its sessions
  //    and credential rows; the session delete is belt-and-braces for legacy
  //    rows whose profile id and auth id drifted apart.
  try {
    const { rows: authUsers } = await authDbPool.query(
      `SELECT id FROM "user" WHERE id = $1 OR ($2::text IS NOT NULL AND email = $2)`,
      [targetId, target.email || null],
    )
    for (const row of authUsers) {
      await authDbPool.query(`DELETE FROM "user" WHERE id = $1`, [row.id])
    }
    await authDbPool.query(`DELETE FROM "session" WHERE "userId" = $1`, [targetId])
  } catch (error: any) {
    return { ok: false, error: `Could not revoke that account's login: ${error?.message || "unknown error"}` }
  }

  // 2. Mask the profile. Only columns that exist — `cover_url` never did.
  const now = new Date().toISOString()
  const suffix = String(targetId).replace(/-/g, "").slice(0, 8)
  const { error: updateError } = await supabase
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
      username: `deleted_${suffix}`,
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
    .eq("id", targetId)

  if (updateError) {
    return { ok: false, error: `Could not delete that account: ${updateError.message}` }
  }

  // 3. Audit trail. A failure here must not resurrect the deleted account, so
  //    it is logged rather than surfaced as "delete failed".
  const { error: logError } = await supabase.from("admin_account_deletions").insert({
    admin_id: actorId,
    target_user_id: targetId,
    target_username: target.username || "unknown",
    reason: reason || "Admin deletion",
  })
  if (logError) console.error("[admin-delete-account] audit log insert failed:", logError.message)

  return { ok: true, username: target.username || targetId }
}
