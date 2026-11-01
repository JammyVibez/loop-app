import { describe, expect, it } from "vitest"
import { isPrivateCircleDiscoverable, resolveCircleMembershipAction } from "@/lib/circle-membership-state"

describe("resolveCircleMembershipAction", () => {
  it("enters active and legacy approved memberships", () => {
    expect(resolveCircleMembershipAction("active", false).kind).toBe("enter")
    expect(resolveCircleMembershipAction("approved", false).kind).toBe("enter")
  })
  it("lets applicants cancel a pending private Circle request", () => {
    expect(resolveCircleMembershipAction("pending", true).kind).toBe("cancel-request")
  })
  it("distinguishes public joining from private requests", () => {
    expect(resolveCircleMembershipAction(null, false).kind).toBe("join")
    expect(resolveCircleMembershipAction(null, true).kind).toBe("request-join")
  })
  it("does not let banned members retry", () => {
    expect(resolveCircleMembershipAction("banned", false).kind).toBe("unavailable")
  })
})

describe("isPrivateCircleDiscoverable", () => {
  it("hides private Circles from guests and banned accounts", () => {
    expect(isPrivateCircleDiscoverable({ isPrivate: true, viewerId: null })).toBe(false)
    expect(isPrivateCircleDiscoverable({ isPrivate: true, viewerId: "banned", membershipStatus: "banned" })).toBe(false)
  })
  it("allows owners, members and pending applicants to see private Circles", () => {
    expect(isPrivateCircleDiscoverable({ isPrivate: true, viewerId: "owner", ownerId: "owner" })).toBe(true)
    expect(isPrivateCircleDiscoverable({ isPrivate: true, viewerId: "member", membershipStatus: "active" })).toBe(true)
    expect(isPrivateCircleDiscoverable({ isPrivate: true, viewerId: "applicant", membershipStatus: "pending" })).toBe(true)
  })
  it("keeps public Circles visible to guests", () => {
    expect(isPrivateCircleDiscoverable({ isPrivate: false, viewerId: null })).toBe(true)
  })
})
