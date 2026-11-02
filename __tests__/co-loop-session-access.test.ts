import { describe, expect, it } from "vitest"
import { isCoLoopParticipant } from "@/lib/co-loop-session-access"

describe("isCoLoopParticipant", () => {
  it("recognizes the host", () => {
    expect(isCoLoopParticipant({ owner_id: "host-1", co_authors: [] }, "host-1")).toBe(true)
  })

  it("recognizes a persisted co-author", () => {
    expect(isCoLoopParticipant({ owner_id: "host-1", co_authors: [{ id: "writer-2" }] }, "writer-2")).toBe(true)
  })

  it("rejects users outside the roster and malformed rosters", () => {
    expect(isCoLoopParticipant({ owner_id: "host-1", co_authors: [{ id: "writer-2" }] }, "visitor-3")).toBe(false)
    expect(isCoLoopParticipant({ owner_id: "host-1", co_authors: "writer-2" }, "writer-2")).toBe(false)
    expect(isCoLoopParticipant({ owner_id: "host-1", co_authors: [null, { user_id: "writer-2" }] }, "writer-2")).toBe(false)
  })
})
