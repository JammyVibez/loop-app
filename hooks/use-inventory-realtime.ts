"use client"

import { useEffect, useRef } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"

/**
 * Live inventory for the current user: fires `onChanged` whenever any row in
 * `user_inventory` is inserted, updated (equipped/deactivated) or deleted for
 * this user — so purchases, applies and admin grants show up instantly
 * without a page refresh. Requires `user_inventory` in the realtime
 * publication (see scripts/cosmetics-realtime-schema.sql).
 */
export function useInventoryRealtime(userId: string | undefined, onChanged: () => void) {
  const cbRef = useRef(onChanged)
  cbRef.current = onChanged

  useEffect(() => {
    if (!userId) return
    const supabase = getSupabaseBrowserClient()
    const channel = supabase
      .channel(`inventory-live:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_inventory", filter: `user_id=eq.${userId}` },
        () => cbRef.current(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])
}
