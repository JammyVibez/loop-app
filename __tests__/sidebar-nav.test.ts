import { describe, expect, it } from "vitest"
import {
  EMPTY_AUDIENCE,
  primarySidebarNav,
  SIDEBAR_NAV,
  secondarySidebarNav,
  visibleSidebarNav,
  type SidebarAudience,
} from "@/lib/sidebar-nav"

const FULL_ACCESS: SidebarAudience = {
  isPremium: true,
  isOrganization: true,
  isAdmin: true,
  isTeamMember: true,
}

describe("sidebar navigation", () => {
  it("keeps every rail destination reachable in one list", () => {
    const reachable = visibleSidebarNav(FULL_ACCESS).map((item) => item.href).sort()

    // Account and staff destinations moved to the profile menu, so the rail
    // only carries product surfaces.
    expect(reachable).toEqual(
      [
        "/",
        "/bookmarks",
        "/chains",
        "/channels",
        "/communities",
        "/create",
        "/drops",
        "/events",
        "/explore",
        "/messages",
        "/quests",
        "/streams",
      ].sort(),
    )
  })

  it("lists every destination exactly once", () => {
    const hrefs = SIDEBAR_NAV.map((item) => item.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it("keeps the primary group short enough to read at a glance", () => {
    const primary = primarySidebarNav(EMPTY_AUDIENCE).map((item) => item.href)

    expect(primary.length).toBeLessThanOrEqual(5)
    expect(primary).toEqual(["/", "/explore", "/create", "/communities", "/messages"])
  })

  it("keeps creation and inbox in the primary experience", () => {
    const primary = primarySidebarNav(EMPTY_AUDIENCE).map((item) => item.href)
    expect(primary).toContain("/create")
    expect(primary).toContain("/messages")
  })

  it("splits every visible item into exactly one group", () => {
    const audience: SidebarAudience = { ...EMPTY_AUDIENCE, isPremium: true }
    const primary = primarySidebarNav(audience)
    const secondary = secondarySidebarNav(audience)

    expect(primary.length + secondary.length).toBe(visibleSidebarNav(audience).length)
    expect(secondary.map((item) => item.href)).toContain("/streams")
    expect(secondary.map((item) => item.href)).toContain("/channels")
  })
})
