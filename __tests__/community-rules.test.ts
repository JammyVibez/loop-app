import { describe, expect, it } from "vitest"
import { normalizeRules } from "@/lib/community-rules"

describe("normalizeRules", () => {
  it("unwraps the { rules: [...] } shape the creation wizard saves", () => {
    expect(normalizeRules({ rules: ["Be kind", "No spoilers"] })).toEqual(["Be kind", "No spoilers"])
  })

  it("accepts a bare array", () => {
    expect(normalizeRules(["Be kind", "No spam"])).toEqual(["Be kind", "No spam"])
  })

  it("reads object entries and drops unknown shapes", () => {
    expect(normalizeRules([{ text: "Credit artists" }, { title: "Stay on topic" }, { nope: 1 }, 42])).toEqual([
      "Credit artists",
      "Stay on topic",
    ])
  })

  it("splits a legacy newline-joined string into separate rules", () => {
    expect(normalizeRules("Be kind\nNo spoilers\n")).toEqual(["Be kind", "No spoilers"])
  })

  it("de-duplicates, trims, and ignores empty values", () => {
    expect(normalizeRules({ rules: ["  Be kind ", "Be kind", "", "   "] })).toEqual(["Be kind"])
  })

  it("returns an empty list for missing or unusable data", () => {
    expect(normalizeRules(null)).toEqual([])
    expect(normalizeRules(undefined)).toEqual([])
    expect(normalizeRules({})).toEqual([])
    expect(normalizeRules(12)).toEqual([])
  })

  it("caps very long rule lists", () => {
    const many = Array.from({ length: 30 }, (_, i) => `Rule ${i}`)
    expect(normalizeRules(many)).toHaveLength(20)
  })
})
