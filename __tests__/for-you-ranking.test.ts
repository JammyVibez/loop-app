import { describe, expect, it } from "vitest"
import {
  FOR_YOU_CONFIG,
  blendForYouFeed,
  candidateLimitForOffset,
  recencyDecay,
} from "@/lib/for-you-ranking"

type Item = { id: string; author_id: string; created_at: string }

function makeItems(prefix: string, count: number, authors = 5): Item[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    author_id: `${prefix}-author-${index % authors}`,
    created_at: new Date(Date.now() - index * 60_000).toISOString(),
  }))
}

describe("blendForYouFeed", () => {
  it("keeps the configured mix close across a full page", () => {
    const sources = {
      following: makeItems("f", 40, 8),
      trending: makeItems("t", 40, 8),
      discovery: makeItems("d", 40, 8),
    }
    const { items } = blendForYouFeed({ sources, limit: 40 })
    const counts = {
      following: items.filter((item) => item.id.startsWith("f-")).length,
      trending: items.filter((item) => item.id.startsWith("t-")).length,
      discovery: items.filter((item) => item.id.startsWith("d-")).length,
    }

    expect(items).toHaveLength(40)
    expect(counts.following).toBeGreaterThanOrEqual(14)
    expect(counts.following).toBeLessThanOrEqual(18)
    expect(counts.trending).toBeGreaterThanOrEqual(12)
    expect(counts.trending).toBeLessThanOrEqual(16)
    expect(counts.discovery).toBeGreaterThanOrEqual(8)
    expect(counts.discovery).toBeLessThanOrEqual(12)
  })

  it("deduplicates across sources without hiding previously viewed posts", () => {
    const shared: Item = { id: "shared", author_id: "a1", created_at: new Date().toISOString() }
    const sources = {
      following: [shared, ...makeItems("f", 10)],
      trending: [shared, ...makeItems("t", 10)],
      discovery: makeItems("d", 10),
    }
    const { items } = blendForYouFeed({ sources, limit: 20 })
    const ids = items.map((item) => item.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain("f-0")
    expect(ids).toContain("t-0")
    expect(ids.filter((id) => id === "shared")).toHaveLength(1)
  })

  it("never places more than two posts by the same author in a row", () => {
    const sources = {
      following: Array.from({ length: 12 }, (_, index) => ({
        id: `f-${index}`,
        author_id: "same",
        created_at: new Date().toISOString(),
      })),
      trending: Array.from({ length: 12 }, (_, index) => ({
        id: `t-${index}`,
        author_id: "same",
        created_at: new Date().toISOString(),
      })),
      discovery: Array.from({ length: 12 }, (_, index) => ({
        id: `d-${index}`,
        author_id: "same",
        created_at: new Date().toISOString(),
      })),
    }
    const { items } = blendForYouFeed({ sources, limit: 20 })

    expect(items.length).toBeLessThanOrEqual(FOR_YOU_CONFIG.maxConsecutivePerAuthor)
    for (let index = 2; index < items.length; index++) {
      expect(items[index].author_id).not.toBe(items[index - 2].author_id)
    }
  })

  it("pages deterministically with a stable overlap-free offset", () => {
    const sources = {
      following: makeItems("f", 60, 12),
      trending: makeItems("t", 60, 12),
      discovery: makeItems("d", 60, 12),
    }
    const first = blendForYouFeed({ sources, limit: 20, offset: 0 })
    const second = blendForYouFeed({ sources, limit: 20, offset: 20 })
    const firstIds = new Set(first.items.map((item) => item.id))

    expect(first.hasMore).toBe(true)
    expect(second.items).toHaveLength(20)
    expect(second.items.some((item) => firstIds.has(item.id))).toBe(false)
    expect(second.hasMore).toBe(true)
  })
})

describe("candidateLimitForOffset", () => {
  it("grows with pagination and never exceeds the configured maximum", () => {
    expect(candidateLimitForOffset(0, 20)).toBe(FOR_YOU_CONFIG.candidateLimitBase)
    expect(candidateLimitForOffset(400, 20)).toBe(FOR_YOU_CONFIG.candidateLimitMax)
  })
})

describe("recencyDecay", () => {
  it("halves at the configured half-life", () => {
    const now = Date.now()
    const createdAt = new Date(now - 36 * 3_600_000).toISOString()
    expect(recencyDecay(createdAt, 36, now)).toBeCloseTo(0.5, 4)
  })
})
