/**
 * Cloudinary URL optimization for display images.
 *
 * Our uploads produce URLs like
 *   https://res.cloudinary.com/<cloud>/image/upload/v123456/loop/abc.jpg
 *
 * Injecting `f_auto,q_auto,w_<size>` makes Cloudinary serve the best format
 * (AVIF/WebP when supported) at the right width — often 5-10x smaller than
 * the original upload, which is the single biggest win for feed scroll
 * performance. Original URLs are passed through untouched (e.g. animated
 * GIFs keep their animation; video URLs are never touched).
 */
export function optimizeImageUrl(url: string | null | undefined, width?: number): string {
  if (!url) return ""
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?|$)/i.test(url)) return url
  if (/\.gif(\?|$)/i.test(url)) return url // keep animation

  const match = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/i)
  if (!match) return url
  if (match[2].startsWith("f_auto")) return url // already optimized

  const transform = ["f_auto", "q_auto"].concat(width ? [`w_${Math.max(64, Math.round(width))}`] : [])
  return `${match[1]}${transform.join(",")}/${match[2]}`
}
