import type { CosmeticItem } from "@/lib/cosmetics"

/**
 * Curated Google Fonts for the "font" cosmetic category (display-name fonts).
 * Each preset maps to a CSS stack (used by `fontStyle()`) and the css2 URL
 * used to actually load the font — without loading, an equipped font silently
 * falls back to system fonts, so the loader injects these links on demand.
 */
export interface CosmeticFontPreset {
  family: string
  url: string
}

export const COSMETIC_FONT_PRESETS: Record<string, CosmeticFontPreset> = {
  inter: { family: "'Inter', sans-serif", url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" },
  poppins: { family: "'Poppins', sans-serif", url: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap" },
  playfair: { family: "'Playfair Display', Georgia, serif", url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap" },
  space_grotesk: { family: "'Space Grotesk', sans-serif", url: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" },
  jetbrains_mono: { family: "'JetBrains Mono', ui-monospace, monospace", url: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&display=swap" },
  fira_code: { family: "'Fira Code', ui-monospace, monospace", url: "https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&display=swap" },
  pacifico: { family: "'Pacifico', cursive", url: "https://fonts.googleapis.com/css2?family=Pacifico&display=swap" },
  bebas: { family: "'Bebas Neue', sans-serif", url: "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" },
  righteous: { family: "'Righteous', sans-serif", url: "https://fonts.googleapis.com/css2?family=Righteous&display=swap" },
  caveat: { family: "'Caveat', cursive", url: "https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap" },
  dancing_script: { family: "'Dancing Script', cursive", url: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;700&display=swap" },
  unbounded: { family: "'Unbounded', sans-serif", url: "https://fonts.googleapis.com/css2?family=Unbounded:wght@500;800&display=swap" },
  cinzel: { family: "'Cinzel', serif", url: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;800&display=swap" },
  orbitron: { family: "'Orbitron', sans-serif", url: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;800&display=swap" },
  press_start: { family: "'Press Start 2P', monospace", url: "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" },
  lobster: { family: "'Lobster', cursive", url: "https://fonts.googleapis.com/css2?family=Lobster&display=swap" },
  fredoka: { family: "'Fredoka', sans-serif", url: "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&display=swap" },
  sora: { family: "'Sora', sans-serif", url: "https://fonts.googleapis.com/css2?family=Sora:wght@400;700&display=swap" },
  manrope: { family: "'Manrope', sans-serif", url: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;800&display=swap" },
  amatic: { family: "'Amatic SC', cursive", url: "https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&display=swap" },
}

/** Reverse lookup: find a preset by CSS family stack (for legacy items). */
export function fontPresetForFamily(family?: string): CosmeticFontPreset | null {
  if (!family) return null
  const norm = family.toLowerCase()
  for (const preset of Object.values(COSMETIC_FONT_PRESETS)) {
    const f = preset.family.toLowerCase()
    // Compare the bare family name inside the stack, e.g. "'Poppins', sans-serif"
    const name = f.split(",")[0].replace(/['"]/g, "").trim()
    if (norm.includes(name)) return preset
  }
  return null
}

const loadedFontUrls = new Set<string>()

/**
 * Inject <link rel="stylesheet"> tags for the given cosmetic font items so an
 * equipped font actually renders. Deduped — each font loads once per page.
 */
export function ensureCosmeticFonts(fonts?: Array<CosmeticItem | null | undefined> | CosmeticItem | null | undefined) {
  if (typeof document === "undefined") return
  const list = Array.isArray(fonts) ? fonts : [fonts]
  for (const font of list) {
    if (!font) continue
    const data = font.item_data || {}
    const preset =
      (data.font_preset && COSMETIC_FONT_PRESETS[data.font_preset as string]) ||
      fontPresetForFamily(String(data.font_family || "")) ||
      (data.font_url ? { family: "", url: String(data.font_url) } : null)
    if (!preset?.url || loadedFontUrls.has(preset.url)) continue
    loadedFontUrls.add(preset.url)
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = preset.url
    document.head.appendChild(link)
  }
}
