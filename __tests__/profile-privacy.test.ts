import { describe, expect, it } from "vitest"
import { isRestrictedProfileVisibility } from "@/lib/profile-privacy"

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
