"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useAuth } from "@/hooks/use-auth"
import { createUnreadMessagesStore, UNREAD_REFRESH_EVENT } from "@/lib/unread-messages"

/**
 * One unread-message counter for the whole app — see lib/unread-messages.ts.
 *
 * The store is module-level so the avatar badge, the sidebar item and the
 * mobile nav tab all read the same number and flip together, and so only one
 * fifteen-second poll runs no matter how many of them are on screen.
 */
const store = createUnreadMessagesStore()

/** Re-read the unread total (e.g. right after marking a conversation read). */
export const refreshUnreadMessages = () => store.refresh()

export function useUnreadMessages(): number {
  const { user } = useAuth()
  const accessToken = user?.access_token || user?.token

  useEffect(() => {
    store.setToken(accessToken)

    if (!accessToken) return

    void store.refresh()
    store.acquire()

    // Coming back to the tab is a strong signal there is something new, and a
    // read receipt means the count just went down.
    const onSignal = () => {
      void store.refresh()
    }
    window.addEventListener("focus", onSignal)
    window.addEventListener(UNREAD_REFRESH_EVENT, onSignal)

    return () => {
      window.removeEventListener("focus", onSignal)
      window.removeEventListener(UNREAD_REFRESH_EVENT, onSignal)
      store.release()
    }
  }, [accessToken])

  return useSyncExternalStore(store.subscribe, store.getCount, () => 0)
}
