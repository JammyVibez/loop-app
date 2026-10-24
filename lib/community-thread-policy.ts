/**
 * Who may start a thread in a community.
 *
 * Two modes, stored in `circles.settings.thread_creation`:
 *
 *   { mode: "members" }                 — anyone the permission layer already
 *                                          lets post (the original behaviour,
 *                                          and the default everywhere).
 *   { mode: "roles", roles: [ids] }     — only staff, plus members holding one
 *                                          of the chosen Powers. This is how an
 *                                          owner says "only Moderators and
 *                                          Editors may open threads here".
 *
 * The policy is a restriction on top of the permission layer, never an
 * expansion of it: a member with `thread.create` revoked by a ban/timeout is
 * still blocked even when the mode is "members".
 */

export interface ThreadCreationPolicy {
  mode: "members" | "roles"
  /** community_roles ids allowed to open threads when mode is "roles". */
  roles: number[]
}

export const DEFAULT_THREAD_POLICY: ThreadCreationPolicy = { mode: "members", roles: [] }

/** Read the policy out of a circle's `settings` JSONB, tolerating anything. */
export function readThreadPolicy(settings: unknown): ThreadCreationPolicy {
  const raw = (settings as { thread_creation?: unknown } | null)?.thread_creation
  if (!raw || typeof raw !== "object") return DEFAULT_THREAD_POLICY
  const value = raw as { mode?: unknown; roles?: unknown }
  // Anything that is not the role-gated shape collapses to the default — a
  // stored `roles` list is meaningless while the mode is "members".
  if (value.mode !== "roles") return { ...DEFAULT_THREAD_POLICY }
  const roles = Array.isArray(value.roles)
    ? Array.from(new Set(value.roles.map((r) => Number(r)).filter((r) => Number.isFinite(r) && r > 0)))
    : []
  return { mode: "roles", roles }
}

export interface CreateThreadDecision {
  allowed: boolean
  /** False when the policy exists but lists no roles — the UI should warn. */
  emptyPolicy: boolean
  reason: "ok" | "not_member" | "no_permission" | "role_required"
}

/**
 * Resolve thread creation for one viewer.
 *
 * @param isMember    active/approved membership
 * @param isStaff     owner / admin / moderator
 * @param hasPermission whether the viewer's permission set holds `thread.create`
 * @param assignedRoleIds community_roles ids assigned to the viewer
 */
export function decideThreadCreation(input: {
  policy: ThreadCreationPolicy
  isMember: boolean
  isStaff: boolean
  hasPermission: boolean
  assignedRoleIds: number[]
}): CreateThreadDecision {
  const { policy, isMember, isStaff, hasPermission, assignedRoleIds } = input
  if (!isMember) return { allowed: false, emptyPolicy: false, reason: "not_member" }

  // Staff always keep the keys to the place they run.
  if (isStaff) return { allowed: true, emptyPolicy: false, reason: "ok" }

  if (policy.mode === "members") {
    return hasPermission
      ? { allowed: true, emptyPolicy: false, reason: "ok" }
      : { allowed: false, emptyPolicy: false, reason: "no_permission" }
  }

  const emptyPolicy = policy.roles.length === 0
  const holds = assignedRoleIds.some((id) => policy.roles.includes(Number(id)))
  if (holds && hasPermission) return { allowed: true, emptyPolicy, reason: "ok" }
  return { allowed: false, emptyPolicy, reason: "role_required" }
}
