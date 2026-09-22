// @vitest-environment jsdom

/**
 * Home feed chrome budget.
 *
 * The feed used to open with five stacked promotional blocks. They now live
 * behind one slim row that the user can expand or dismiss, and the dismissal is
 * remembered across visits. The risky part is persistence: junk in storage must
 * fall back to the default row rather than throwing or silently showing chrome
 * the user asked to hide.
 */

import { beforeEach, describe, expect, it } from "vitest"
import {
  DEFAULT_HIGHLIGHTS_STATE,
  HIGHLIGHTS_STORAGE_KEY,
  areHighlightsCardsVisible,
  isHighlightsRowVisible,
  readHighlightsState,
  writeHighlightsState,
} from "@/lib/home-highlights"

beforeEach(() => {
  window.localStorage.clear()
})

describe("readHighlightsState", () => {
  it("defaults to collapsed and visible — never expanded on a first visit", () => {
    expect(readHighlightsState()).toEqual(DEFAULT_HIGHLIGHTS_STATE)
    expect(readHighlightsState().expanded).toBe(false)
    expect(readHighlightsState().dismissed).toBe(false)
  })

  it("round-trips an expanded row", () => {
    writeHighlightsState({ expanded: true, dismissed: false })
    expect(readHighlightsState()).toEqual({ expanded: true, dismissed: false })
  })

  it("round-trips a dismissed row", () => {
    writeHighlightsState({ expanded: false, dismissed: true })
    expect(readHighlightsState()).toEqual({ expanded: false, dismissed: true })
  })

  it("coerces junk to the safe default instead of trusting it", () => {
    window.localStorage.setItem(HIGHLIGHTS_STORAGE_KEY, "not json{")
    expect(readHighlightsState()).toEqual(DEFAULT_HIGHLIGHTS_STATE)

    window.localStorage.setItem(HIGHLIGHTS_STORAGE_KEY, JSON.stringify(["dismissed"]))
    expect(readHighlightsState()).toEqual(DEFAULT_HIGHLIGHTS_STATE)

    window.localStorage.setItem(HIGHLIGHTS_STORAGE_KEY, JSON.stringify("true"))
    expect(readHighlightsState()).toEqual(DEFAULT_HIGHLIGHTS_STATE)

    // Truthy-ish junk must not read as "dismissed" — only a real `true`.
    window.localStorage.setItem(HIGHLIGHTS_STORAGE_KEY, JSON.stringify({ dismissed: "yes" }))
    expect(readHighlightsState().dismissed).toBe(false)
  })

  it("survives storage throwing on read", () => {
    const original = window.localStorage.getItem
    window.localStorage.getItem = () => {
      throw new Error("SecurityError")
    }
    expect(() => readHighlightsState()).not.toThrow()
    expect(readHighlightsState()).toEqual(DEFAULT_HIGHLIGHTS_STATE)
    window.localStorage.getItem = original
  })

  it("survives storage throwing on write", () => {
    const original = window.localStorage.setItem
    window.localStorage.setItem = () => {
      throw new Error("QuotaExceededError")
    }
    expect(() => writeHighlightsState({ expanded: true, dismissed: false })).not.toThrow()
    window.localStorage.setItem = original
  })
})

describe("visibility helpers", () => {
  it("hides everything when dismissed", () => {
    const state = { expanded: true, dismissed: true }
    expect(isHighlightsRowVisible(state)).toBe(false)
    expect(areHighlightsCardsVisible(state)).toBe(false)
  })

  it("shows only the slim row when collapsed", () => {
    const state = { expanded: false, dismissed: false }
    expect(isHighlightsRowVisible(state)).toBe(true)
    expect(areHighlightsCardsVisible(state)).toBe(false)
  })

  it("shows the cards only when explicitly expanded", () => {
    const state = { expanded: true, dismissed: false }
    expect(isHighlightsRowVisible(state)).toBe(true)
    expect(areHighlightsCardsVisible(state)).toBe(true)
  })
})
