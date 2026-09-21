/**
 * Branch-tree limits.
 *
 * A post's author can cap how deep the tree grows and how many branches one
 * account adds. Both caps are optional — NULL/0 means "unlimited" — and the
 * old hardcoded 10-level ceiling this replaces is exactly what these tests
 * guard against regressing to.
 */

import { describe, expect, it } from "vitest"
import {
  exceedsDepthLimit,
  exceedsPerUserLimit,
  normalizeBranchLimit,
} from "@/lib/branch-limits"

describe("normalizeBranchLimit", () => {
  it("keeps positive whole numbers", () => {
    expect(normalizeBranchLimit(5)).toBe(5)
    expect(normalizeBranchLimit("12")).toBe(12)
  })

  it("treats 0, negatives, null and junk as unlimited", () => {
    expect(normalizeBranchLimit(0)).toBeNull()
    expect(normalizeBranchLimit(-3)).toBeNull()
    expect(normalizeBranchLimit(null)).toBeNull()
    expect(normalizeBranchLimit(undefined)).toBeNull()
    expect(normalizeBranchLimit("not-a-number")).toBeNull()
  })

  it("floors fractional values", () => {
    expect(normalizeBranchLimit(4.8)).toBe(4)
  })
})

describe("exceedsDepthLimit", () => {
  it("never blocks when the limit is unlimited", () => {
    expect(exceedsDepthLimit(0, null)).toBe(false)
    expect(exceedsDepthLimit(999, null)).toBe(false)
  })

  it("blocks a child once the parent sits at the cap", () => {
    // maxDepth 3 allows branches at levels 1..3; a parent already at 3 cannot
    // take a level-4 child.
    expect(exceedsDepthLimit(2, 3)).toBe(false)
    expect(exceedsDepthLimit(3, 3)).toBe(true)
    expect(exceedsDepthLimit(4, 3)).toBe(true)
  })

  it("allows a level-1 branch on a root post at the default cap", () => {
    expect(exceedsDepthLimit(0, 1)).toBe(false)
  })
})

describe("exceedsPerUserLimit", () => {
  it("never blocks when the limit is unlimited", () => {
    expect(exceedsPerUserLimit(50, null)).toBe(false)
  })

  it("blocks once the account has used its branches", () => {
    expect(exceedsPerUserLimit(0, 2)).toBe(false)
    expect(exceedsPerUserLimit(1, 2)).toBe(false)
    expect(exceedsPerUserLimit(2, 2)).toBe(true)
  })
})
