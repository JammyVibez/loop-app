import { afterEach, describe, expect, it, vi } from "vitest"
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-reload"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("chunk-load recovery", () => {
  it("recognizes stale JavaScript and CSS chunk failures", () => {
    expect(isChunkLoadError(new Error("Loading chunk 42 failed"))).toBe(true)
    expect(isChunkLoadError(new Error("Loading CSS chunk failed"))).toBe(true)
    expect(isChunkLoadError(new Error("A normal API request failed"))).toBe(false)
  })

  it("navigates to a cache-busted URL once per retry window", () => {
    const replace = vi.fn()
    const storage = new Map<string, string>()
    const now = 1_800_000_000_000
    vi.spyOn(Date, "now").mockReturnValue(now)
    vi.stubGlobal("window", {
      location: { href: "https://loopapp.me/shop?tab=themes", replace },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    })

    expect(reloadOnceForChunkError()).toBe(true)
    expect(replace).toHaveBeenCalledTimes(1)
    const target = new URL(replace.mock.calls[0][0])
    expect(target.pathname).toBe("/shop")
    expect(target.searchParams.get("tab")).toBe("themes")
    expect(target.searchParams.get("__loop_chunk_reload")).toBe(String(now))
    expect(reloadOnceForChunkError()).toBe(false)
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it("prevents reloading again when a fresh load still fails", () => {
    const replace = vi.fn()
    vi.stubGlobal("window", {
      location: { href: "https://loopapp.me/shop", replace },
      sessionStorage: { getItem: () => "1799999999999", setItem: vi.fn() },
    })

    expect(reloadOnceForChunkError()).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })
})
