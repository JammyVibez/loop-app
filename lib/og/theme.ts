/**
 * OG design system tokens.
 *
 * Every Open Graph image is drawn through satori, so this file only holds
 * values satori can actually paint: colours, gradients, radii, type sizes.
 * Nothing here reaches the client bundle — the OG route is the only consumer.
 *
 * Palette is Loop's real identity, not a fresh invention:
 *   - `#030712`  manifest background_color (the app's ink)
 *   - `#6366F1`  manifest theme_color
 *   - `#5E6AD2`  designTokens.palette.brand
 *   - `#7170FF`  designTokens.palette.accent
 */

export const CANVAS = { width: 1200, height: 630 } as const

export const palette = {
  /** App ink — the deepest background (manifest background_color). */
  ink: "#030712",
  inkSoft: "#070A18",
  /** Raised card surface. */
  panel: "#0B0F22",
  panelHigh: "#111735",

  brand: "#5E6AD2",
  accent: "#7170FF",
  indigo: "#6366F1",
  violet: "#8B5CF6",
  cyan: "#22D3EE",
  amber: "#F59E0B",
  rose: "#F43F5E",
  pink: "#EC4899",
  emerald: "#34D399",

  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.64)",
  textFaint: "rgba(255,255,255,0.42)",
  hairline: "rgba(255,255,255,0.10)",
  hairlineSoft: "rgba(255,255,255,0.06)",
} as const

export const fonts = {
  sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
} as const

/** Type scale — one place, so every template shares the same rhythm. */
export const typeScale = {
  display: 68,
  title: 54,
  heading: 42,
  subhead: 34,
  body: 28,
  caption: 22,
  label: 17,
} as const

/** Layout constants shared by every template. */
export const layout = {
  padX: 76,
  padTop: 58,
  padBottom: 52,
  radius: 30,
  radiusSm: 16,
  hairline: 1,
} as const

/**
 * A per-content-type accent. `base` drives chips, rules and the wash;
 * `second` only exists to build one restrained two-stop gradient.
 */
export interface Accent {
  key: string
  base: string
  second: string
}

export const accents: Record<string, Accent> = {
  home: { key: "home", base: palette.indigo, second: palette.violet },
  post: { key: "post", base: palette.accent, second: palette.indigo },
  profile: { key: "profile", base: palette.violet, second: palette.accent },
  community: { key: "community", base: palette.pink, second: palette.violet },
  space: { key: "space", base: palette.indigo, second: palette.cyan },
  duel: { key: "duel", base: palette.amber, second: palette.rose },
  coloop: { key: "co-op", base: palette.cyan, second: palette.indigo },
  reel: { key: "reel", base: palette.pink, second: palette.rose },
  project: { key: "project", base: palette.indigo, second: palette.cyan },
  event: { key: "event", base: palette.rose, second: palette.violet },
  challenge: { key: "challenge", base: palette.emerald, second: palette.cyan },
  fallback: { key: "loop", base: palette.indigo, second: palette.violet },
}

export function accentFor(key?: string | null): Accent {
  if (!key) return accents.fallback
  return accents[key] || accents.fallback
}

/**
 * One restrained wash used by the shell: a single soft radial anchored to a
 * corner. Deliberately low alpha — the brief is "designed, not glowing".
 */
export function wash(color: string, corner: "tl" | "tr" | "bl" | "br", alpha = 0.3): string {
  const coords: Record<string, string> = {
    tl: "0% 0%",
    tr: "100% 0%",
    bl: "0% 100%",
    br: "100% 100%",
  }
  return `radial-gradient(circle at ${coords[corner]}, rgba(${hexToRgb(color)}, ${alpha}) 0%, rgba(${hexToRgb(color)}, 0) 62%)`
}

export function withAlpha(hex: string, alpha: number): string {
  return `rgba(${hexToRgb(hex)}, ${alpha})`
}

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "")
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.slice(0, 6)
  const n = parseInt(full, 16)
  if (!Number.isFinite(n)) return "99,102,241"
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
