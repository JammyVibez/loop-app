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
  const { theme, systemTheme } = useTheme()

  useEffect(() => {
    const root = document.documentElement

    // Set data-theme attribute for CSS overrides
    if (theme && theme !== "system") {
      root.setAttribute("data-theme", theme)
    }

    // Dark is explicit for the two dark palettes; the system choice and
    // dual-mode palettes follow the OS preference. Previously every custom
    // palette was treated as dark, causing a light-to-dark mismatch after
    // hydration for Sakura/Forest and for the System setting.
    const isDark =
      theme === "dark" ||
      theme === "midnight" ||
      ((theme === "system" || theme === "sakura" || theme === "forest") && systemTheme === "dark")

    root.classList.toggle("dark", isDark)
  }, [theme, systemTheme])

  return null
}
