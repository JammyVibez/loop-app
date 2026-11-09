/**
 * Display-image optimisation for both storage eras.
 *
 * VPS uploads already have responsive renditions on disk
 * (`/media/images/2026/11/abc.webp`, `abc-1024.webp`, `abc-480.webp`), so the
 * cheapest possible URL is picked for the requested width — and data-saver
 * forces the 480px copy. Legacy Cloudinary URLs keep the `f_auto,q_auto,w_*`
 * transform trick, so old posts stay fast too.
 *
 * GIFs, SVGs, Lottie JSON and video are always passed through untouched:
 * re-pointing an animation at a static rendition would lose the animation.
 */

const PASSTHROUGH_EXT = /\.(gif|svg|json|mp4|webm|mov|m4v|m4a|mp3|wav|ogg|flac)(\?|$)/i
const IMAGE_EXT = /\.(webp|png|jpe?g|avif|bmp)(\?.*)?$/i
const MEDIA_PATH = /^(.*\/media\/)(.+?)(?:-(?:thumb|480|1024))?\.([a-z0-9]+)(\?.*)?$/i

export type OptimizeOptions = { dataSaver?: boolean }

export function optimizeImageUrl(
  url: string | null | undefined,
  width?: number,
  options: OptimizeOptions = {},
): string {
  if (!url) return ""
  if (PASSTHROUGH_EXT.test(url)) return url

  // ── VPS media store ──────────────────────────────────────────────────
  if (url.includes("/media/") && !/^https?:\/\/res\.cloudinary\.com/i.test(url)) {
    const match = url.match(MEDIA_PATH)
    if (!match) return url
    if (!IMAGE_EXT.test(url)) return url

    const prefix = match[1]
    const base = match[2]
    const suffix = match[4] || ""
    if (!width && !options.dataSaver) return url

    const target = options.dataSaver ? 480 : Math.max(0, Math.round(width || 0))
    const variant = target && target <= 480 ? "-480" : target && target <= 1024 ? "-1024" : ""
    if (!variant) return url
    // The thumb rendition is a WebP regardless of the master's format.
    return `${prefix}${base}${variant}.webp${suffix}`
  }

  // ── Legacy Cloudinary ────────────────────────────────────────────────
  const match = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/i)
  if (!match) return url
  if (match[2].startsWith("f_auto")) return url

  const transform = ["f_auto", "q_auto"].concat(width ? [`w_${Math.max(64, Math.round(width))}`] : [])
  return `${match[1]}${transform.join(",")}/${match[2]}`
}

/**
 * Pick the right rendition for a media item, preferring the stored variant map
 * (which also covers heights set by the uploader) over URL guessing.
 */
export function pickMediaVariant(
  url: string | null | undefined,
  variants: Record<string, string> | null | undefined,
  width: number,
  options: OptimizeOptions = {},
): string {
  if (!url) return ""
  const target = options.dataSaver ? 480 : width
  const keys = target <= 320 ? ["thumb", "480", "1024"] : target <= 480 ? ["480", "1024"] : target <= 1024 ? ["1024"] : []
  for (const key of keys) {
    const candidate = variants?.[key]
    if (candidate) return candidate
  }
  return optimizeImageUrl(url, target, options)
}
