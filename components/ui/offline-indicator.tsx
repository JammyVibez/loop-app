"use client"

import { useState, useEffect, useCallback } from "react"
import { WifiOff, Wifi, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Floating online/offline indicator that appears at the top of the screen.
 * Shows a subtle bar when offline and auto-hides when back online.
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [showBanner, setShowBanner] = useState(false)
  const [justReconnected, setJustReconnected] = useState(false)

  useEffect(() => {
    // Set initial state
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine)
    }

    const handleOnline = () => {
      setIsOnline(true)
      setJustReconnected(true)
      setShowBanner(true)
      setTimeout(() => {
        setShowBanner(false)
        setJustReconnected(false)
      }, 3000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setJustReconnected(false)
      setShowBanner(true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Show offline banner if already offline on mount
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setShowBanner(true)
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!showBanner) return null

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-500",
        justReconnected
          ? "bg-emerald-500 text-white animate-in slide-in-from-top"
          : "bg-amber-500/90 text-white backdrop-blur-sm animate-in slide-in-from-top"
      )}
    >
      {justReconnected ? (
        <>
          <Check className="h-4 w-4" />
          <span>You&apos;re back online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>You&apos;re offline — cached content is still available</span>
        </>
      )}
      <button
        onClick={() => setShowBanner(false)}
        className="ml-2 rounded-full p-0.5 hover:bg-white/20 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/**
 * Hook to track online/offline status with a slight delay to avoid flicker
 * on brief network interruptions.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [isStable, setIsStable] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    let timeout: NodeJS.Timeout | null = null

    const handleOffline = () => {
      setIsStable(false)
      setIsOnline(false)
      // After 2s of being offline, mark as stable
      timeout = setTimeout(() => setIsStable(true), 2000)
    }

    const handleOnline = () => {
      setIsOnline(true)
      setIsStable(false)
      // After 1s of being online, mark as stable
      timeout = setTimeout(() => setIsStable(true), 1000)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      if (timeout) clearTimeout(timeout)
    }
  }, [])

  return { isOnline, isStable }
}
