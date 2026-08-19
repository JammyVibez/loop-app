/**
 * Account status handling.
 *
 * Deleted accounts keep their row in the DB (so FKs, chat history, and
 * loop authorship survive) but are MASKED everywhere they render: the UI
 * shows "Deleted User" instead of a real profile. Suspended (banned)
 * accounts are similarly masked as "Suspended User" so their content stops
 * representing them, while they keep the ability to appeal.
 */

export type ProfileStatus = "active" | "suspended" | "deleted"

export function profileStatus(profile: Record<string, any> | null | undefined): ProfileStatus {
  if (!profile) return "active"
  if (profile.is_deleted || profile.deletion_executed_at) return "deleted"
  if (profile.is_banned) return "suspended"
  return "active"
}

export const DELETED_USER = {
  username: "deleted_user",
  display_name: "Deleted Account",
  name: "Deleted Account",
  avatar_url: null,
  banner_url: null,
  bio: "",
  is_deleted: true,
  is_verified: false,
  is_sponsor: false,
  is_team_member: false,
  is_premium: false,
  is_admin: false,
  is_banned: false,
  badge_id: null,
  active_cosmetics: null,
  cosmetics: null,
  level: 0,
  loop_coins: 0,
}

export const SUSPENDED_USER = {
  username: "suspended_user",
  display_name: "Suspended User",
  name: "Suspended User",
  avatar_url: null,
  banner_url: null,
  bio: "",
  is_suspended: true,
  is_verified: false,
  is_sponsor: false,
  is_team_member: false,
  is_premium: false,
  is_admin: false,
  is_banned: true,
  badge_id: null,
  active_cosmetics: null,
  cosmetics: null,
  level: 0,
  loop_coins: 0,
}

/**
 * Mask a profile row for rendering. Returns a shallow copy with identity
 * fields replaced when the account is deleted or suspended. Suspended users
 * keep their real id (so "report/appeal" affordances work) but nothing
 * that would let their content keep circulating under their name.
 */
export function maskProfile<T extends Record<string, any>>(profile: T | null | undefined): T | null {
  if (!profile) return null
  const status = profileStatus(profile)
  if (status === "deleted") {
    return {
      ...profile,
      ...DELETED_USER,
      id: profile.id, // keep the row id for FK integrity / dedupe keys
      created_at: profile.created_at,
    }
  }
  if (status === "suspended") {
    return {
      ...profile,
      ...SUSPENDED_USER,
      id: profile.id,
      created_at: profile.created_at,
      ban_reason: profile.ban_reason || "Violated community guidelines",
    }
  }
  return profile
}

/** Mask a nested `author`/`user` object (feed rows, comments, chat, …). */
export function maskAuthor<T extends Record<string, any>>(author: T | null | undefined): T | null {
  if (!author) return null
  const status = profileStatus(author)
  if (status === "deleted") {
    return { ...author, ...DELETED_USER, id: author.id }
  }
  if (status === "suspended") {
    return { ...author, ...SUSPENDED_USER, id: author.id }
  }
  return author
}
