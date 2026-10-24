/**
 * Powers — the community permission layer.
 *
 * A member's ability to do something in a community is the union of:
 *   1. their base role (`owner | admin | moderator | member`), and
 *   2. every Power (named custom role) assigned to them.
 *
 * The base role stays the safety net — a moderator can moderate without anyone
 * configuring anything — while Powers let an owner invent their own standing
 * ("Greeter", "Workshop lead", "Night shift") with exactly the abilities they
 * want, in their own colour.
 *
 * Every server mutation should gate on `resolveAbilities` + `can`, never on the
 * raw role string.
 */

import { canManageCircle, normalizeRole, type CircleRole } from "@/lib/circle-permissions"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

export interface PermissionSpec {
  key: string
  label: string
  hint: string
}

export const POWER_GROUPS: Array<{ group: string; hint: string; items: PermissionSpec[] }> = [
  {
    group: "Content",
    hint: "What they can publish and tidy up",
    items: [
      { key: "post.create", label: "Start posts", hint: "Publish posts and replies in the community" },
      { key: "post.moderate", label: "Moderate posts", hint: "Delete, lock or approve anyone's post" },
      { key: "thread.create", label: "Open threads", hint: "Start a new unit of work" },
      { key: "thread.manage", label: "Run any thread", hint: "Edit, close, pin and record outcomes on anyone's thread" },
      { key: "chat.send", label: "Talk in chat", hint: "Send messages in the community room" },
      { key: "chat.moderate", label: "Moderate chat", hint: "Remove messages and mute the room" },
    ],
  },
  {
    group: "People",
    hint: "Who they can bring in or remove",
    items: [
      { key: "member.invite", label: "Invite people", hint: "Create invite links and approve join requests" },
      { key: "member.kick", label: "Remove members", hint: "Remove someone from the community" },
      { key: "member.timeout", label: "Time out members", hint: "Temporarily stop someone from posting or chatting" },
      { key: "member.ban", label: "Ban members", hint: "Block someone from ever returning" },
      { key: "power.assign", label: "Hand out Powers", hint: "Give or take away Powers from members" },
    ],
  },
  {
    group: "Community",
    hint: "How the place is run",
    items: [
      { key: "community.edit", label: "Edit the community", hint: "Name, description, artwork, welcome" },
      { key: "community.settings", label: "Change settings", hint: "Privacy, rules, features and moderation settings" },
      { key: "moderation.queue", label: "Work the queue", hint: "See and resolve reports" },
      { key: "live.start", label: "Go live", hint: "Start a live room members can join" },
    ],
  },
]

export const ALL_PERMISSIONS: string[] = POWER_GROUPS.flatMap((g) => g.items.map((i) => i.key))
const PERMISSION_SET = new Set(ALL_PERMISSIONS)

/** Owners, and anything the owner hands out, ultimately resolve to everything. */
export const EVERY_PERMISSION = ALL_PERMISSIONS

/** What each base role can do before a single Power is assigned. */
const BASE_ABILITIES: Record<CircleRole, string[]> = {
  guest: [],
  member: ["post.create", "thread.create", "chat.send"],
  moderator: [
    "post.create",
    "thread.create",
    "chat.send",
    "post.moderate",
    "thread.manage",
    "chat.moderate",
    "member.timeout",
    "member.kick",
    "moderation.queue",
  ],
  admin: [
    "post.create",
    "thread.create",
    "chat.send",
    "post.moderate",
    "thread.manage",
    "chat.moderate",
    "member.timeout",
    "member.kick",
    "moderation.queue",
    "member.invite",
    "member.ban",
    "power.assign",
    "community.edit",
    "community.settings",
    "live.start",
  ],
  owner: EVERY_PERMISSION,
}

/** Preset palette — every Power picks one, so the UI never invents a gradient. */
export const POWER_COLORS = [
  "#8b5cf6",
  "#6366f1",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
] as const

export const POWER_ICONS = ["shield", "star", "sparkles", "hammer", "palette", "compass", "leaf", "crown"] as const

export interface Power {
  id: number
  circle_id: number
  name: string
  description: string
  color: string
  icon: string
  permissions: string[]
  priority: number
  is_default: boolean
  created_at?: string
}

/** Permissions stored on a Power, filtered to keys that still exist. */
export function normalizePermissions(raw: unknown): string[] {
  let value: unknown = raw
  if (typeof value === "string") {
    try {
      value = JSON.parse(value)
    } catch {
      value = []
    }
  }
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((v) => String(v)).filter((v) => PERMISSION_SET.has(v))))
}

export function baseAbilities(role?: string | null): string[] {
  return BASE_ABILITIES[normalizeRole(role)] || []
}

export function can(permissions: string[] | Set<string>, key: string): boolean {
  return permissions instanceof Set ? permissions.has(key) : permissions.includes(key)
}

export interface MemberAbilities {
  role: CircleRole
  /** Powers assigned to the viewer. */
  powers: Power[]
  /** Base role abilities ∪ every assigned Power. */
  permissions: Set<string>
}

/** Resolve base role + assigned Powers into one permission set. */
export async function resolveAbilities(
  sb: SB,
  circleId: number | string,
  userId: string | null | undefined,
  role?: string | null,
): Promise<MemberAbilities> {
  const base = baseAbilities(role)
  if (!userId) return { role: normalizeRole(role), powers: [], permissions: new Set(base) }

  const { data: assignments } = await sb
    .from("community_member_roles")
    .select("role_id")
    .eq("circle_id", circleId)
    .eq("user_id", userId)

  const roleIds = (assignments || []).map((a: any) => a.role_id)
  let powers: Power[] = []
  if (roleIds.length) {
    const { data: rows } = await sb.from("community_roles").select("*").in("id", roleIds)
    powers = (rows || []).map((r: any) => ({ ...r, permissions: normalizePermissions(r.permissions) }))
  }

  const permissions = new Set(base)
  for (const p of powers) for (const key of p.permissions) permissions.add(key)

  return { role: normalizeRole(role), powers, permissions }
}

/**
 * Powers for a whole community with how many members hold each one — the shape
 * the Powers panel renders.
 */
export async function listPowers(sb: SB, circleId: number | string) {
  const { data: roles } = await sb
    .from("community_roles")
    .select("*")
    .eq("circle_id", circleId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })

  const { data: assignments } = await sb
    .from("community_member_roles")
    .select("role_id, user_id")
    .eq("circle_id", circleId)

  const counts = new Map<number, number>()
  const byUser = new Map<string, number[]>()
  for (const a of assignments || []) {
    counts.set(a.role_id, (counts.get(a.role_id) || 0) + 1)
    const list = byUser.get(a.user_id) || []
    list.push(a.role_id)
    byUser.set(a.user_id, list)
  }

  return {
    roles: (roles || []).map((r: any) => ({
      ...r,
      permissions: normalizePermissions(r.permissions),
      member_count: counts.get(r.id) || 0,
    })) as Array<Power & { member_count: number }>,
    assignments: (assignments || []) as Array<{ role_id: number; user_id: string }>,
    by_user: Object.fromEntries(byUser) as Record<string, number[]>,
  }
}

/** Starter Powers, seeded on first admin visit so the panel is never empty. */
export const STARTER_POWERS: Array<Omit<Power, "id" | "circle_id">> = [
  {
    name: "Contributor",
    description: "Everyone who shows up gets this. They can post, chat and open threads.",
    color: "#6366f1",
    icon: "compass",
    permissions: ["post.create", "thread.create", "chat.send"],
    priority: 10,
    is_default: true,
  },
  {
    name: "Workshop lead",
    description: "Runs threads end to end and can tidy up other people's posts.",
    color: "#14b8a6",
    icon: "hammer",
    permissions: ["post.create", "post.moderate", "thread.create", "thread.manage", "chat.send", "live.start"],
    priority: 30,
    is_default: false,
  },
  {
    name: "Night shift",
    description: "Keeps the room civil when the owners are asleep.",
    color: "#f59e0b",
    icon: "shield",
    permissions: ["chat.send", "chat.moderate", "member.timeout", "moderation.queue"],
    priority: 40,
    is_default: false,
  },
]

/** Seed the starter Powers when an owner opens the panel on a fresh community. */
export async function ensureStarterPowers(sb: SB, circleId: number | string, createdBy: string | null) {
  const { count } = await sb
    .from("community_roles")
    .select("id", { count: "exact", head: true })
    .eq("circle_id", circleId)
  if (count && count > 0) return

  await sb.from("community_roles").insert(
    STARTER_POWERS.map((p) => ({
      circle_id: Number(circleId),
      name: p.name,
      description: p.description,
      color: p.color,
      icon: p.icon,
      permissions: p.permissions,
      priority: p.priority,
      is_default: p.is_default,
      created_by: createdBy,
    })),
  )

  // Backfill: grant the default Power to existing members.
  const { data: def } = await sb
    .from("community_roles")
    .select("id")
    .eq("circle_id", circleId)
    .eq("is_default", true)
    .maybeSingle()
  if (!def) return

  const { data: members } = await sb
    .from("circle_members")
    .select("user_id")
    .eq("circle_id", circleId)
    .neq("status", "banned")
  const rows = (members || []).map((m: any) => ({
    circle_id: Number(circleId),
    user_id: m.user_id,
    role_id: def.id,
    assigned_by: createdBy,
  }))
  if (rows.length) await sb.from("community_member_roles").upsert(rows, { onConflict: "user_id,role_id" })
}

export function isPermissionKey(key: string) {
  return PERMISSION_SET.has(key)
}

/** ── Role chips ──────────────────────────────────────────────────────
 *
 * The chip that sits in front of a name in a community. Every author-heavy
 * surface (forum list, thread replies, member panels) loads badges for its
 * authors in one shot instead of resolving each person's membership.
 */
export interface RoleBadge {
  name: string
  color: string
  icon?: string | null
  source: "base" | "power"
  priority: number
}

const BASE_BADGES: Record<string, RoleBadge> = {
  owner: { name: "Owner", color: "#F59E0B", icon: "crown", source: "base", priority: 100 },
  admin: { name: "Admin", color: "#EF4444", icon: "shield", source: "base", priority: 90 },
  moderator: { name: "Mod", color: "#22C55E", icon: "shield", source: "base", priority: 80 },
}

/**
 * One query per surface: base role + assigned Powers for every author id.
 * A staff base role wins over any Power (you always want to see the Admin),
 * otherwise the highest-priority Power is shown.
 */
export async function loadRoleBadges(
  sb: SB,
  circleId: number | string,
  userIds: Array<string | number | null | undefined>,
): Promise<Record<string, RoleBadge>> {
  const ids = Array.from(new Set(userIds.map((u) => String(u || "")).filter(Boolean)))
  if (!ids.length) return {}

  const out: Record<string, RoleBadge> = {}

  const [{ data: memberships }, { data: assignments }] = await Promise.all([
    sb.from("circle_members").select("user_id, role").eq("circle_id", circleId).in("user_id", ids),
    sb.from("community_member_roles").select("user_id, role_id").eq("circle_id", circleId).in("user_id", ids),
  ])

  for (const m of memberships || []) {
    const base = BASE_BADGES[String(m.role || "").toLowerCase()]
    if (base) out[String(m.user_id)] = base
  }

  const roleIds = Array.from(new Set((assignments || []).map((a: any) => Number(a.role_id)).filter(Boolean)))
  let powers: Power[] = []
  if (roleIds.length) {
    const { data: rows } = await sb.from("community_roles").select("*").in("id", roleIds)
    powers = (rows || []).map((r: any) => ({ ...r, permissions: normalizePermissions(r.permissions) }))
  }
  const powerById = new Map(powers.map((p) => [Number(p.id), p]))

  for (const a of assignments || []) {
    const uid = String(a.user_id)
    const held = powerById.get(Number(a.role_id))
    if (!held) continue
    const current = out[uid]
    if (current && current.source === "base") continue
    const badge: RoleBadge = {
      name: held.name,
      color: held.color || POWER_COLORS[0],
      icon: held.icon,
      source: "power",
      priority: Number(held.priority || 0),
    }
    if (!current || badge.priority > current.priority) out[uid] = badge
  }

  return out
}

/** The viewer's role + Powers + permissions in one call — every route uses this. */
export async function viewerAbilities(sb: SB, circleId: number | string, userId: string | null) {
  if (!userId) {
    return {
      role: "guest" as CircleRole,
      powers: [] as Power[],
      permissions: new Set<string>(),
      is_member: false,
      is_moderator: false,
      is_admin: false,
    }
  }
  const { data: membership } = await sb
    .from("circle_members")
    .select("role, status")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle()

  const abilities = await resolveAbilities(sb, circleId, userId, membership?.role)
  const active = membership?.status === "active" || membership?.status === "approved"
  return {
    ...abilities,
    is_member: active,
    is_moderator: active && canManageCircle(membership?.role),
    is_admin: active && (normalizeRole(membership?.role) === "owner" || normalizeRole(membership?.role) === "admin"),
  }
}
