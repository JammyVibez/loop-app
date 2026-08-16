/**
 * Shared server-side privacy helpers.
 *
 * Every public surface (feed, search, explore, reels, hashtags, loop detail)
 * funnels through these so a profile set to "private" or "followers-only"
 * visibility stays invisible to people who aren't approved followers — the
 * check happens here, on the server, never just hidden in the client.
 */

export function isGatedVisibility(visibility: unknown): boolean {
  return visibility === "private" || visibility === "followers"
}

/** Returns the ids of profiles whose visibility gates their content. */
export async function getPrivateProfileIds(
  supabase: any,
  userIds: Array<string | null | undefined>,
): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  if (!ids.length) return new Set()

  const { data } = await supabase
    .from("profiles")
    .select("id, privacy_settings")
    .in("id", ids)

  return new Set(
    (data || [])
      .filter((p: any) => isGatedVisibility((p.privacy_settings || {})?.profile_visibility))
      .map((p: any) => p.id),
  )
}

/**
 * Drops rows (loops, reels, posts) authored by private/followers-only profiles
 * unless the viewer wrote it themself or already follows the author.
 */
export async function filterPrivateContent<T extends { author_id?: string }>(
  supabase: any,
  rows: T[],
  viewerId: string | null,
  followingIds: Set<string> | string[],
): Promise<T[]> {
  if (!rows.length) return rows
  const privateIds = await getPrivateProfileIds(
    supabase,
    rows.map((row) => row.author_id),
  )
  if (!privateIds.size) return rows

  const followed = new Set(Array.from(followingIds))
  return rows.filter((row) => {
    if (viewerId && row.author_id === viewerId) return true
    if (followed.has(row.author_id!)) return true
    return !privateIds.has(row.author_id!)
  })
}

/**
 * Whether the viewer is allowed to see a user's full profile/content.
 * Returns the gate status so callers can respond appropriately (e.g. 404 vs
 * a "private" placeholder).
 */
export async function canViewProfile(
  supabase: any,
  viewerId: string | null,
  targetId: string,
): Promise<{ allowed: boolean; isPrivate: boolean }> {
  const { data } = await supabase
    .from("profiles")
    .select("privacy_settings")
    .eq("id", targetId)
    .maybeSingle()

  const privacy = (data as any)?.privacy_settings || {}
  if (!isGatedVisibility(privacy.profile_visibility)) {
    return { allowed: true, isPrivate: false }
  }
  if (!viewerId) return { allowed: false, isPrivate: true }
  if (viewerId === targetId) return { allowed: true, isPrivate: true }

  const { data: follow } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", viewerId)
    .eq("following_id", targetId)
    .maybeSingle()

  return { allowed: Boolean(follow), isPrivate: true }
}

/** Fetch the viewer's approved following ids (Set). */
export async function getFollowingIds(supabase: any, viewerId: string | null): Promise<Set<string>> {
  const ids = new Set<string>()
  if (!viewerId) return ids
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId)
  for (const row of data || []) {
    if (row.following_id) ids.add(row.following_id)
  }
  return ids
}
