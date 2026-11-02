import { describe, expect, it } from "vitest"
import { diversifyByAuthor } from "@/lib/discovery-ranking"

const item = (id: string, author_id: string) => ({ id, author_id })

describe("personalized discovery diversity", () => {
  it("limits the first pass to two recommendations per creator", () => {
    const ranked = [
      item("a1", "author-a"),
      item("a2", "author-a"),
      item("a3", "author-a"),
      item("b1", "author-b"),
      item("c1", "author-c"),
    ]

    expect(diversifyByAuthor(ranked, 4).map((entry) => entry.id)).toEqual([
      "a1",
      "a2",
      "b1",
      "c1",
    ])
  })

  it("fills the page from the ranked tail when few creators are available", () => {
    const ranked = [
      item("a1", "author-a"),
      item("a2", "author-a"),
      item("a3", "author-a"),
      item("a4", "author-a"),
    ]

    expect(diversifyByAuthor(ranked, 4).map((entry) => entry.id)).toEqual([
      "a1",
      "a2",
      "a3",
      "a4",
    ])
  })

  it("returns an empty page for non-positive limits", () => {
    expect(diversifyByAuthor([item("a1", "author-a")], 0)).toEqual([])
    expect(diversifyByAuthor([item("a1", "author-a")], 5, 0)).toEqual([])
  })

  it("does not return duplicate ids", () => {
    const ranked = [
      item("same", "author-a"),
      item("same", "author-b"),
      item("other", "author-b"),
    ]

    expect(diversifyByAuthor(ranked, 3).map((entry) => entry.id)).toEqual([
      "same",
      "other",
    ])
  })
})
