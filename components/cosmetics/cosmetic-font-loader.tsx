"use client"

import { useEffect } from "react"
import { ensureCosmeticFonts } from "@/lib/cosmetic-fonts"

/**
 * Mounted once at the app root. Whenever the user applies a font cosmetic
 * (or anything dispatches `loop-cosmetics-applied`), the font's Google Fonts
 * stylesheet is injected so the new display name renders immediately. Each
 * font loads only once per page (deduped in lib/cosmetic-fonts).
 */
export function CosmeticFontLoader() {
  useEffect(() => {
    const onCosmetics = (e: Event) => {
      const detail = (e as CustomEvent).detail
      ensureCosmeticFonts(detail?.font)
    }
    window.addEventListener("loop-cosmetics-applied", onCosmetics)
    return () => window.removeEventListener("loop-cosmetics-applied", onCosmetics)
  }, [])
  return null
}
