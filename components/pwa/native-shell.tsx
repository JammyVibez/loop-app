"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import {
  initNativeShell,
  isNative,
  listenForNativePushTaps,
  registerNativePush,
  syncNativePushToken,
  unregisterNativePush,
} from "@/lib/native"

/**
 * Runs only inside the Capacitor shell. Boots the native UI (status bar,
 * splash, back button), registers this device for FCM push when a user is
 * signed in, and routes notification taps to their deep link.
 */
export function NativeShell() {
  const { user, getAuthHeader } = useAuth()
  const booted = useRef(false)
  const registered = useRef<string | null>(null)

  useEffect(() => {
    if (!isNative()) return
    if (!booted.current) {
      booted.current = true
      void initNativeShell()
      void listenForNativePushTaps()
    }
  }, [])

  useEffect(() => {
    if (!isNative()) return
    if (!user?.id) return
    if (registered.current === user.id) return
    registered.current = user.id

    let cancelled = false
    const run = async () => {
      const result = await registerNativePush()
      if (!result || cancelled) return
      await syncNativePushToken(result.token, result.platform, getAuthHeader())
    }
    void run()

    return () => {
      cancelled = true
    }
  }, [user?.id, getAuthHeader])

  // Remove the FCM token when the user signs out.
  useEffect(() => {
    if (!isNative()) return
    if (user?.id) return
    void unregisterNativePush(null)
  }, [user?.id])

  return null
}
