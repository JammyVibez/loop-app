import { describe, it, expect } from "vitest"

/**
 * Smoke tests — verify core modules import cleanly and key utilities work.
 * These are lightweight guards; not full integration tests.
 */

describe("Core module imports", () => {
  it("imports lib/server-auth without error", async () => {
    const mod = await import("@/lib/server-auth")
    expect(typeof mod.getUserFromRequest).toBe("function")
  })

  it("imports lib/dicebear without error", async () => {
    const mod = await import("@/lib/dicebear")
    expect(typeof mod.getDiceBearUrl).toBe("function")
  })

  it("getDiceBearUrl returns a valid URL string", async () => {
    const { getDiceBearUrl } = await import("@/lib/dicebear")
    const url = getDiceBearUrl("testuser")
    expect(typeof url).toBe("string")
    expect(url).toContain("dicebear")
  })

  it("imports lib/utils without error", async () => {
    const mod = await import("@/lib/utils")
    expect(typeof mod.cn).toBe("function")
  })

  it("cn merges class names correctly", async () => {
    const { cn } = await import("@/lib/utils")
    expect(cn("a", "b")).toBe("a b")
    expect(cn("a", false && "b")).toBe("a")
    expect(cn("a", undefined)).toBe("a")
  })
})

describe("Cosmetics utilities", () => {
  it("imports lib/cosmetics without error", async () => {
    const mod = await import("@/lib/cosmetics")
    expect(typeof mod.cosmeticsFromInventory).toBe("function")
    expect(typeof mod.cosmeticVariants).toBe("function")
  })

  it("cosmeticsFromInventory handles empty input", async () => {
    const { cosmeticsFromInventory } = await import("@/lib/cosmetics")
    const result = cosmeticsFromInventory(null)
    expect(result).toBeDefined()
    expect(result.font).toBeNull()
  })
})

describe("XP / leveling math", () => {
  it("imports lib/xp without error", async () => {
    const mod = await import("@/lib/xp")
    expect(typeof mod.xpForNextLevel).toBe("function")
  })

  it("xpForNextLevel returns increasing values", async () => {
    const { xpForNextLevel } = await import("@/lib/xp")
    const lvl1 = xpForNextLevel(1)
    const lvl5 = xpForNextLevel(5)
    expect(typeof lvl1).toBe("number")
    expect(lvl5).toBeGreaterThan(lvl1)
  })
})

describe("Privacy helpers", () => {
  it("imports lib/privacy without error", async () => {
    const mod = await import("@/lib/privacy")
    expect(typeof mod.getFollowingIds).toBe("function")
    expect(typeof mod.filterPrivateContent).toBe("function")
  })
})

describe("Feed ranking", () => {
  it("imports lib/feed-ranking without error", async () => {
    const mod = await import("@/lib/feed-ranking")
    expect(typeof mod.smartEngagementScore).toBe("function")
    expect(typeof mod.organizationRankingBoost).toBe("function")
  })
})

describe("API route structure", () => {
  it("image-proxy route module exists", async () => {
    // Dynamic import to verify the module resolves (won't execute the handler)
    const mod = await import("@/app/api/image-proxy/route")
    expect(typeof mod.GET).toBe("function")
  })

  it("health route module exists", async () => {
    const mod = await import("@/app/api/health/route")
    expect(typeof mod.GET).toBe("function")
  })
})

describe("API handler utilities", () => {
  it("imports api-handler without error", async () => {
    const mod = await import("@/lib/api-handler")
    expect(typeof mod.withHandler).toBe("function")
    expect(typeof mod.withUser).toBe("function")
    expect(typeof mod.withAdmin).toBe("function")
    expect(typeof mod.withModerator).toBe("function")
    expect(typeof mod.withAdminParams).toBe("function")
    expect(typeof mod.apiError).toBe("function")
    expect(typeof mod.apiSuccess).toBe("function")
  })
})
