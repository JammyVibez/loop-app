/**
 * Resolve whether a profile's content and identifying media can be exposed
 * in public surfaces such as server-rendered metadata and search previews.
 *
 * Legacy rows with no visibility setting remain public for compatibility.
 * Unknown configured values fail closed so a malformed setting cannot turn a
 * restricted profile into a public one.
 */
export function isRestrictedProfileVisibility(privacySettings: unknown): boolean {
  if (privacySettings === null || privacySettings === undefined) return false
  if (typeof privacySettings !== "object" || Array.isArray(privacySettings)) return true

  const visibility = (privacySettings as Record<string, unknown>).profile_visibility
  if (typeof visibility !== "string" || !visibility.trim()) return false

  const normalized = visibility.trim().toLowerCase()
  return normalized !== "public" && normalized !== "unlisted"
}
