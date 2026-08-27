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
 * Strategy: keep `dark` on <html> for ALL non-light themes.
 * Theme-specific CSS (e.g. `.sakura.dark { --background: ... }`) has
 * higher specificity than `.dark { ... }`, so the theme overrides win.
 */
export function ThemeSync() {
  const { theme } = useTheme()

  useEffect(() => {
    const root = document.documentElement
    if (theme === "light" || !theme) {
      root.classList.remove("dark")
    } else {
      // dark, midnight, sakura, forest → all need dark class
      root.classList.add("dark")
    }
  }, [theme])

  return null
}
