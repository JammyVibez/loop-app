/**
 * Sidebar navigation model.
 *
 * One rail, one list. The rail used to render a five-item "Menu" plus a second
 * "More" list holding sixteen more destinations, which read as two competing
 * navigation lists and buried the product surfaces people actually use.
 *
 * The rail now carries the product destinations only. Account, workspace and
 * staff destinations (Creator Studio, Developer Hub, Invite, Collections, Pro
 * Lounge, Organization, Admin and Team) live in the profile menu, so nothing is
 * duplicated and nothing becomes unreachable.
 *
 * Kept out of the component so the rules that matter — every destination is
 * listed once, and the primary group stays the five core tabs — can be tested.
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
  // The five core destinations also drive the mobile tab bar.
  { href: "/", label: "Home", group: "primary" },
  { href: "/explore", label: "Discover", group: "primary" },
  { href: "/create", label: "Create", group: "primary" },
  { href: "/communities", label: "Circles", group: "primary" },
  { href: "/messages", label: "Inbox", group: "primary" },

  // Product destinations. Account and staff tools live in the profile menu.
  { href: "/quests", label: "Quests", group: "secondary" },
  { href: "/chains", label: "Chains", badge: "NEW", group: "secondary" },
  { href: "/streams", label: "Audio Rooms", badge: "LIVE", group: "secondary" },
  { href: "/channels", label: "Channels", badge: "NEW", group: "secondary" },
  { href: "/drops", label: "Drops", badge: "NEW", group: "secondary" },
  { href: "/events", label: "Events", group: "secondary" },
  { href: "/bookmarks", label: "Saved", group: "secondary" },
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
