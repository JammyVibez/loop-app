import { describe, expect, it } from "vitest"
import { canViewAchievementStats } from "@/lib/achievement-visibility"

const base = {
  viewerId: "viewer",
  targetId: "target",
  profileActive: true,
  blocked: false,
  restricted: false,
  isApprovedFollower: false,
}

describe("achievement stats visibility", () => {
  it("allows users to read their own achievements", () => {
    expect(canViewAchievementStats({ ...base, viewerId: "target", restricted: true })).toBe(true)
  })
  it("allows public profiles and approved followers of restricted profiles", () => {
    expect(canViewAchievementStats(base)).toBe(true)
    expect(canViewAchievementStats({ ...base, restricted: true, isApprovedFollower: true })).toBe(true)
  })
  it("hides restricted achievements from pending followers and blocked pairs", () => {
    expect(canViewAchievementStats({ ...base, restricted: true })).toBe(false)
    expect(canViewAchievementStats({ ...base, blocked: true })).toBe(false)
    expect(canViewAchievementStats({ ...base, profileActive: false })).toBe(false)
  })
})
