"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Camera, Share2 } from "@/components/icons/lucide-compat"

type ScreenshotDetectorProps = {
  /** Whether to show toast notification on screenshot */
  enabled?: boolean
  /** Custom message shown on screenshot detection */
  message?: string
  /** Cooldown in ms between toasts (prevents spam) */
  cooldownMs?: number
}

/**
 * Detects screenshots in Capacitor native apps and shows a toast
 * encouraging users to use in-app Share instead.
 *
 * IMPORTANT: This is a deterrent layer only.
 * - Screenshot detection is ONLY possible in Capacitor (native) apps
 * - This CANNOT work in browsers (Chrome/Firefox/Safari don't expose APIs)
 * - Screenshot detection can notify but CANNOT prevent the screenshot
 * - Determined users can bypass via screen recording, dev tools, or a second device
 *
 * Detection methods (Capacitor only):
 * 1. Visibility API — detects when app goes to background (common during screenshots)
 * 2. Page visibility + focus loss combination
 * 3. Signal-based (when supported by native plugin)
 */
export function ScreenshotDetector({
  enabled = true,
  message = "Use the Share button to save this content!",
  cooldownMs = 5000,
}: ScreenshotDetectorProps) {
  const { toast } = useToast()
  const lastToastRef = useRef(0)
  const isCapacitorRef = useRef(false)
  const [isNative, setIsNative] = useState(false)

  // Detect if running in Capacitor
  useEffect(() => {
    if (typeof window === "undefined") return

    const isCapacitor =
      !!(window as any).Capacitor ||
      navigator.userAgent.includes("Capacitor") ||
      document.referrer.includes("capacitor://")

    isCapacitorRef.current = isCapacitor
    setIsNative(isCapacitor)
  }, [])

  const showScreenshotToast = useCallback(() => {
    if (!enabled) return

    const now = Date.now()
    if (now - lastToastRef.current < cooldownMs) return
    lastToastRef.current = now

    toast({
      title: "📸 Screenshot detected",
      description: message,
      duration: 4000,
    })
  }, [enabled, message, cooldownMs, toast])

  // Method 1: Visibility API (works when user pulls down notification shade for screenshot)
  useEffect(() => {
    if (!enabled || !isNative) return

    const handleVisibilityChange = () => {
      // On some Android devices, screenshots trigger a brief visibility change
      // Combined with focus loss, this suggests a screenshot
      if (document.visibilityState === "hidden") {
        // App went to background — could be screenshot or just app switch
        // We use a small delay to check if focus returns quickly (screenshot)
        const timer = setTimeout(() => {
          if (document.visibilityState === "visible") {
            // Quick background/foreground — likely a screenshot
            showScreenshotToast()
          }
        }, 200)

        const restore = () => {
          clearTimeout(timer)
          document.removeEventListener("visibilitychange", restore)
        }
        document.addEventListener("visibilitychange", restore)
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled, isNative, showScreenshotToast])

  // Method 2: Android volume-down + power detection via key events
  useEffect(() => {
    if (!enabled || !isNative) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Android screenshot combo: Volume Down + Power
      if (e.key === "VolumeDown" || e.key === "Power") {
        showScreenshotToast()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enabled, isNative, showScreenshotToast])

  // Method 3: Listen for native screenshot signals (if Capacitor plugin available)
  useEffect(() => {
    if (!enabled || !isNative) return

    const capacitor = (window as any).Capacitor
    if (!capacitor?.Plugins?.App) return

    // Some native apps can emit screenshot events via plugins
    // This is plugin-dependent and may not be available
    try {
      const appPlugin = capacitor.Plugins.App
      if (appPlugin.addListener) {
        const sub = appPlugin.addListener(
          "appStateChanged",
          (state: any) => {
            if (state?.isActive === false) {
              // Brief pause then back = possible screenshot
              setTimeout(() => {
                appPlugin.getState?.().then((s: any) => {
                  if (s?.isActive) showScreenshotToast()
                }).catch(() => {})
              }, 300)
            }
          }
        )
        return () => sub?.remove()
      }
    } catch {
      // Plugin not available — that's fine, other methods still work
    }
  }, [enabled, isNative, showScreenshotToast])

  // Don't render anything in browser — this is native-only
  if (!isNative || !enabled) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
      <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white/60 text-xs px-3 py-1.5 rounded-full">
        <Camera className="w-3 h-3" />
        <span>Screenshot protection active</span>
        <Share2 className="w-3 h-3" />
      </div>
    </div>
  )
}
