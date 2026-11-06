/**
 * Loop — Formal Design Tokens
 * ═══════════════════════════════════════════════════════════════════
 * Extracted from Linear's production stylesheets (linear.app →
 * static.linear.app/web/_next/static/css/*.css, all 54 files, scraped
 * and parsed). These are the exact values Linear ships in its
 * `[data-theme=light]` / `[data-theme=dark]` blocks — colors, radii,
 * elevation, type scale, weights and layout constants.
 *
 * This file is the SINGLE SOURCE OF TRUTH for Loop:
 *
 *   • tailwind.config.ts   imports it → font, type-scale, weight,
 *                          shadow and brand/signal utilities
 *   • app/globals.css      mirrors the semantic colors as CSS
 *                          variables (HSL triplets) so every existing
 *                          `bg-background`, `text-foreground`,
 *                          `border-border`, `rounded-lg`, `shadow-low`
 *                          class in the app resolves to these tokens
 *
 * RULE FOR NEW UI: never pick a hex / px value per component.
 * Reference a token here (or its Tailwind/CSS alias) instead.
 */

/* ──────────────────────────────────────────────────────────────────
 * 1. RAW PALETTE — theme independent (Linear --color-*)
 * ────────────────────────────────────────────────────────────────── */
export const palette = {
  /** Linear brand indigo — dark-mode brand-bg, the app's anchor color */
  brand: "#5e6ad2",
  /** Linear brand indigo — light-mode brand-bg */
  brandLight: "#7070ff",
  /** Linear link-primary (dark) */
  brandLink: "#828fff",
  /** Linear --color-accent */
  accent: "#7170ff",
  /** Linear --color-accent-hover */
  accentHover: "#828fff",
  /** Linear accent-tint (dark) — subtle indigo hover surface */
  accentTintDark: "#18182f",
  /** Linear accent-tint (light) */
  accentTintLight: "#f1f1ff",

  white: "#ffffff",
  black: "#000000",

  /* Linear status / signal colors — same in both themes */
  blue: "#4ea7fc",
  green: "#27a644",
  yellow: "#f0bf00",
  orange: "#fc7840",
  red: "#eb5757",
  teal: "#00b8cc",
} as const;

/* ──────────────────────────────────────────────────────────────────
 * 2. SEMANTIC COLORS — per theme (Linear [data-theme=…] blocks)
 *    Exposed in CSS as hsl(var(--background)) etc. via app/globals.css
 * ────────────────────────────────────────────────────────────────── */
type ThemeColors = {
  /** page background (bg-level-0) */
  background: string;
  /** primary text (text-primary) */
  foreground: string;
  /** card / panel / popover surface */
  card: string;
  cardForeground: string;
  /** primary action (brand-bg) */
  primary: string;
  primaryForeground: string;
  /** raised surface (bg-level-2 / bg-tertiary) */
  secondary: string;
  secondaryForeground: string;
  /** subtle surface (bg-level-1 / bg-secondary) */
  muted: string;
  mutedForeground: string;
  /** hover tint (accent-tint) */
  accent: string;
  accentForeground: string;
  /** destructive (Linear red) */
  destructive: string;
  destructiveForeground: string;
  /** hairline border (border-primary) */
  border: string;
  input: string;
  ring: string;
  /** divider lines (line-primary) */
  line: string;
};

export const semanticColors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: "#ffffff", //  bg-level-0
    foreground: "#282a30", //  text-primary
    card: "#ffffff", //         bg-level-0
    cardForeground: "#282a30",
    primary: "#7070ff", //      brand-bg (light)
    primaryForeground: "#ffffff",
    secondary: "#f4f4f4", //    bg-level-2
    secondaryForeground: "#282a30",
    muted: "#f8f8f8", //        bg-level-1
    mutedForeground: "#6f6e77", // text-tertiary
    accent: "#f1f1ff", //       accent-tint
    accentForeground: "#282a30",
    destructive: "#eb5757", //  red
    destructiveForeground: "#ffffff",
    border: "#e9e8ea", //       border-primary
    input: "#e9e8ea",
    ring: "#7070ff",
    line: "#d4d4d6", //         line-primary
  },
  dark: {
    background: "#08090a", //   bg-primary
    foreground: "#f7f8f8", //   text-primary
    card: "#0f1011", //         bg-panel / bg-level-1
    cardForeground: "#f7f8f8",
    primary: "#5e6ad2", //      brand-bg (dark)
    primaryForeground: "#ffffff",
    secondary: "#232326", //    bg-tertiary
    secondaryForeground: "#f7f8f8",
    muted: "#1c1c1f", //        bg-secondary
    mutedForeground: "#8a8f98", // text-tertiary
    accent: "#18182f", //       accent-tint
    accentForeground: "#f7f8f8",
    destructive: "#eb5757",
    destructiveForeground: "#ffffff",
    border: "#23252a", //       border-primary
    input: "#23252a",
    ring: "#5e6ad2",
    line: "#37393a", //         line-primary
  },
};

/* Text ramps Linear uses for secondary/tertiary/quaternary copy */
export const textRamp = {
  light: {
    secondary: "#3c4149",
    tertiary: "#6f6e77",
    quaternary: "#86848d",
  },
  dark: {
    secondary: "#d0d6e0",
    tertiary: "#8a8f98",
    quaternary: "#62666d",
  },
} as const;

/** Background level ramp — the subtle surface ladder both themes use */
export const backgroundLevels = {
  light: { 0: "#ffffff", 1: "#f8f8f8", 2: "#f4f4f4", 3: "#f0f0f0" },
  dark: { 0: "#08090a", 1: "#0f1011", 2: "#141516", 3: "#191a1b" },
} as const;

/* ──────────────────────────────────────────────────────────────────
 * 3. SPACING — Linear's 4px grid.
 *    Maps 1:1 onto Tailwind's default utilities:
 *    space[4] (16px) === p-4 / m-4 / gap-4, etc.
 *    Use Tailwind utilities in components; use these when writing raw CSS.
 * ────────────────────────────────────────────────────────────────── */
export const space = {
  0: "0rem",
  1: "0.25rem", //  4px
  2: "0.5rem", //   8px
  3: "0.75rem", //  12px
  4: "1rem", //     16px
  5: "1.25rem", //  20px
  6: "1.5rem", //   24px
  7: "1.75rem", //  28px
  8: "2rem", //     32px
  9: "2.25rem", //  36px
  10: "2.5rem", //  40px
  12: "3rem", //    48px
  14: "3.5rem", //  56px
  16: "4rem", //    64px
  20: "5rem", //    80px
  24: "6rem", //    96px
} as const;

/* ──────────────────────────────────────────────────────────────────
 * 4. RADII — Linear --radius-* scale (4/6/8/12/16/24/32 + pill)
 *    tailwind.config maps:
 *      rounded-sm → 4px   rounded-md → 6px   rounded-lg → 8px  (--radius)
 *      rounded-xl → 12px  rounded-2xl → 16px  rounded-3xl → 24px
 *      rounded-full → pill
 * ────────────────────────────────────────────────────────────────── */
export const radiusScale = {
  xs: "4px", //   --radius-4
  sm: "4px",
  md: "6px", //   --radius-6
  lg: "8px", //   --radius-8   ← default controls (the `--radius` token)
  xl: "12px", //  --radius-12  ← cards
  "2xl": "16px", // --radius-16
  "3xl": "24px", // --radius-24
  "4xl": "32px", // --radius-32
  pill: "9999px", // --radius-rounded
  circle: "50%", //  --radius-circle
  /** CSS var consumed by tailwind borderRadius (see app/globals.css) */
  token: "0.5rem",
} as const;

/* ──────────────────────────────────────────────────────────────────
 * 5. ELEVATION — Linear --shadow-* (theme-aware via CSS vars)
 *    Use: shadow-tiny | shadow-low | shadow-medium | shadow-high | shadow-stack
 * ────────────────────────────────────────────────────────────────── */
export const shadow = {
  light: {
    tiny: "0px 1px 1px 0px #00000017",
    low: "0px 1px 4px -1px #00000017",
    medium: "0px 3px 12px #00000017",
    high: "0px 7px 24px #0000000f",
    stack:
      "0px -1px 1px 0px #0000001c inset, 0px 8px 2px 0px #0000, 0px 5px 2px 0px #00000003, 0px 3px 2px 0px #0000000a, 0px 1px 1px 0px #00000012, 0px 0px 1px 0px #00000014",
  },
  dark: {
    tiny: "0px 1px 1px 0px #00000017",
    low: "0px 2px 4px #0000001a",
    medium: "0px 4px 24px #0003",
    high: "0px 7px 32px #00000059",
    stack:
      "0px 8px 2px 0px #0000, 0px 5px 2px 0px #00000003, 0px 3px 2px 0px #0000000a, 0px 1px 1px 0px #00000012, 0px 0px 1px 0px #00000014",
  },
} as const;

/* ──────────────────────────────────────────────────────────────────
 * 6. TYPOGRAPHY — Linear's font pairing + type scale
 * ────────────────────────────────────────────────────────────────── */
export const typography = {
  fontFamily: {
    /** Linear --font-regular (Inter already powers Loop via next/font) */
    sans: [
      '"Inter Variable"',
      '"SF Pro Display"',
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "sans-serif",
    ],
    /** Linear --font-monospace */
    mono: [
      '"Berkeley Mono"',
      "ui-monospace",
      '"SF Mono"',
      "Menlo",
      "monospace",
    ],
  },

  /**
   * Linear --font-size-* / --text-* scale.
   * key → [size, { lineHeight, letterSpacing }]
   * Available as: text-micro text-mini text-small text-regular text-large
   *               text-title3 text-title2 text-title1
   */
  fontSize: {
    /* The bottom of the scale is a hard floor: micro (12px) is the smallest
       anything may render, caption (13px) is for badges and chips, mini
       (14px) is secondary copy and small (15px) sits just under body text.
       Body copy is regular (16px) and never inflates beyond that. */
    micro: { size: "0.75rem", lineHeight: "1.4", letterSpacing: "0" },
    caption: { size: "0.8125rem", lineHeight: "1.35", letterSpacing: "0" },
    mini: { size: "0.875rem", lineHeight: "1.5", letterSpacing: "-0.01em" },
    small: { size: "0.9375rem", lineHeight: "1.55", letterSpacing: "-0.013em" },
    regular: { size: "1rem", lineHeight: "1.6", letterSpacing: "-0.011em" },
    large: { size: "1.0625rem", lineHeight: "1.6", letterSpacing: "0" },
    title3: { size: "1.3125rem", lineHeight: "1.4", letterSpacing: "-0.01em" },
    title2: { size: "1.5625rem", lineHeight: "1.3", letterSpacing: "-0.015em" },
    title1: { size: "2.375rem", lineHeight: "1.2", letterSpacing: "-0.02em" },

    /* Tailwind's default names are remapped onto the same scale so text-xs /
       text-sm / text-base are not a second, smaller system in disguise. */
    xs: { size: "0.8125rem", lineHeight: "1.45", letterSpacing: "-0.005em" },
    sm: { size: "0.9375rem", lineHeight: "1.55", letterSpacing: "-0.01em" },
    base: { size: "1rem", lineHeight: "1.6", letterSpacing: "-0.011em" },
    lg: { size: "1.125rem", lineHeight: "1.6", letterSpacing: "0" },
  },

  /**
   * Linear --font-weight-* (Inter variable axes — not the stock
   * 500/600/700). Wired into Tailwind as font-medium/font-semibold/font-bold.
   */
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 510,
    semibold: 590,
    bold: 680,
  },
} as const;

/* ──────────────────────────────────────────────────────────────────
 * 7. LAYOUT CONSTANTS — Linear --header-height / --page-* / --prose-*
 * ────────────────────────────────────────────────────────────────── */
export const layout = {
  headerHeight: "64px",
  bottomNavHeight: "64px",
  headerBlur: "20px",
  pagePadding: "24px", //   --page-padding-inline (the gutter)
  pageMaxWidth: "1024px", // --page-max-width
  proseMaxWidth: "624px", // --prose-max-width
} as const;

/* ──────────────────────────────────────────────────────────────────
 * 8. SIGNATURE GRADIENTS — built from the palette above, so no
 *    component ever defines its own one-off gradient.
 *    (Exposed as CSS vars --grad-* + .loop-grad-* classes.)
 * ────────────────────────────────────────────────────────────────── */
export const gradients = {
  primary: `linear-gradient(100deg, ${palette.brand} 0%, ${palette.accent} 100%)`,
  messaging: `linear-gradient(100deg, ${palette.blue} 0%, ${palette.brand} 100%)`,
  social: `linear-gradient(100deg, ${palette.orange} 0%, ${palette.yellow} 100%)`,
  commerce: `linear-gradient(100deg, ${palette.green} 0%, ${palette.teal} 100%)`,
  creative: `linear-gradient(100deg, ${palette.accent} 0%, ${palette.teal} 100%)`,
  neutral: `linear-gradient(100deg, ${semanticColors.light.foreground} 0%, ${textRamp.light.quaternary} 100%)`,
  warning: `linear-gradient(100deg, ${palette.yellow} 0%, ${palette.red} 100%)`,
} as const;

/* ──────────────────────────────────────────────────────────────────
 * 9. STATUS COLORS — the only place success / warning / info live.
 *    Mirrored as --success / --warning / --info in app/globals.css.
 * ────────────────────────────────────────────────────────────────── */
export const statusColors = {
  light: {
    success: "#1a7f37",
    successSurface: "#e9f6ec",
    successBorder: "#bfe3c6",
    warning: "#9a6700",
    warningSurface: "#fff8e1",
    warningBorder: "#f0dfa8",
    info: "#0a5db3",
    infoSurface: "#e8f2fc",
    infoBorder: "#bcd9f5",
  },
  dark: {
    success: "#4ac26b",
    successSurface: "#0f2417",
    successBorder: "#1f4a2c",
    warning: "#d4a72c",
    warningSurface: "#241d0b",
    warningBorder: "#4d3f14",
    info: "#6cb6ff",
    infoSurface: "#0c1a28",
    infoBorder: "#1e3a52",
  },
} as const;

/* ──────────────────────────────────────────────────────────────────
 * 10. MOTION — every transition in the app uses these. No one-off
 *     durations or cubic-beziers in components.
 * ────────────────────────────────────────────────────────────────── */
export const motion = {
  duration: {
    instant: "80ms", //    press feedback
    fast: "140ms", //      hover / color
    base: "200ms", //      menus, toggles
    slow: "280ms", //      sheets, page transitions
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    entrance: "cubic-bezier(0.16, 1, 0.3, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
  },
} as const;

/* ──────────────────────────────────────────────────────────────────
 * 11. ICONS — lucide only, one size ladder and one stroke weight.
 *     Anything larger than xl belongs to illustration, not UI.
 * ────────────────────────────────────────────────────────────────── */
export const icon = {
  /** xl (24) is the action-row / bottom-nav / top-bar icon; 2xl is the
      bottom-nav maximum, so nothing in the chrome is drawn smaller than md. */
  size: { xs: 14, sm: 16, md: 20, lg: 22, xl: 24, "2xl": 26 },
  stroke: { regular: 1.75, strong: 2 },
  /** Minimum square hit area for an icon-only control (WCAG 2.5.5). */
  touch: 44,
} as const;

/* ──────────────────────────────────────────────────────────────────
 * 12. CONTROLS — one height ladder for buttons, inputs and bars.
 *     Tailwind aliases: h-control-sm / h-control / h-control-lg are not
 *     generated, so components read these and the shared ui/* primitives
 *     already encode them.
 * ────────────────────────────────────────────────────────────────── */
export const control = {
  height: { sm: "2.25rem", md: "2.75rem", lg: "3rem" }, // 36 / 44 / 48px
  touch: "2.75rem", // 44px minimum tap target
} as const;

/** Avatar ladder (px) — feed posts and quoted/nested posts. */
export const avatar = {
  feed: 44,
  nested: 32,
  bar: 36,
  profile: 64,
} as const;

/* Bundled export */
export const designTokens = {
  palette,
  color: semanticColors,
  status: statusColors,
  textRamp,
  backgroundLevels,
  space,
  radius: radiusScale,
  shadow,
  typography,
  layout,
  gradients,
  motion,
  icon,
  control,
  avatar,
} as const;

export default designTokens;

/* ════════════════════════════════════════════════════════════════
 * LEGACY TOKENS — pre-existing Loop constants, preserved verbatim.
 * These remain the source of truth for their original purpose; the
 * Linear-derived tokens above are additive.
 * ════════════════════════════════════════════════════════════════ */

/** Touch-target minimum sizes (WCAG 2.5.5) */
export const touchTarget = {
  /** Minimum touch target for buttons/icons */
  min: 44,
  /** Comfortable touch target */
  comfortable: 48,
  /** Large touch target for primary actions */
  large: 56,
} as const;

/** Avatar sizes used across the app */
export const avatarSize = {
  /** Tiny — inline mentions, reaction badges */
  xs: 20,
  /** Small — chat messages, comment threads */
  sm: 28,
  /** Medium — post cards, list items */
  md: 36,
  /** Large — profile headers, conversation list */
  lg: 48,
  /** XL — profile page hero */
  xl: 64,
  /** 2XL — onboarding, edit profile */
  "2xl": 80,
} as const;

/** Standard spacing scale (in px, maps to Tailwind gap/margin/padding) */
export const spacing = {
  /** Tight — between closely related items (icon + label) */
  tight: 4,
  /** Compact — between items in a row (reactions bar) */
  compact: 8,
  /** Default — between card sections */
  default: 12,
  /** Comfortable — between major sections */
  comfortable: 16,
  /** Loose — between cards in a feed */
  loose: 24,
  /** Section — between page sections */
  section: 32,
} as const;

/** Card and container border radius (Tailwind class names) */
export const radius = {
  /** Small — badges, tags, chips */
  sm: "rounded-md",
  /** Medium — buttons, inputs, small cards */
  md: "rounded-lg",
  /** Large — post cards, modals */
  lg: "rounded-xl",
  /** XL — hero cards, full-width sections */
  xl: "rounded-2xl",
  /** Full — avatars, pills */
  full: "rounded-full",
} as const;

/** Standard container max-widths */
export const container = {
  /** Feed column width (main content) */
  feed: "max-w-[600px]",
  /** Sidebar/panel width */
  sidebar: "max-w-[340px]",
  /** Full-width for settings/admin */
  full: "max-w-full",
  /** Narrow for auth pages */
  narrow: "max-w-[400px]",
} as const;

/** Standard animation durations */
export const duration = {
  /** Fast — hover states, micro-interactions */
  fast: "150ms",
  /** Default — transitions, toggles */
  default: "200ms",
  /** Slow — page transitions, modals */
  slow: "300ms",
} as const;

/** Z-index layering to avoid ad-hoc z-[9999] values */
export const zIndex = {
  /** Behind content */
  behind: -1,
  /** Default content */
  base: 0,
  /** Dropdowns, tooltips */
  dropdown: 50,
  /** Sticky headers, nav bars */
  sticky: 100,
  /** Modals, overlays */
  modal: 200,
  /** Toasts, notifications */
  toast: 300,
  /** Dev tools, debug */
  debug: 400,
} as const;
