/**
 * Sidebar navigation model.
 *
 * The rail had grown to a dozen-plus destinations with no hierarchy — every
 * route looked equally important, so nothing did. This splits it into a short
 * always-visible primary group and a secondary group behind a "More"
 * disclosure, while keeping every route reachable from the same place.
 *
 * Messages is deliberately NOT here: it lives in the profile dropdown, and the
 * unread count rides on the avatar so it is visible with the menu closed.
 *
 * Kept out of the component so the rules that matter — in particular "the split
 * must not lose a destination" — can be tested directly.
 */

export type SidebarGroup = "primary" | "secondary"

/** Optional audiences. Items without one are shown to everyone. */
export type SidebarAudienceKey = "premium" | "organization" | "admin" | "team"

export interface SidebarNavItem {
  href: string
  label: string
  /** Small pill, e.g. LIVE / NEW / PRO. */
  badge?: string
  /** Colour treatment for privileged dashboards. */
  tone?: "admin" | "team"
  audience?: SidebarAudienceKey
  group: SidebarGroup
}

export interface SidebarAudience {
  isPremium: boolean
  isOrganization: boolean
  isAdmin: boolean
  isTeamMember: boolean
}

export const EMPTY_AUDIENCE: SidebarAudience = {
  isPremium: false,
  isOrganization: false,
  isAdmin: false,
  isTeamMember: false,
}

export const SIDEBAR_NAV: SidebarNavItem[] = [
  // Primary: the five destinations worth a permanent slot in the rail.
  { href: "/", label: "Home Feed", group: "primary" },
  { href: "/explore", label: "Explore & Search", group: "primary" },
  { href: "/communities", label: "Communities", group: "primary" },
  { href: "/streams", label: "Live Streams", badge: "LIVE", group: "primary" },
  { href: "/wallet", label: "Wallet & Gifts", group: "primary" },

  // Secondary: real features, but not worth competing with the primary five.
  { href: "/co-loop/studio", label: "Co-Loop Studio", badge: "NEW", group: "secondary" },
  { href: "/earnings", label: "Creator Studio", group: "secondary" },
  { href: "/developers", label: "Developer Hub", group: "secondary" },
  { href: "/events", label: "Events Stage", group: "secondary" },
  { href: "/bookmarks", label: "Saved Bookmarks", group: "secondary" },
  { href: "/invite", label: "Invite Friends", group: "secondary" },
  { href: "/lounge", label: "Pro Lounge", badge: "PRO", audience: "premium", group: "secondary" },
  { href: "/organization", label: "Organization", badge: "ORG", audience: "organization", group: "secondary" },
  { href: "/loopadmin", label: "Admin Dashboard", badge: "ADMIN", tone: "admin", audience: "admin", group: "secondary" },
  { href: "/team", label: "Team Dashboard", badge: "TEAM", tone: "team", audience: "team", group: "secondary" },
]

function isVisible(item: SidebarNavItem, audience: SidebarAudience): boolean {
  switch (item.audience) {
    case undefined:
      return true
    case "premium":
      return audience.isPremium
    case "organization":
      return audience.isOrganization
    case "admin":
      return audience.isAdmin
    case "team":
      // Admins are on the team; the reverse is not true.
      return audience.isTeamMember || audience.isAdmin
    default:
      return false
  }
}

/** Every destination this viewer should be able to reach. */
export function visibleSidebarNav(audience: SidebarAudience = EMPTY_AUDIENCE): SidebarNavItem[] {
  return SIDEBAR_NAV.filter((item) => isVisible(item, audience))
}

export function primarySidebarNav(audience: SidebarAudience = EMPTY_AUDIENCE): SidebarNavItem[] {
  return visibleSidebarNav(audience).filter((item) => item.group === "primary")
}

export function secondarySidebarNav(audience: SidebarAudience = EMPTY_AUDIENCE): SidebarNavItem[] {
  return visibleSidebarNav(audience).filter((item) => item.group === "secondary")
}

// ─── "More" disclosure state ───────────────────────────────────────
//
// Remembered so someone who opens it keeps it open, and a returning user is
// not met with a wall of links again.

export const SIDEBAR_MORE_STORAGE_KEY = "loop:sidebar-more"

/** Minimal shape of the storage we touch, so tests can pass a stub. */
export interface SidebarStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function resolveStorage(storage?: SidebarStorage): SidebarStorage | null {
  if (storage) return storage
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readSidebarMoreExpanded(storage?: SidebarStorage): boolean {
  const store = resolveStorage(storage)
  if (!store) return false
  try {
    return store.getItem(SIDEBAR_MORE_STORAGE_KEY) === "expanded"
  } catch {
    // Storage blocked — fall back to collapsed, never crash the rail.
    return false
  }
}

export function writeSidebarMoreExpanded(expanded: boolean, storage?: SidebarStorage): void {
  const store = resolveStorage(storage)
  if (!store) return
  try {
    store.setItem(SIDEBAR_MORE_STORAGE_KEY, expanded ? "expanded" : "collapsed")
  } catch {
    /* storage unavailable — the disclosure just behaves per-session */
  }
}
