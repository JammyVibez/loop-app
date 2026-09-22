/**
 * Spotlight shelf vs. the main grid.
 *
 * Spotlight renders the rarest cards in a horizontal row above the grid. Both
 * used to draw from the same list, so every spotlighted item appeared a second
 * time immediately below itself — which is what made the storefront read as
 * duplicated and messy.
 */

import { describe, expect, it } from "vitest"
import { excludeSpotlight } from "@/lib/shop-catalog"

const item = (id: string) => ({ id, name: id })

describe("excludeSpotlight", () => {
  it("drops items already shown on the shelf", () => {
    const all = [item("a"), item("b"), item("c"), item("d")]
    const shelf = [item("b"), item("d")]
    expect(excludeSpotlight(all, shelf).map((i) => i.id)).toEqual(["a", "c"])
  })

  it("keeps the original order of what remains", () => {
    const all = [item("a"), item("b"), item("c")]
    expect(excludeSpotlight(all, [item("a")]).map((i) => i.id)).toEqual(["b", "c"])
  })

  it("is a no-op when the shelf is empty", () => {
    const all = [item("a"), item("b")]
    expect(excludeSpotlight(all, [])).toBe(all)
  })

  it("does not mutate the input list", () => {
    const all = [item("a"), item("b"), item("c")]
    excludeSpotlight(all, [item("a")])
    expect(all.map((i) => i.id)).toEqual(["a", "b", "c"])
  })

  it("ignores shelf entries that are not in the list", () => {
    const all = [item("a"), item("b")]
    expect(excludeSpotlight(all, [item("z")]).map((i) => i.id)).toEqual(["a", "b"])
  })

  it("handles the shelf holding the entire list", () => {
    const all = [item("a"), item("b")]
    expect(excludeSpotlight(all, all)).toEqual([])
  })
})
