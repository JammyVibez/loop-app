import { createClient } from "@/lib/supabase"
import { authDbPool } from "@/lib/auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

async function getUserIdFromToken(token: string): Promise<string | null> {
  // Better Auth's user ID is text, while Circle membership and ownership use
  // the canonical UUID in profiles. Resolve through the same email-aware
  // mapping used by the Rust API instead of comparing the two IDs directly.
  try {
    const res = await authDbPool.query(
      `
        SELECT profile.id::text AS profile_id
        FROM "session" AS auth_session
        JOIN "user" AS auth_user
          ON auth_user.id = auth_session."userId"
        JOIN LATERAL (
          SELECT candidate.id
          FROM profiles AS candidate
          WHERE candidate.id::text = auth_session."userId"
             OR lower(candidate.email) = lower(auth_user.email)
          ORDER BY (candidate.id::text = auth_session."userId") DESC
          LIMIT 1
        ) AS profile ON TRUE
        WHERE auth_session.token = $1
          AND auth_session."expiresAt" > NOW()
        LIMIT 1
      `,
      [token],
    )
    const profileId = res.rows[0]?.profile_id
    if (typeof profileId === "string") return profileId
  } catch {
    /* fall through to legacy Supabase JWT sessions */
  }

  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return null
    const email = data.user.email
    if (email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle()
      if (profile?.id) return String(profile.id)
    }
    // Legacy Supabase sessions may already use the profile UUID.
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.user.id)
      ? data.user.id
      : null
  } catch {
    return null
  }
}

/**
 * Private circles must not leak posts, events, rooms, or the member roster
 * to visitors who haven't been approved by an admin/owner. Call this from
 * any circle sub-resource GET route before returning content.
 *
 * Returns `{ isPrivate: false }` for public circles (always allowed), or
 * `{ isPrivate: true, canView }` for private ones.
 */
export async function checkCirclePrivateAccess(
  circleId: string,
  authHeader: string | null,
): Promise<{ isPrivate: boolean; canView: boolean }> {
  const { data: circleRow } = await supabase
    .from("circles")
    .select("is_private, owner_id, creator_id")
    .eq("id", circleId)
    .maybeSingle()

  if (!circleRow?.is_private) {
    return { isPrivate: false, canView: true }
  }

  const token = authHeader?.replace("Bearer ", "") ?? null
  const userId = token ? await getUserIdFromToken(token) : null

  if (!userId) {
    return { isPrivate: true, canView: false }
  }

  if (circleRow.owner_id === userId) {
    return { isPrivate: true, canView: true }
  }

  const { data: memberRow } = await supabase
    .from("circle_members")
    .select("status")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle()

  const status = String(memberRow?.status || "active").toLowerCase()
  const canView = Boolean(memberRow) && (status === "active" || status === "approved")
  return { isPrivate: true, canView }
}
