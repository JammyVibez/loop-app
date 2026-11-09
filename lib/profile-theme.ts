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
  /** Painted behind the profile. An image, an animated GIF or a short video. */
  backgroundUrl: string | null
  audioUrl: string | null
  audioTitle: string | null
  /** Admin default: is the theme's soundtrack on when it is equipped? */
  audioEnabled: boolean
  /** Admin default: should it start on its own, or wait for a tap? */
  audioAutoplay: boolean
}

export const PROFILE_POST_VIEWS = ["grid", "list", "cards"] as const
export type ProfilePostView = (typeof PROFILE_POST_VIEWS)[number]

/**
 * The atmosphere the profile owner chose: artwork, soundtrack and how their
 * posts are laid out for visitors. Audio is on unless the owner or the visitor
 * turns it off, so a purchased theme is heard by default.
 */
export type ProfileAtmosphere = {
  /** An image, an animated GIF or a short looping video. */
  backgroundUrl: string | null
  audioUrl: string | null
  audioTitle: string | null
  audioEnabled: boolean
  audioAutoplay: boolean
  postView: ProfilePostView | null
}

export function normalizeProfilePostView(value: unknown): ProfilePostView | null {
  return typeof value === "string" && (PROFILE_POST_VIEWS as readonly string[]).includes(value)
    ? (value as ProfilePostView)
    : null
}

const EMPTY: ProfileThemeAssets = {
  css: "",
  backgroundUrl: null,
  audioUrl: null,
  audioTitle: null,
  audioEnabled: true,
  audioAutoplay: true,
}

/**
 * Backgrounds can be a picture, an animated GIF or a short looping video, so
 * every reader treats the URL as media rather than assuming an image. A
 * Cloudinary video URL is recognised by its delivery path as well as by its
 * extension, because an admin can paste a transformed URL without one.
 */
export function isVideoProfileBackground(value: string | null | undefined): boolean {
  if (!value) return false
  if (/\/video\/upload\//i.test(value)) return true
  return /\.(?:mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(value)
}

/**
 * The raster sibling of a bundled theme's SVG, for Open Graph cards.
 *
 * Satori paints raster backgrounds but skips SVG ones, so
 * scripts/generate-profile-theme-og-images.mjs writes a JPEG next to every
 * bundled SVG. Anything that is not a bundled theme path is returned as-is.
 */
export function profileThemeOgArtwork(url: string | null | undefined): string | null {
  if (!url) return null
  const match = url.match(/^(?:https?:\/\/[^/]+)?\/profile-themes\/([a-z0-9-]+)\.svg(?:[?#].*)?$/i)
  return match ? `/profile-themes/og/${match[1].toLowerCase()}.jpg` : url
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
    // Only an explicit `false` turns either switch off, so themes created
    // before these fields existed keep playing.
    audioEnabled: data.profile_audio_enabled !== false,
    audioAutoplay: data.profile_audio_autoplay !== false,
  }
}

/** Read the active theme's profile extras off `profiles.theme_preferences`. */
export function readProfileThemePreferences(themePreferences: unknown): ProfileThemeAssets {
  const atmosphere = readProfileAtmosphere(themePreferences)
  return {
    css: "",
    backgroundUrl: atmosphere.backgroundUrl,
    audioUrl: atmosphere.audioUrl,
    audioTitle: atmosphere.audioTitle,
    audioEnabled: atmosphere.audioEnabled,
    audioAutoplay: atmosphere.audioAutoplay,
  }
}

/** Read the owner's profile atmosphere, applying the sensible defaults. */
export function readProfileAtmosphere(themePreferences: unknown): ProfileAtmosphere {
  if (!themePreferences || typeof themePreferences !== "object" || Array.isArray(themePreferences)) {
    return {
      backgroundUrl: null,
      audioUrl: null,
      audioTitle: null,
      audioEnabled: true,
      audioAutoplay: true,
      postView: null,
    }
  }
  const prefs = themePreferences as Record<string, unknown>
  return {
    backgroundUrl: safeThemeAssetUrl(prefs.profile_background),
    audioUrl: safeThemeAssetUrl(prefs.profile_audio),
    audioTitle: title(prefs.profile_audio_title),
    audioEnabled: prefs.profile_audio_enabled !== false,
    // Only an explicit `false` opts out of autoplay; missing means on.
    audioAutoplay: prefs.profile_audio_autoplay !== false,
    postView: normalizeProfilePostView(prefs.profile_post_view),
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
