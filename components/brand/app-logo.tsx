"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const FALLBACK_LOGO = "/icons/icon.svg"

/**
 * AppLogo — the brand mark used in the header, sidebar, and auth screens.
 *
 * Reads the admin-configured logo (`admin_settings.app_logo.logo_url`) so an
 * admin can rebrand the app at any time without a deploy. Listens for the
 * `loop-logo-changed` window event so every mounted instance updates instantly.
 */
export function AppLogo({
  className,
  showWordmark = false,
  wordmarkClass,
}: {
  className?: string
  showWordmark?: boolean
  wordmarkClass?: string
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const apply = (url: string | null) => {
      if (active) setLogoUrl(url)
    }
    const applyFromCache = () => {
      try {
        const cached = sessionStorage.getItem("loop-app-logo")
        if (cached) apply(cached)
      } catch {
        /* ignore */
      }
    }
    const fetchLogo = () => {
      fetch("/api/admin/settings", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const url = data?.settings?.app_logo?.logo_url || data?.data?.app_logo?.logo_url || null
          if (url) {
            apply(url)
            try {
              sessionStorage.setItem("loop-app-logo", url)
            } catch {
              /* ignore */
            }
          }
        })
        .catch(() => {})
    }
    applyFromCache()
    fetchLogo()
    window.addEventListener("loop-logo-changed", fetchLogo as EventListener)
    return () => {
      active = false
      window.removeEventListener("loop-logo-changed", fetchLogo as EventListener)
    }
  }, [])

  const src = logoUrl || FALLBACK_LOGO

  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Loop"
        className={cn("h-9 w-9 rounded-xl object-cover", className)}
        onError={() => setLogoUrl(null)}
      />
      {showWordmark && (
        <span
          className={cn(
            "text-lg font-extrabold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-indigo-600 bg-clip-text text-transparent",
            wordmarkClass,
          )}
        >
          LOOP
        </span>
      )}
    </span>
  )
}
