"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"

/**
 * Keeps the `dark` class on <html> in sync when custom themes are selected.
 *
 * next-themes adds the theme name as a class (e.g. "midnight", "sakura")
 * but does NOT add `dark` for themes it doesn't recognise. Components
 * throughout the app rely on `dark:` Tailwind prefixes and CSS selectors
 * like `.sakura.dark { ... }` — both require `dark` on <html>.
 */
const ALWAYS_DARK = new Set(["dark", "midnight"])

export function ThemeSync() {
  const { theme } = useTheme()

  useEffect(() => {
    const root = document.documentElement
    if (ALWAYS_DARK.has(theme ?? "")) {
      root.classList.add("dark")
    } else if (theme === "light") {
      root.classList.remove("dark")
    }
    // "sakura" / "forest" in light mode → no dark class
    // "sakura" / "forest" in system-dark → next-themes already sets resolvedTheme="dark"
    // so the .dark class is already handled by next-themes for those cases
  }, [theme])

  return null
}
