/**
 * Shared unread-message counter.
 *
 * Messages no longer have their own button in the top bar, so this count is the
 * only thing telling someone a message arrived — it has to be visible on the
 * avatar, the sidebar and the mobile nav at the same time, and those three must
 * never disagree.
 *
 * Polling from each surface separately meant three requests for one number
 * every fifteen seconds. This store owns one value, one in-flight request and
 * one interval, and notifies every subscriber on change. Kept free of React so
 * the behaviour can be tested directly.
 */

/** Fired when a conversation is read, so the badge clears without waiting. */
export const UNREAD_REFRESH_EVENT = "loop:unread-refresh"

export const DEFAULT_POLL_INTERVAL_MS = 15_000
export const UNREAD_ENDPOINT = "/api/messages/unread-count"

/**
 * Badge label for an unread count. Empty string when there is nothing to show,
 * and capped so it can never stretch a 32px avatar out of shape.
 */
export function formatUnreadBadge(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ""
  return value > 99 ? "99+" : String(Math.floor(value))
}

export interface UnreadMessagesStore {
  getCount(): number
  setToken(token: string | undefined): void
  /** Read the current total. Concurrent calls collapse into one request. */
  refresh(): Promise<void>
  /** Start the shared poller. One timer no matter how many surfaces use it. */
  acquire(): void
  /** Stop polling once the last surface goes away. */
  release(): void
  subscribe(listener: () => void): () => void
}

export function createUnreadMessagesStore(
  options: { fetchImpl?: typeof fetch; pollIntervalMs?: number } = {},
): UnreadMessagesStore {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS

  let count = 0
  let token: string | undefined
  let inFlight: Promise<void> | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let consumers = 0
  const listeners = new Set<() => void>()

  function emit() {
    for (const listener of listeners) listener()
  }

  function setCount(next: number) {
    const safe = Number.isFinite(next) && next > 0 ? Math.floor(next) : 0
    if (safe === count) return
    count = safe
    emit()
  }

  async function refresh() {
    if (!token) {
      setCount(0)
      return
    }
    if (inFlight) return inFlight

    inFlight = (async () => {
      try {
        const response = await fetchImpl(UNREAD_ENDPOINT, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        const data = await response.json()
        if (data?.success && typeof data.count === "number") {
          setCount(data.count)
        }
      } catch {
        // Keep the last known count: a failed poll is not proof of "no mail".
      } finally {
        inFlight = null
      }
    })()

    return inFlight
  }

  return {
    getCount: () => count,

    setToken(next) {
      token = next
      if (!next) setCount(0)
    },

    refresh,

    acquire() {
      consumers += 1
      if (!timer) {
        timer = setInterval(() => {
          void refresh()
        }, pollIntervalMs)
      }
    },

    release() {
      consumers = Math.max(0, consumers - 1)
      if (consumers === 0 && timer) {
        clearInterval(timer)
        timer = null
      }
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
