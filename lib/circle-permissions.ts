/** Centralized Circle role permission helpers */

export type CircleRole = "owner" | "admin" | "moderator" | "member" | "guest"

const rank: Record<CircleRole, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
  guest: 0,
}

export function normalizeRole(role?: string | null): CircleRole {
  if (role === "owner" || role === "admin" || role === "moderator" || role === "member") return role
  return "guest"
}

export function canManageCircle(role?: string | null) {
  const r = normalizeRole(role)
  return r === "owner" || r === "admin" || r === "moderator"
}

export function canModerateMembers(role?: string | null) {
  return canManageCircle(role)
}

export function canPromoteMembers(role?: string | null) {
  const r = normalizeRole(role)
  return r === "owner" || r === "admin"
}

export function canEditStudio(role?: string | null) {
  return canPromoteMembers(role)
}

export function canDeleteCircle(role?: string | null) {
  return normalizeRole(role) === "owner"
}

export function canManageRooms(role?: string | null) {
  return canManageCircle(role)
}

export function roleAtLeast(role: string | null | undefined, minimum: CircleRole) {
  return rank[normalizeRole(role)] >= rank[minimum]
}

export const ROLE_PERMISSIONS = [
  { role: "owner", label: "Owner", abilities: ["Everything", "Delete circle", "Transfer ownership", "Ban anyone"] },
  { role: "admin", label: "Admin", abilities: ["Manage rooms", "Approve members", "Promote/demote", "Studio settings"] },
  { role: "moderator", label: "Moderator", abilities: ["Approve joins", "Kick members", "Pin posts", "Moderate chat"] },
  { role: "member", label: "Member", abilities: ["Post", "Comment", "Join rooms", "React"] },
] as const
