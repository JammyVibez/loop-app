export interface ChatWallpaper {
  /** Built-in preset id, or null/undefined for custom image / default. */
  preset?: string | null
  /** Custom image uploaded from the device. */
  image_url?: string | null
  /** Darkening overlay strength (0–0.7) so bubbles stay readable on photos. */
  overlay?: number | null
}

export interface ChatWallpaperPreset {
  id: string
  name: string
  /** CSS background shorthand (gradient) used for both preview + chat pane. */
  css: string
  /** Small accent color for the swatch border. */
  accent: string
}

export const CHAT_WALLPAPER_PRESETS: ChatWallpaperPreset[] = [
  { id: "aurora", name: "Aurora", css: "linear-gradient(160deg,#1e1b4b 0%,#312e81 35%,#164e63 70%,#0f172a 100%)", accent: "#818cf8" },
  { id: "ocean", name: "Ocean", css: "linear-gradient(160deg,#082f49 0%,#0c4a6e 50%,#164e63 100%)", accent: "#38bdf8" },
  { id: "sunset", name: "Sunset", css: "linear-gradient(160deg,#431407 0%,#9a3412 50%,#7c2d12 100%)", accent: "#fb923c" },
  { id: "forest", name: "Forest", css: "linear-gradient(160deg,#052e16 0%,#14532d 50%,#134e4a 100%)", accent: "#34d399" },
  { id: "midnight", name: "Midnight", css: "linear-gradient(160deg,#020617 0%,#0f172a 55%,#1e293b 100%)", accent: "#64748b" },
  { id: "rose", name: "Rose", css: "linear-gradient(160deg,#4c0519 0%,#9f1239 50%,#701a75 100%)", accent: "#f472b6" },
  { id: "slate", name: "Slate", css: "linear-gradient(160deg,#1e293b 0%,#334155 55%,#475569 100%)", accent: "#94a3b8" },
  { id: "peach", name: "Peach", css: "linear-gradient(160deg,#7c2d12 0%,#c2410c 55%,#9a3412 100%)", accent: "#fdba74" },
]

export const DEFAULT_CHAT_WALLPAPER: ChatWallpaper = { preset: null, image_url: null, overlay: null }

export function getChatWallpaperPreset(wallpaper: ChatWallpaper | null | undefined) {
  if (!wallpaper?.preset) return null
  return CHAT_WALLPAPER_PRESETS.find((p) => p.id === wallpaper.preset) || null
}

/** Style object for the chat pane background. */
export function chatWallpaperStyle(wallpaper: ChatWallpaper | null | undefined): React.CSSProperties {
  const preset = getChatWallpaperPreset(wallpaper)
  if (wallpaper?.image_url) {
    return {
      backgroundImage: `linear-gradient(rgba(2,6,23,${wallpaper.overlay ?? 0.35}), rgba(2,6,23,${wallpaper.overlay ?? 0.35})), url("${wallpaper.image_url}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundColor: "#0f172a",
    }
  }
  if (preset) {
    return {
      backgroundImage: preset.css,
      backgroundColor: "#0f172a",
    }
  }
  // Default: keep the existing dotted pattern
  return {}
}
