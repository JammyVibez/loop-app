"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

/**
 * Keeps both the `dark` class AND `data-theme` attribute on <html> in sync.
 *
 * - `dark` class: needed for Tailwind dark: prefixes and CSS variable cascade
 * - `data-theme` attribute: used by CSS overrides to remap hardcoded colors
 *   (e.g. `html[data-theme="midnight"] .bg-white { ... }`)
 *
 * This dual approach ensures themes work regardless of which element
 * next-themes puts the class on.
 */
export function ThemeSync() {
  const { theme } = useTheme()

  useEffect(() => {
    const root = document.documentElement

    // Set data-theme attribute for CSS overrides
    if (theme && theme !== "system") {
      root.setAttribute("data-theme", theme)
    }

    // Sync dark class: all non-light themes need it
    if (theme === "light" || !theme) {
      root.classList.remove("dark")
    } else {
      root.classList.add("dark")
    }
  }, [theme])

  return null
}
