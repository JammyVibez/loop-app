/**
 * Profile themes sold in the shop.
 *
 * A theme item carries four optional extras on top of the normal shop theme
 * colours: profile-scoped CSS, a background picture and a looping soundtrack.
 * The catalogue is admin-only, so the reader here is deliberately permissive —
 * it validates the asset URLs but never trusts anything else.
 */

export type ProfileThemeAssets = {
  css: string
  backgroundUrl: string | null
  audioUrl: string | null
  audioTitle: string | null
}

const EMPTY: ProfileThemeAssets = {
  css: "",
  backgroundUrl: null,
  audioUrl: null,
  audioTitle: null,
}

/** An https URL, or a site-relative path served from `public/`. */
export function safeThemeAssetUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const url = value.trim()
  if (!url || url.length > 2048) return null
  if (/^(?:https?:\/\/|\/)[^\s"'<>\\]+$/i.test(url)) return url
  return null
}

function title(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value.trim().replace(/\s+/g, " ").slice(0, 80)
  return text || null
}

/** Read the theme bundle an admin attached to a `shop_items` row. */
export function readProfileThemeItemData(itemData: unknown): ProfileThemeAssets {
  if (!itemData || typeof itemData !== "object" || Array.isArray(itemData)) return EMPTY
  const data = itemData as Record<string, unknown>
  return {
    css: typeof data.profile_css === "string" ? data.profile_css : "",
    backgroundUrl: safeThemeAssetUrl(data.profile_background_url),
    audioUrl: safeThemeAssetUrl(data.profile_audio_url),
    audioTitle: title(data.profile_audio_title),
  }
}

/** Read the active theme's profile extras off `profiles.theme_preferences`. */
export function readProfileThemePreferences(themePreferences: unknown): ProfileThemeAssets {
  if (!themePreferences || typeof themePreferences !== "object" || Array.isArray(themePreferences)) {
    return EMPTY
  }
  const prefs = themePreferences as Record<string, unknown>
  return {
    css: "",
    backgroundUrl: safeThemeAssetUrl(prefs.profile_background),
    audioUrl: safeThemeAssetUrl(prefs.profile_audio),
    audioTitle: title(prefs.profile_audio_title),
  }
}

/** Does this catalogue row actually restyle the buyer's profile? */
export function isProfileThemeItem(shopItem: {
  item_type?: string | null
  category?: string | null
  item_data?: unknown
} | null | undefined): boolean {
  if (!shopItem) return false
  const hay = `${shopItem.category || ""} ${shopItem.item_type || ""}`.toLowerCase()
  if (hay.includes("profile_theme") || hay.includes("profile-theme")) return true
  const assets = readProfileThemeItemData(shopItem.item_data)
  return Boolean(assets.css || assets.backgroundUrl || assets.audioUrl)
}
