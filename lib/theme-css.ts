/** Convert #RRGGBB / #RGB to HSL components for shadcn CSS vars (no hsl() wrapper) */
export function hexToHslComponents(hex: string): string | null {
  if (!hex || typeof hex !== "string") return null
  let raw = hex.trim().replace("#", "")
  if (raw.length === 3) {
    raw = raw
      .split("")
      .map((c) => c + c)
      .join("")
  }
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null

  const r = Number.parseInt(raw.slice(0, 2), 16) / 255
  const g = Number.parseInt(raw.slice(2, 4), 16) / 255
  const b = Number.parseInt(raw.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      default:
        h = ((r - g) / d + 4) / 6
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function contrastForeground(hex: string): string {
  const raw = hex.replace("#", "")
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "0 0% 100%"
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? "222.2 84% 4.9%" : "210 40% 98%"
}

export type ThemeColors = {
  primary?: string
  secondary?: string
  accent?: string
  background?: string
  surface?: string
  text?: string
}

/** Apply shop theme colors onto both --theme-* and shadcn tokens */
export function applyThemeCssVars(root: HTMLElement, colors: ThemeColors) {
  const map: Array<[string, string | undefined]> = [
    ["--theme-primary", colors.primary],
    ["--theme-secondary", colors.secondary],
    ["--theme-accent", colors.accent],
    ["--theme-background", colors.background],
    ["--theme-surface", colors.surface],
    ["--theme-text", colors.text],
  ]
  for (const [key, value] of map) {
    if (value) root.style.setProperty(key, value)
  }

  const primary = colors.primary ? hexToHslComponents(colors.primary) : null
  const secondary = colors.secondary ? hexToHslComponents(colors.secondary) : null
  const accent = colors.accent ? hexToHslComponents(colors.accent) : null
  const background = colors.background ? hexToHslComponents(colors.background) : null
  const surface = colors.surface ? hexToHslComponents(colors.surface) : null
  const text = colors.text ? hexToHslComponents(colors.text) : null

  if (primary) {
    root.style.setProperty("--primary", primary)
    root.style.setProperty("--ring", primary)
    if (colors.primary) root.style.setProperty("--primary-foreground", contrastForeground(colors.primary))
  }
  if (secondary) {
    root.style.setProperty("--secondary", secondary)
    if (colors.secondary) root.style.setProperty("--secondary-foreground", contrastForeground(colors.secondary))
  }
  if (accent) {
    root.style.setProperty("--accent", accent)
    if (colors.accent) root.style.setProperty("--accent-foreground", contrastForeground(colors.accent))
  }
  if (background) {
    root.style.setProperty("--background", background)
  }
  if (text) {
    root.style.setProperty("--foreground", text)
    root.style.setProperty("--card-foreground", text)
    root.style.setProperty("--popover-foreground", text)
  }
  if (surface) {
    root.style.setProperty("--card", surface)
    root.style.setProperty("--popover", surface)
    root.style.setProperty("--muted", surface)
    root.style.setProperty("--input", surface)
    root.style.setProperty("--border", surface)
  }
}

export function clearThemeCssOverrides(root: HTMLElement) {
  const keys = [
    "--theme-primary",
    "--theme-secondary",
    "--theme-accent",
    "--theme-background",
    "--theme-surface",
    "--theme-text",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--accent",
    "--accent-foreground",
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--muted",
    "--border",
    "--input",
    "--ring",
  ]
  for (const key of keys) root.style.removeProperty(key)
}

export function isShopThemePayload(value: unknown): value is { colors: ThemeColors; id?: string; name?: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as any).colors &&
      typeof (value as any).colors === "object" &&
      ((value as any).colors.primary || (value as any).colors.background),
  )
}
