/**
 * Image proxy utilities for the Loop app.
 *
 * All user-uploaded images (avatars, post media, reels, circle images, etc.)
 * should be routed through the proxy to avoid CORS errors and expired storage
 * tokens that cause "Image Unavailable" broken-image states.
 */

const PROXY_PATH = "/api/image-proxy"

/**
 * Wraps any image URL through the server-side proxy.
 * If the URL is empty/null, returns undefined so callers can skip rendering.
 */
export function getProxyUrl(url: string | null | undefined): string | undefined {
  if (!url || url.trim() === "") return undefined
  // Don't proxy data URIs, blobs, or already-proxied URLs
  if (url.startsWith("data:") || url.startsWith("blob:") || url.includes(PROXY_PATH)) {
    return url
  }
  return `${PROXY_PATH}?url=${encodeURIComponent(url)}`
}

/**
 * Returns the best avatar URL for a user, preferring the explicit avatar_url
 * over the video avatar, falling back to the default placeholder.
 */
export function getAvatarUrl(
  avatarUrl?: string | null,
  videoAvatarUrl?: string | null,
  placeholder: string = "/placeholder-user.jpg"
): string {
  const raw = avatarUrl || videoAvatarUrl || placeholder
  return getProxyUrl(raw) || placeholder
}

/**
 * Returns the best media URL for a post/reel/circle image.
 * If the URL is empty, returns undefined so the caller can hide the element.
 */
export function getMediaUrl(url: string | null | undefined): string | undefined {
  return getProxyUrl(url)
}

/**
 * Generates an <img> onError handler that retries once through the proxy,
 * then falls back to a default placeholder. Use this on any <img> that
 * displays user-uploaded content.
 *
 * Example:
 *   <img src={getProxyUrl(url)} onError={handleImageError("/placeholder-user.jpg")} />
 */
export function handleImageError(fallback: string = "/placeholder-user.jpg") {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    // If the image already failed after proxying, show placeholder
    if (!img.dataset.retried) {
      img.dataset.retried = "true"
      // Try the raw URL (maybe proxy caused the issue)
      const src = img.src
      if (src.includes(PROXY_PATH)) {
        // Extract original URL from proxy src
        try {
          const proxyUrl = new URL(src, window.location.origin)
          const original = proxyUrl.searchParams.get("url")
          if (original && !original.startsWith(PROXY_PATH)) {
            img.src = original
            return
          }
        } catch { /* ignore */ }
      }
    }
    img.src = fallback
  }
}
