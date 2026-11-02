import { describe, expect, it } from "vitest"
import {
  decideCoLoopInvitationResponse,
  decideCoLoopJoin,
  isCoLoopParticipant,
  isRevokedCoLoopInvitationStatus,
} from "@/lib/co-loop-session-access"

describe("isCoLoopParticipant", () => {
  it("recognizes the host and persisted co-authors", () => {
    expect(isCoLoopParticipant({ owner_id: "host-1", co_authors: [] }, "host-1")).toBe(true)
    expect(isCoLoopParticipant({ owner_id: "host-1", co_authors: [{ id: "writer-2" }] }, "writer-2")).toBe(true)
  })

  it("rejects users outside the roster and malformed rosters", () => {
    expect(isCoLoopParticipant({ owner_id: "host-1", co_authors: [{ id: "writer-2" }] }, "visitor-3")).toBe(false)
    expect(isCoLoopParticipant({ owner_id: "host-1", co_authors: "writer-2" }, "writer-2")).toBe(false)
    expect(isCoLoopParticipant({ owner_id: "host-1", co_authors: [null, { user_id: "writer-2" }] }, "writer-2")).toBe(false)
  })
})

describe("decideCoLoopJoin", () => {
  const session = { owner_id: "host-1", co_authors: [{ id: "writer-2" }], status: "active", locked: false }

  it("allows existing participants", () => {
    expect(decideCoLoopJoin(session, "host-1", false)).toBe("allowed")
    expect(decideCoLoopJoin(session, "writer-2", false)).toBe("allowed")
  })

  it("requires a direct invite for a new collaborator", () => {
    expect(decideCoLoopJoin(session, "visitor-3", false)).toBe("not_invited")
    expect(decideCoLoopJoin(session, "visitor-3", true)).toBe("allowed")
  })

  it("fails closed for deleted, inactive and locked sessions", () => {
    expect(decideCoLoopJoin({ ...session, deleted_at: "2026-01-01" }, "visitor-3", true)).toBe("deleted")
    expect(decideCoLoopJoin({ ...session, status: "ended" }, "visitor-3", true)).toBe("inactive")
    expect(decideCoLoopJoin({ ...session, locked: true }, "visitor-3", true)).toBe("locked")
  })
})


describe("Co-Loop invitation revocation", () => {
  it("treats declined, revoked and expired invitation states as denials", () => {
    expect(isRevokedCoLoopInvitationStatus("declined")).toBe(true)
    expect(isRevokedCoLoopInvitationStatus("revoked")).toBe(true)
    expect(isRevokedCoLoopInvitationStatus("expired")).toBe(true)
  })

  it("keeps pending and accepted invitations distinct from revoked ones", () => {
    expect(isRevokedCoLoopInvitationStatus("pending")).toBe(false)
    expect(isRevokedCoLoopInvitationStatus("accepted")).toBe(false)
    expect(isRevokedCoLoopInvitationStatus(null)).toBe(false)
    expect(isRevokedCoLoopInvitationStatus(undefined)).toBe(false)
  })
})


describe("Co-Loop invitation response eligibility", () => {
  const activeRoom = {
    owner_id: "host-1",
    co_authors: [],
    status: "active",
    locked: false,
  }

  it("allows acceptance only while the room is active and unlocked", () => {
    expect(decideCoLoopInvitationResponse(activeRoom, "pending", "accepted")).toBe("allowed")
    expect(decideCoLoopInvitationResponse({ ...activeRoom, status: "ended" }, "pending", "accepted")).toBe("inactive")
    expect(decideCoLoopInvitationResponse({ ...activeRoom, status: "published" }, "pending", "accepted")).toBe("inactive")
    expect(decideCoLoopInvitationResponse({ ...activeRoom, locked: true }, "pending", "accepted")).toBe("locked")
  })

  it("allows decline after a room ends or is locked", () => {
    expect(decideCoLoopInvitationResponse({ ...activeRoom, status: "ended" }, "pending", "declined")).toBe("allowed")
    expect(decideCoLoopInvitationResponse({ ...activeRoom, locked: true }, "pending", "declined")).toBe("allowed")
  })

  it("keeps duplicate and stale responses idempotent or denied", () => {
    expect(decideCoLoopInvitationResponse(activeRoom, "accepted", "accepted")).toBe("already_accepted")
    expect(decideCoLoopInvitationResponse(activeRoom, "accepted", "declined")).toBe("already_responded")
    expect(decideCoLoopInvitationResponse(activeRoom, "revoked", "accepted")).toBe("already_responded")
    expect(decideCoLoopInvitationResponse({ ...activeRoom, deleted_at: "2026-11-01" }, "pending", "declined")).toBe("deleted")
  })
})
