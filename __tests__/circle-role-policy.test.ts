import { describe, expect, it } from "vitest"
import {
  canApproveCircleRole,
  canAssignCircleRole,
  canManageMemberSettings,
  canRemoveCircleMember,
} from "@/lib/circle-permissions"

describe("Circle member role hierarchy", () => {
  it("does not let anyone assign Circle ownership through member approval", () => {
    expect(canApproveCircleRole("owner", "owner")).toBe(false)
    expect(canApproveCircleRole("admin", "owner")).toBe(false)
    expect(canApproveCircleRole("moderator", "owner")).toBe(false)
  })

  it("lets moderators approve ordinary members but not elevated roles", () => {
    expect(canApproveCircleRole("moderator", "member")).toBe(true)
    expect(canApproveCircleRole("moderator", "moderator")).toBe(false)
    expect(canApproveCircleRole("moderator", "admin")).toBe(false)
  })

  it("lets admins promote to moderator but reserves admin grants for owners", () => {
    expect(canApproveCircleRole("admin", "moderator")).toBe(true)
    expect(canApproveCircleRole("admin", "admin")).toBe(false)
    expect(canApproveCircleRole("owner", "admin")).toBe(true)
  })

  it("prevents admins changing other admins and prevents owner role edits", () => {
    expect(canAssignCircleRole("admin", "admin", "member")).toBe(false)
    expect(canAssignCircleRole("admin", "moderator", "moderator")).toBe(true)
    expect(canAssignCircleRole("admin", "member", "admin")).toBe(false)
    expect(canAssignCircleRole("owner", "admin", "moderator")).toBe(true)
    expect(canAssignCircleRole("owner", "owner", "member")).toBe(false)
  })

  it("only allows removal down the role hierarchy", () => {
    expect(canRemoveCircleMember("moderator", "member")).toBe(true)
    expect(canRemoveCircleMember("moderator", "moderator")).toBe(false)
    expect(canRemoveCircleMember("admin", "moderator")).toBe(true)
    expect(canRemoveCircleMember("admin", "admin")).toBe(false)
    expect(canRemoveCircleMember("owner", "admin")).toBe(true)
    expect(canRemoveCircleMember("owner", "owner")).toBe(false)
  })

  it("limits sensitive overrides to owner/admin and protects privileged roles", () => {
    expect(canManageMemberSettings("moderator", "member")).toBe(false)
    expect(canManageMemberSettings("admin", "member")).toBe(true)
    expect(canManageMemberSettings("admin", "admin")).toBe(false)
    expect(canManageMemberSettings("owner", "admin")).toBe(true)
    expect(canManageMemberSettings("owner", "owner")).toBe(false)
  })
})
