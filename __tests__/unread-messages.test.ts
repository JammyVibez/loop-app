import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createUnreadMessagesStore,
  formatUnreadBadge,
  UNREAD_ENDPOINT,
} from "@/lib/unread-messages"

type FetchArgs = Parameters<typeof fetch>

function jsonResponse(body: unknown) {
  return Promise.resolve({
    json: async () => body,
  } as Response)
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("formatUnreadBadge", () => {
  it("is empty when there is nothing to show", () => {
    expect(formatUnreadBadge(0)).toBe("")
    expect(formatUnreadBadge(-3)).toBe("")
    expect(formatUnreadBadge(Number.NaN)).toBe("")
  })

  it("caps the label so it cannot stretch the avatar", () => {
    expect(formatUnreadBadge(1)).toBe("1")
    expect(formatUnreadBadge(99)).toBe("99")
    expect(formatUnreadBadge(100)).toBe("99+")
    expect(formatUnreadBadge(4213)).toBe("99+")
  })
})

describe("unread messages store", () => {
  it("reads the count and notifies subscribers", async () => {
    const fetchImpl = vi.fn((..._args: FetchArgs) => jsonResponse({ success: true, count: 4 }))
    const store = createUnreadMessagesStore({ fetchImpl: fetchImpl as unknown as typeof fetch })
    const listener = vi.fn()
    store.subscribe(listener)

    store.setToken("token-1")
    await store.refresh()

    expect(store.getCount()).toBe(4)
    expect(listener).toHaveBeenCalled()
    expect(fetchImpl).toHaveBeenCalledWith(UNREAD_ENDPOINT, expect.objectContaining({
      headers: { Authorization: "Bearer token-1" },
    }))
  })

  it("sends one request when several surfaces ask at once", async () => {
    const fetchImpl = vi.fn((..._args: FetchArgs) => jsonResponse({ success: true, count: 2 }))
    const store = createUnreadMessagesStore({ fetchImpl: fetchImpl as unknown as typeof fetch })
    store.setToken("token-1")

    await Promise.all([store.refresh(), store.refresh(), store.refresh()])

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("keeps the last count when a poll fails", async () => {
    const fetchImpl = vi
      .fn((..._args: FetchArgs) => jsonResponse({ success: true, count: 7 }))
      .mockImplementationOnce(() => jsonResponse({ success: true, count: 7 }))
      .mockImplementation(() => Promise.reject(new Error("offline")))
    const store = createUnreadMessagesStore({ fetchImpl: fetchImpl as unknown as typeof fetch })
    store.setToken("token-1")

    await store.refresh()
    expect(store.getCount()).toBe(7)

    await store.refresh()
    // A failed poll is not proof of "no messages" — the badge must not vanish.
    expect(store.getCount()).toBe(7)
  })

  it("clears the badge when the token goes away", () => {
    const store = createUnreadMessagesStore({
      fetchImpl: (() => jsonResponse({ success: true, count: 3 })) as unknown as typeof fetch,
    })

    store.setToken("token-1")
    store.setToken(undefined)

    expect(store.getCount()).toBe(0)
  })

  it("runs a single timer shared by every consumer", async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn((..._args: FetchArgs) => jsonResponse({ success: true, count: 1 }))
    const store = createUnreadMessagesStore({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      pollIntervalMs: 1000,
    })
    store.setToken("token-1")

    store.acquire()
    store.acquire()
    store.acquire()

    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    // Polling must stop once the last surface unmounts — otherwise a signed-out
    // user keeps hitting the endpoint forever.
    store.release()
    store.release()
    store.release()
    await vi.advanceTimersByTimeAsync(5000)

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
