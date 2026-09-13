/**
 * Design tokens — shared constants that replace magic numbers throughout the UI.
 *
 * Instead of writing `w-[44px] h-[44px]` or `gap-[10px]` everywhere,
 * import these tokens and use them consistently.
 */

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

/** Card and container border radius */
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
