/**
 * Feed density pass.
 *
 * Two rules this pins down:
 *
 * 1. `{value && <X/>}` in JSX renders a literal "0" when `value` is the number
 *    zero. A post's meta row read "@handle · 2 days ago0" because
 *    `engagement_score` is a number and the guard wasn't a boolean. Anything
 *    that feeds a JSX `&&` guard must already be a boolean.
 * 2. Counts only earn space next to an action icon when they're greater than
 *    zero, so a fresh post shows quiet icons instead of "0 0 0 0".
 */

import { describe, expect, it } from "vitest"
import { normalizeLoop } from "@/lib/normalize-loop"
import { hasAnyFlag, shouldShowCount } from "@/lib/feed-density"

describe("normalizeLoop numeric fields never leak into JSX guards", () => {
  it("coerces is_featured to a real boolean", () => {
    // A database returning 0/1 for a boolean column is the exact case that
    // printed a stray "0" after the timestamp.
    expect(normalizeLoop({ id: "a", is_featured: 0 } as any).is_featured).toBe(false)
    expect(normalizeLoop({ id: "a", is_featured: 1 } as any).is_featured).toBe(true)
    expect(normalizeLoop({ id: "a", is_featured: null } as any).is_featured).toBe(false)
    expect(normalizeLoop({ id: "a", is_featured: "true" } as any).is_featured).toBe(true)
  })

  it("keeps the other boolean flags boolean", () => {
    const loop = normalizeLoop({
      id: "a",
      comments_disabled: 0,
      is_pinned: 0,
      link_preview_disabled: 0,
      is_spoiler: 0,
    } as any)
    for (const value of [
      loop.comments_disabled,
      loop.is_pinned,
      loop.link_preview_disabled,
      loop.is_spoiler,
    ]) {
      expect(typeof value).toBe("boolean")
    }
  })

  it("still exposes engagement_score as a number (it is compared, not guarded)", () => {
    expect(normalizeLoop({ id: "a", engagement_score: 0 } as any).engagement_score).toBe(0)
    expect(typeof normalizeLoop({ id: "a", engagement_score: 12 } as any).engagement_score).toBe(
      "number",
    )
  })

  it("treats a zero engagement score as not-hot", () => {
    const score = normalizeLoop({ id: "a", engagement_score: 0 } as any).engagement_score
    expect(Number(score) > 80).toBe(false)
  })
})

describe("shouldShowCount", () => {
  it("hides zero (the whole point of the rule)", () => {
    expect(shouldShowCount(0)).toBe(false)
  })

  it("shows anything above zero", () => {
    expect(shouldShowCount(1)).toBe(true)
    expect(shouldShowCount(2400)).toBe(true)
  })

  it("hides values that would print junk", () => {
    expect(shouldShowCount(undefined)).toBe(false)
    expect(shouldShowCount(null)).toBe(false)
    expect(shouldShowCount(NaN)).toBe(false)
    expect(shouldShowCount("not-a-number")).toBe(false)
    expect(shouldShowCount(-3)).toBe(false)
  })

  it("accepts numeric strings from the API", () => {
    expect(shouldShowCount("0")).toBe(false)
    expect(shouldShowCount("7")).toBe(true)
  })
})

describe("hasAnyFlag", () => {
  it("is false when nothing is set, so no empty status row renders", () => {
    expect(hasAnyFlag([false, false, false])).toBe(false)
    expect(hasAnyFlag([])).toBe(false)
  })

  it("is true when at least one flag is set", () => {
    expect(hasAnyFlag([false, true])).toBe(true)
  })
})
