/**
 * Community house policies: who may comment, who may see the threads, and who
 * may mention whom.
 *
 * Owners configure these in community settings. They live on the community's
 * `moderation_settings` JSON so no migration is needed and a community that
 * never touched them keeps behaving exactly as before (every field empty means
 * "everyone, as usual").
 */

export type CommunityPolicy = {
  /** Roles allowed to comment. Empty/null = every member. */
  comment_roles: string[] | null
  /** Roles allowed to read the forum. Empty/null = everyone who may join. */
  visible_roles: string[] | null
  /** Roles that may be @mentioned. Empty/null = every role. */
  mentionable_roles: string[] | null
  /** Roles allowed to @mention at all. Empty/null = every commenter. */
  mention_roles: string[] | null
}

const EMPTY: CommunityPolicy = {
  comment_roles: null,
  visible_roles: null,
  mentionable_roles: null,
  mention_roles: null,
}

export const POLICY_ROLES = ["owner", "admin", "moderator", "member"] as const

export const POLICY_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Moderator",
  member: "Member",
}

function roleList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const list = value.map((v) => String(v)).filter((v) => (POLICY_ROLES as readonly string[]).includes(v))
  return list.length ? Array.from(new Set(list)) : null
}

export function readPolicy(settings: any): CommunityPolicy {
  const raw = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {}
  return {
    comment_roles: roleList(raw.comment_roles),
    visible_roles: roleList(raw.visible_roles),
    mentionable_roles: roleList(raw.mentionable_roles),
    mention_roles: roleList(raw.mention_roles),
  }
}

export function writePolicy(patch: Partial<CommunityPolicy>, existing: any = {}) {
  const base = { ...(existing && typeof existing === "object" ? existing : {}) }
  for (const key of Object.keys(EMPTY) as (keyof CommunityPolicy)[]) {
    if (!(key in patch)) continue
    const value = roleList(patch[key])
    if (value) base[key] = value
    else delete base[key]
  }
  return base
}

const STAFF = new Set(["owner", "admin", "moderator"])

export function isStaffRole(role?: string | null) {
  return Boolean(role && STAFF.has(role))
}

/**
 * Staff always keep their powers — a policy that locked moderators out of
 * their own moderation tools would be a trap, not a setting.
 */
export function policyAllows(allowed: string[] | null, role?: string | null) {
  if (!allowed) return true
  const normalized = role || "member"
  return STAFF.has(normalized) || allowed.includes(normalized)
}

export function canComment(role: string | null | undefined, policy: CommunityPolicy) {
  return policyAllows(policy.comment_roles, role)
}

export function canViewForum(role: string | null | undefined, policy: CommunityPolicy) {
  return policyAllows(policy.visible_roles, role)
}

export function canMention(role: string | null | undefined, policy: CommunityPolicy) {
  return policyAllows(policy.mention_roles, role)
}

/** Roles named in `@admin`, `@moderator` … within a message. */
export function extractMentions(content: string) {
  const usernames: string[] = []
  const roles: string[] = []
  const seen = new Set<string>()

  // `@name` / `@role` — username characters only, so emails never match.
  const tokens = content.matchAll(/@([a-zA-Z0-9_]{2,32})/g)
  for (const match of tokens) {
    const handle = match[1].toLowerCase()
    if (seen.has(handle)) continue
    seen.add(handle)
    if ((POLICY_ROLES as readonly string[]).includes(handle)) roles.push(handle)
    else usernames.push(handle)
  }

  return { usernames, roles }
}

/** Filter role mentions through the community's allow-list. */
export function mentionableRoles(roles: string[], policy: CommunityPolicy) {
  return roles.filter((role) => policyAllows(policy.mentionable_roles, role))
}
