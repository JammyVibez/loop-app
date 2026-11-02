import { describe, expect, it } from "vitest"
import { buildRestrictedProfileView, isRestrictedProfileVisibility } from "@/lib/profile-privacy"

describe("isRestrictedProfileVisibility", () => {
  it("keeps legacy profiles without a setting public", () => {
    expect(isRestrictedProfileVisibility(null)).toBe(false)
    expect(isRestrictedProfileVisibility(undefined)).toBe(false)
    expect(isRestrictedProfileVisibility({})).toBe(false)
    expect(isRestrictedProfileVisibility({ profile_visibility: "public" })).toBe(false)
  })

  it("allows unlisted profile previews but not restricted visibility modes", () => {
    expect(isRestrictedProfileVisibility({ profile_visibility: "unlisted" })).toBe(false)
    expect(isRestrictedProfileVisibility({ profile_visibility: "private" })).toBe(true)
    expect(isRestrictedProfileVisibility({ profile_visibility: "followers" })).toBe(true)
  })

  it("fails closed for malformed or unknown configured values", () => {
    expect(isRestrictedProfileVisibility("private")).toBe(true)
    expect(isRestrictedProfileVisibility([])).toBe(true)
    expect(isRestrictedProfileVisibility({ profile_visibility: "team-only" })).toBe(true)
  })
})


describe("restricted profile response", () => {
  it("exposes only basic identity and hides social, activity and account details", () => {
    const view = buildRestrictedProfileView({
      id: "profile-1",
      username: "creator",
      display_name: "Creator",
      avatar_url: "https://cdn.example.test/avatar.png",
      banner_url: "https://cdn.example.test/banner.png",
      bio: "A short public-facing introduction",
      location: "Private location",
      website: "https://private.example.test",
      is_verified: true,
      is_premium: true,
      followers_count: 1200,
    } as any, {
      isPrivate: true,
      hasPendingRequest: true,
      isBlocked: false,
      blockDirection: null,
    })

    expect(view.username).toBe("creator")
    expect(view.is_verified).toBe(true)
    expect(view.has_pending_follow_request).toBe(true)
    expect(view.followers_count).toBe(0)
    expect((view as any).location).toBeUndefined()
    expect((view as any).website).toBeUndefined()
    expect((view as any).is_premium).toBeUndefined()
  })

  it("does not reveal pending follow state when the viewer is blocked", () => {
    const view = buildRestrictedProfileView({
      id: "profile-2",
      username: "creator",
      display_name: "Creator",
    }, {
      isPrivate: false,
      hasPendingRequest: true,
      isBlocked: true,
      blockDirection: "by_them",
    })

    expect(view.is_blocked).toBe(true)
    expect(view.has_pending_follow_request).toBe(false)
    expect(view.recent_loops).toEqual([])
  })
})
