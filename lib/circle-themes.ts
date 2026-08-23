/**
 * Circle Theme Token System
 *
 * Config-based architecture: no arbitrary code execution.
 * Each Circle stores a JSON theme_config that controls its visual identity.
 */

// ─── Allowed values (locked palettes, not free-form) ────────────────────────

export const ALLOWED_FONTS = [
  "Inter",
  "Poppins",
  "Playfair Display",
  "Space Grotesk",
  "DM Sans",
  "Nunito",
  "Raleway",
  "Lato",
  "Montserrat",
  "Open Sans",
] as const

export const LAYOUT_TEMPLATES = ["feed-first", "grid-gallery", "forum-threaded"] as const
export const SIDEBAR_POSITIONS = ["left", "right"] as const
export const CONTENT_WIDTHS = ["compact", "comfortable", "wide"] as const
export const BANNER_SHAPES = ["square", "rounded", "circle"] as const
export const COMPONENT_KEYS = ["posts", "members", "events", "media", "pinned", "rooms"] as const

// ─── Token types ────────────────────────────────────────────────────────────

export interface ThemeColors {
  primary: string
  secondary: string
  background: string
  cardBg: string
  text: string
  textSecondary: string
  border: string
  accent: string
}

export interface ThemeTypography {
  fontFamily: (typeof ALLOWED_FONTS)[number]
  headingWeight: string
  bodyWeight: string
  fontSize: string
}

export interface ThemeLayout {
  template: (typeof LAYOUT_TEMPLATES)[number]
  sidebarPosition: (typeof SIDEBAR_POSITIONS)[number]
  showHeroBanner: boolean
  contentWidth: (typeof CONTENT_WIDTHS)[number]
}

export interface ThemeComponents {
  order: string[]
  visibility: Record<string, boolean>
}

export interface ThemeBanner {
  shape: (typeof BANNER_SHAPES)[number]
  borderRadius: string
  overlayOpacity: number
}

export interface CircleThemeConfig {
  colors: ThemeColors
  typography: ThemeTypography
  layout: ThemeLayout
  components: ThemeComponents
  banner: ThemeBanner
}

// ─── Validation ─────────────────────────────────────────────────────────────

function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)
}

const DEFAULT_THEME: CircleThemeConfig = {
  colors: {
    primary: "#6366f1",
    secondary: "#818cf8",
    background: "#0f172a",
    cardBg: "#1e293b",
    text: "#f8fafc",
    textSecondary: "#94a3b8",
    border: "#334155",
    accent: "#6366f1",
  },
  typography: {
    fontFamily: "Inter",
    headingWeight: "600",
    bodyWeight: "400",
    fontSize: "14px",
  },
  layout: {
    template: "feed-first",
    sidebarPosition: "right",
    showHeroBanner: true,
    contentWidth: "comfortable",
  },
  components: {
    order: ["posts", "members", "events", "media", "pinned"],
    visibility: { members: true, events: true, media: true, pinned: true, rooms: true },
  },
  banner: {
    shape: "rounded",
    borderRadius: "16px",
    overlayOpacity: 0.4,
  },
}

/** Deep-merge source into target, only overriding allowed keys */
function deepMerge(target: any, source: any): any {
  if (!source || typeof source !== "object" || Array.isArray(source)) return source ?? target
  const out = { ...target }
  for (const key of Object.keys(source)) {
    if (key in out) {
      out[key] = deepMerge(out[key], source[key])
    }
  }
  return out
}

/**
 * Validate & sanitize a raw theme_config JSON object.
 * Returns the default theme if the input is invalid.
 */
export function validateThemeConfig(raw: unknown): CircleThemeConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_THEME

  const cfg = raw as Record<string, any>

  // Validate colors
  if (cfg.colors && typeof cfg.colors === "object") {
    for (const key of Object.keys(DEFAULT_THEME.colors)) {
      if (!isHexColor(cfg.colors[key])) {
        cfg.colors[key] = DEFAULT_THEME.colors[key as keyof ThemeColors]
      }
    }
  }

  // Validate font
  if (cfg.typography && typeof cfg.typography === "object") {
    if (!ALLOWED_FONTS.includes(cfg.typography.fontFamily)) {
      cfg.typography.fontFamily = DEFAULT_THEME.typography.fontFamily
    }
  }

  // Validate layout template
  if (cfg.layout && typeof cfg.layout === "object") {
    if (!LAYOUT_TEMPLATES.includes(cfg.layout.template)) {
      cfg.layout.template = DEFAULT_THEME.layout.template
    }
    if (!SIDEBAR_POSITIONS.includes(cfg.layout.sidebarPosition)) {
      cfg.layout.sidebarPosition = DEFAULT_THEME.layout.sidebarPosition
    }
    if (!CONTENT_WIDTHS.includes(cfg.layout.contentWidth)) {
      cfg.layout.contentWidth = DEFAULT_THEME.layout.contentWidth
    }
  }

  // Validate component order
  if (cfg.components && typeof cfg.components === "object") {
    if (Array.isArray(cfg.components.order)) {
      cfg.components.order = cfg.components.order.filter((k: string) => COMPONENT_KEYS.includes(k as any))
    }
    if (cfg.components.order.length === 0) {
      cfg.components.order = [...DEFAULT_THEME.components.order]
    }
  }

  // Validate banner
  if (cfg.banner && typeof cfg.banner === "object") {
    if (!BANNER_SHAPES.includes(cfg.banner.shape)) {
      cfg.banner.shape = DEFAULT_THEME.banner.shape
    }
    const opacity = Number(cfg.banner.overlayOpacity)
    if (isNaN(opacity) || opacity < 0 || opacity > 1) {
      cfg.banner.overlayOpacity = DEFAULT_THEME.banner.overlayOpacity
    }
  }

  return deepMerge(DEFAULT_THEME, cfg) as CircleThemeConfig
}

export function getDefaultTheme(): CircleThemeConfig {
  return structuredClone(DEFAULT_THEME)
}

// ─── CSS variable generation ────────────────────────────────────────────────

/** Convert a CircleThemeConfig to inline CSS custom properties */
export function themeToCSSVars(theme: CircleThemeConfig): Record<string, string> {
  return {
    "--circle-primary": theme.colors.primary,
    "--circle-secondary": theme.colors.secondary,
    "--circle-bg": theme.colors.background,
    "--circle-card-bg": theme.colors.cardBg,
    "--circle-text": theme.colors.text,
    "--circle-text-secondary": theme.colors.textSecondary,
    "--circle-border": theme.colors.border,
    "--circle-accent": theme.colors.accent,
    "--circle-font": theme.typography.fontFamily,
    "--circle-heading-weight": theme.typography.headingWeight,
    "--circle-body-weight": theme.typography.bodyWeight,
    "--circle-font-size": theme.typography.fontSize,
    "--circle-banner-radius": theme.banner.borderRadius,
    "--circle-banner-overlay": String(theme.banner.overlayOpacity),
  }
}
