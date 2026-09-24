/**
 * Shared ad-surface vocabulary.
 *
 * Every surface the app can place a sponsored post on is declared here once,
 * so the admin panel's toggles, `AdSlot`, the home feed and the ad API all
 * agree on the same keys. They used to drift (the panel listed `circles` /
 * `explore` while the app asked for `communities` / `notifications` / `world`),
 * which made the placement switches silently ineffective.
 */
export const AD_SURFACES = [
  { key: "home", label: "Home feed", hint: "Inline card inside the main feed" },
  { key: "communities", label: "Communities", hint: "Discover page for communities" },
  { key: "circles", label: "Circle feeds", hint: "Inside a circle's feed" },
  { key: "notifications", label: "Notifications", hint: "Below the notification list" },
  { key: "world", label: "Community World", hint: "The 3D community world" },
  { key: "developers", label: "Developer Hub", hint: "Below developer posts" },
  { key: "explore", label: "Explore", hint: "Explore / search results" },
] as const

export type AdSurfaceKey = (typeof AD_SURFACES)[number]["key"]

export const AD_SURFACE_KEYS: string[] = AD_SURFACES.map((surface) => surface.key)

/**
 * Pacing: how many organic posts sit between two sponsored slots.
 *
 * Declared once because the admin API, the public feed API and the admin
 * panel all defaulted their own numbers (50–70 / 8–14 / 10–16). A 50–70
 * default meant a normal session never reached a slot at all, which read as
 * "ads are broken" even though every layer was working.
 */
export const AD_FREQUENCY_DEFAULT = { min: 10, max: 16 }
export const AD_FREQUENCY_BOUNDS = { min: 3, max: 200 }

/** Normalises an admin-supplied range: positive, ordered, and never so sparse the slot is unreachable. */
export function clampFrequency(min: unknown, max: unknown) {
  const toNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }
  const { min: floor, max: ceiling } = AD_FREQUENCY_BOUNDS
  const lower = Math.min(ceiling, Math.max(floor, Math.round(toNumber(min, AD_FREQUENCY_DEFAULT.min))))
  const upper = Math.min(ceiling, Math.max(lower, Math.round(toNumber(max, AD_FREQUENCY_DEFAULT.max))))
  return { min: lower, max: upper }
}

/**
 * Surfaces are opt-out for keys we know about (a missing key means "on", so
 * existing installs keep advertising exactly where they did before) and
 * opt-in for anything unrecognised (a typo'd surface can never start serving
 * sponsored content on its own).
 */
export function isSurfaceEnabled(
  surfaces: Record<string, unknown> | null | undefined,
  surface: string,
): boolean {
  if (!AD_SURFACE_KEYS.includes(surface)) return false
  const value = surfaces?.[surface]
  return value === undefined ? true : value !== false
}
