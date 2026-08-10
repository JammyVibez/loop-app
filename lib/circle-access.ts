import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

async function getUserIdFromToken(token: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return null
    return data.user.id
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

  if (circleRow.owner_id === userId || circleRow.creator_id === userId) {
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
