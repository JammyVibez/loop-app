"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

/**
 * Keeps the `dark` class on <html> in sync when custom themes are selected.
 *
 * next-themes adds the theme name as a class (e.g. "midnight", "sakura")
 * but only adds `dark` for themes it recognises. Components throughout
 * the app rely on `dark:` Tailwind prefixes and CSS selectors like
 * `.sakura.dark { ... }` — both require `dark` on <html>.
 *
 * This component ensures `dark` is present whenever the effective color
 * scheme is dark, regardless of which theme is active.
 */

/** Themes that are always dark, regardless of system preference */
const ALWAYS_DARK = new Set(["dark", "midnight"])

export function ThemeSync() {
  const { theme, resolvedTheme } = useTheme()

  useEffect(() => {
    const root = document.documentElement

    // If the theme itself is always-dark → force dark
    if (ALWAYS_DARK.has(theme ?? "")) {
      root.classList.add("dark")
      return
    }

    // If resolvedTheme says "dark" (system preference is dark) → dark
    if (resolvedTheme === "dark") {
      root.classList.add("dark")
      return
    }

    // For sakura/forest in light mode, or light theme → no dark class
    root.classList.remove("dark")
  }, [theme, resolvedTheme])

  return null
}
