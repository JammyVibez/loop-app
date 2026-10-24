import { describe, expect, it } from "vitest"
import {
  DEFAULT_THREAD_POLICY,
  decideThreadCreation,
  readThreadPolicy,
} from "@/lib/community-thread-policy"

const staff = { isStaff: true, isMember: true, hasPermission: true, assignedRoleIds: [] as number[] }
const plainMember = { isStaff: false, isMember: true, hasPermission: true, assignedRoleIds: [] as number[] }

describe("readThreadPolicy", () => {
  it("defaults to members when nothing is stored", () => {
    expect(readThreadPolicy(undefined)).toEqual(DEFAULT_THREAD_POLICY)
    expect(readThreadPolicy(null)).toEqual(DEFAULT_THREAD_POLICY)
    expect(readThreadPolicy({})).toEqual({ mode: "members", roles: [] })
    expect(readThreadPolicy({ thread_creation: null })).toEqual({ mode: "members", roles: [] })
  })

  it("reads a stored role-gated policy and sanitizes the ids", () => {
    expect(
      readThreadPolicy({ thread_creation: { mode: "roles", roles: [3, 7, "7", -1, Number.NaN, 0] } }),
    ).toEqual({ mode: "roles", roles: [3, 7] })
  })

  it("falls back to members for an unknown mode", () => {
    expect(readThreadPolicy({ thread_creation: { mode: "whatever", roles: [2] } })).toEqual({
      mode: "members",
      roles: [],
    })
  })

  it("tolerates non-object settings", () => {
    expect(readThreadPolicy("nonsense")).toEqual({ mode: "members", roles: [] })
    expect(readThreadPolicy([])).toEqual({ mode: "members", roles: [] })
  })
})

describe("decideThreadCreation", () => {
  it("lets every permitted member start threads by default", () => {
    const d = decideThreadCreation({ policy: DEFAULT_THREAD_POLICY, ...plainMember })
    expect(d).toMatchObject({ allowed: true, reason: "ok" })
  })

  it("blocks people who are not members", () => {
    const d = decideThreadCreation({
      policy: DEFAULT_THREAD_POLICY,
      isMember: false,
      isStaff: false,
      hasPermission: true,
      assignedRoleIds: [],
    })
    expect(d).toMatchObject({ allowed: false, reason: "not_member" })
  })

  it("blocks a member without the Open threads Power", () => {
    const d = decideThreadCreation({
      policy: DEFAULT_THREAD_POLICY,
      ...plainMember,
      hasPermission: false,
    })
    expect(d).toMatchObject({ allowed: false, reason: "no_permission" })
  })

  it("gates role-gated communities to the chosen roles only", () => {
    const policy = { mode: "roles" as const, roles: [5, 9] }
    expect(
      decideThreadCreation({ policy, ...plainMember, assignedRoleIds: [5] }),
    ).toMatchObject({ allowed: true, reason: "ok" })
    expect(
      decideThreadCreation({ policy, ...plainMember, assignedRoleIds: [12] }),
    ).toMatchObject({ allowed: false, reason: "role_required" })
    expect(decideThreadCreation({ policy, ...plainMember })).toMatchObject({
      allowed: false,
      reason: "role_required",
      emptyPolicy: false,
    })
  })

  it("warns when a community gated threads onto no roles at all", () => {
    const d = decideThreadCreation({
      policy: { mode: "roles", roles: [] },
      ...plainMember,
    })
    expect(d).toMatchObject({ allowed: false, reason: "role_required", emptyPolicy: true })
  })

  it("keeps staff above the policy", () => {
    expect(
      decideThreadCreation({
        policy: { mode: "roles", roles: [] },
        ...staff,
        hasPermission: false,
      }),
    ).toMatchObject({ allowed: true, reason: "ok" })
  })
})
