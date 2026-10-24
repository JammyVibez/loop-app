"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "loop-data-saver"

type DataSaverContextValue = {
  enabled: boolean
  setEnabled: (value: boolean) => void
  /** True when the browser admits the connection is slow or metered. */
  suggested: boolean
  dismissSuggestion: () => void
  /** True while the device reports it has no connection at all. */
  offline: boolean
}

const DataSaverContext = createContext<DataSaverContextValue>({
  enabled: false,
  setEnabled: () => {},
  suggested: false,
  dismissSuggestion: () => {},
  offline: false,
})

/**
 * Data-saver preference, kept in localStorage so it survives a reload and is
 * available to every surface (players, image loaders, effect layers) without a
 * round trip. The flag is also mirrored onto `<html data-data-saver>` so CSS
 * can stand down the decorative motion without React knowing anything.
 */
export function DataSaverProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false)
  const [suggested, setSuggested] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    try {
      setEnabledState(localStorage.getItem(STORAGE_KEY) === "on")
    } catch {
      /* private mode — default off */
    }
  }, [])

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value ? "on" : "off")
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.toggleAttribute("data-data-saver", enabled)
  }, [enabled])

  const dismissSuggestion = useCallback(() => setDismissed(true), [])

  // The Network Information API is the only hint we get without being asked.
  useEffect(() => {
    const update = () => {
      setOffline(typeof navigator !== "undefined" && navigator.onLine === false)
      if (enabled || dismissed) return
      const conn = (navigator as any).connection
      if (!conn) return
      const slow = ["slow-2g", "2g", "3g"].includes(String(conn.effectiveType || ""))
      if (slow || conn.saveData) setSuggested(true)
    }
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [enabled, dismissed])

  return (
    <DataSaverContext.Provider value={{ enabled, setEnabled, suggested, dismissSuggestion, offline }}>
      {children}
    </DataSaverContext.Provider>
  )
}

export function useDataSaver() {
  return useContext(DataSaverContext)
}

/**
 * The two quiet nudges: an offline strip when the connection is gone, and a
 * one-time offer when the browser admits the network is slow or metered.
 * Both sit above the mobile tab bar so they never cover navigation.
 */
export function DataSaverBanner() {
  const { enabled, setEnabled, suggested, dismissSuggestion, offline } = useDataSaver()
  if (offline) {
    return (
      <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-6">
        <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-600 shadow-lg backdrop-blur dark:text-amber-400">
          <WifiOff className="h-4 w-4" /> You&apos;re offline — showing saved content
        </div>
      </div>
    )
  }
  if (!suggested || enabled) return null
  return (
    <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-6">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xl">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Slow connection?</p>
          <p className="text-xs text-muted-foreground">
            Data saver stops autoplay, loads lighter images and calms down effects.
          </p>
        </div>
        <Button size="sm" className="shrink-0 rounded-full" onClick={() => setEnabled(true)}>
          Turn on
        </Button>
        <Button size="sm" variant="ghost" className="shrink-0 rounded-full" onClick={dismissSuggestion}>
          Not now
        </Button>
      </div>
    </div>
  )
}