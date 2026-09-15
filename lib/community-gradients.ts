/**
 * Shared community role gradient presets.
 * Used by Settings → Roles (definitions), the member list, chat, and the
 * role-assignment dialog so a role renders identically everywhere.
 */
export const COMMUNITY_ROLE_GRADIENTS: Record<string, string> = {
  none: "",
  sunset: "linear-gradient(135deg, #f97316, #ef4444)",
  ocean: "linear-gradient(135deg, #38bdf8, #6366f1)",
  aurora: "linear-gradient(135deg, #34d399, #22d3ee)",
  royal: "linear-gradient(135deg, #a855f7, #ec4899)",
  gold: "linear-gradient(135deg, #fbbf24, #f97316)",
  ember: "linear-gradient(135deg, #f43f5e, #a21caf)",
  steel: "linear-gradient(135deg, #94a3b8, #475569)",
}

/** Staff fallback gradients for communities without defined roles. */
export const STAFF_ROLE_GRADIENTS: Record<string, string> = {
  owner: COMMUNITY_ROLE_GRADIENTS.gold,
  admin: COMMUNITY_ROLE_GRADIENTS.royal,
  moderator: COMMUNITY_ROLE_GRADIENTS.aurora,
}

/**
 * Resolve the gradient for a member: their custom title matched against the
 * community's defined roles first, then staff role defaults.
 */
export function resolveRoleGradient(
  role: string | null | undefined,
  customTitle: string | null | undefined,
  customRoles: any[] | null | undefined,
): string | null {
  const defined = Array.isArray(customRoles) ? customRoles : []
  const byTitle = customTitle ? defined.find((cr: any) => cr?.name && cr.name === customTitle) : null
  if (byTitle?.gradient && byTitle.gradient !== "none") {
    return COMMUNITY_ROLE_GRADIENTS[byTitle.gradient] || byTitle.color || null
  }
  if (customTitle && byTitle?.color) return byTitle.color
  if (role) return STAFF_ROLE_GRADIENTS[role] || null
  return null
}
