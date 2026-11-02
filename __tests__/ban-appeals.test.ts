import { describe, expect, it } from "vitest"
import { parseBanAppealReview } from "@/lib/ban-appeals"

const appealId = "11111111-1111-4111-8111-111111111111"

describe("parseBanAppealReview", () => {
  it("accepts approval with an optional note", () => {
    expect(parseBanAppealReview({ appeal_id: appealId, decision: "approve" })).toEqual({
      ok: true,
      value: { appealId, decision: "approve", adminNotes: null },
    })
  })

  it("requires an explanation when an appeal is denied", () => {
    expect(parseBanAppealReview({ appeal_id: appealId, decision: "deny" })).toMatchObject({ ok: false })
    expect(parseBanAppealReview({ appeal_id: appealId, decision: "deny", admin_notes: "  " })).toMatchObject({ ok: false })
    expect(parseBanAppealReview({ appeal_id: appealId, decision: "deny", admin_notes: "The suspension remains supported by the reviewed evidence." })).toMatchObject({
      ok: true,
      value: { appealId, decision: "deny", adminNotes: "The suspension remains supported by the reviewed evidence." },
    })
  })

  it("rejects malformed IDs, invalid decisions and invalid bodies", () => {
    expect(parseBanAppealReview({ appeal_id: "appeal-1", decision: "approve" })).toMatchObject({ ok: false })
    expect(parseBanAppealReview({ appeal_id: appealId, decision: "dismiss" })).toMatchObject({ ok: false })
    expect(parseBanAppealReview(null)).toMatchObject({ ok: false })
    expect(parseBanAppealReview([])).toMatchObject({ ok: false })
  })

  it("bounds reviewer notes and rejects non-text", () => {
    expect(parseBanAppealReview({ appeal_id: appealId, decision: "approve", admin_notes: "x".repeat(2001) })).toMatchObject({ ok: false })
    expect(parseBanAppealReview({ appeal_id: appealId, decision: "approve", admin_notes: 42 })).toMatchObject({ ok: false })
  })
})
