/**
 * HLS proxying for the Channels guide.
 *
 * UltraSrc can run on a private interface next to the app, and the manifests it
 * returns point at its own origin (`http://127.0.0.1:3010/x/<ticket>`). A
 * browser can neither reach that origin nor send the bearer key, so playback is
 * served from the app's own origin: `/api/channels/hls/*` forwards to the API
 * and rewrites every upstream path into a proxy path.
 *
 * This module is pure so the rewrite rules can be tested without a server.
 */

export const HLS_PROXY_PREFIX = "/api/channels/hls"

/**
 * Map an upstream playback URL onto the same-origin proxy.
 * Third-party media URLs are left untouched — only the configured API is
 * reachable through the proxy.
 */
export function toProxiedPath(
  url: string | null | undefined,
  upstreamOrigin: string,
): string | null {
  if (!url) return null
  const origin = upstreamOrigin.replace(/\/+$/, "")
  if (origin && (url === origin || url.startsWith(`${origin}/`))) {
    return `${HLS_PROXY_PREFIX}${url.slice(origin.length)}` || HLS_PROXY_PREFIX
  }
  if (url.startsWith("/") && !url.startsWith("//")) return `${HLS_PROXY_PREFIX}${url}`
  return url
}

/**
 * Rewrite a playlist so every reference resolves through the proxy.
 *
 * `directory` is the upstream directory of the manifest (with a trailing
 * slash), used to resolve relative segment names. Every rewrite is idempotent,
 * so a playlist that is already proxied is passed through unchanged.
 */
export function rewriteHlsPlaylist(
  text: string,
  { upstreamOrigin, directory }: { upstreamOrigin: string; directory: string },
): string {
  const origin = upstreamOrigin.replace(/\/+$/, "")
  const proxied = origin ? text.split(`${origin}/`).join(`${HLS_PROXY_PREFIX}/`) : text
  const relativeBase = `${HLS_PROXY_PREFIX}${directory.startsWith("/") ? directory : `/${directory}`}`

  return proxied
    .split("\n")
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]*)"/g, (match, value: string) => {
          if (value.startsWith(HLS_PROXY_PREFIX)) return match
          if (value.startsWith("/") && !value.startsWith("//")) {
            return `URI="${HLS_PROXY_PREFIX}${value}"`
          }
          return match
        })
      }

      if (trimmed.startsWith(HLS_PROXY_PREFIX)) return line
      // Absolute or protocol-relative URLs are third-party media; leave them.
      if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return line
      if (trimmed.startsWith("/")) return `${HLS_PROXY_PREFIX}${trimmed}`
      return `${relativeBase}${trimmed}`
    })
    .join("\n")
}
