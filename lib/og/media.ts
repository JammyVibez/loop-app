/**
 * Media inlining for OG cards.
 *
 * Cards are rendered by satori inside an edge function: every image must be
 * a data URI by the time the template runs, so a slow CDN can never stall a
 * share preview. Only same-origin and known image hosts are ever fetched —
 * the URL arrives through the query string, so arbitrary hosts are refused.
 */

const MAX_BYTES = 2_000_000
const TIMEOUT_MS = 2500

function toDataUri(buf: ArrayBuffer, type: string): string {
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:${type};base64,${btoa(binary)}`
}

function allowed(raw: string, origin: string): URL | null {
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `/${raw.replace(/^\/+/, "")}`, origin)
    const sameOrigin = parsed.host === new URL(origin).host
    const knownCdn =
      parsed.host === "res.cloudinary.com" ||
      parsed.host === "images.unsplash.com" ||
      parsed.host === "api.dicebear.com" ||
      parsed.host.endsWith(".supabase.co")
    return sameOrigin || knownCdn ? parsed : null
  } catch {
    return null
  }
}

/** Inline an image, or return undefined so the template falls back. */
export async function loadImageDataUri(raw: string | null | undefined, origin: string): Promise<string | undefined> {
  if (!raw) return undefined
  const url = allowed(String(raw), origin)
  if (!url) return undefined
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return undefined
    const type = res.headers.get("content-type") || "image/png"
    if (!type.startsWith("image/")) return undefined
    const buf = await res.arrayBuffer()
    if (!buf.byteLength || buf.byteLength > MAX_BYTES) return undefined
    return toDataUri(buf, type)
  } catch {
    return undefined
  }
}

/**
 * Inline the real Loop app icon (`/icons/icon-512x512.png`) so every card
 * carries the official mark instead of a drawn stand-in. `false` = not yet
 * tried, `null` = tried and failed (never retry inside the same isolate).
 */
let logoCache: string | null | false = false

export async function loadLogoDataUri(origin: string): Promise<string | undefined> {
  if (logoCache !== false) return logoCache || undefined
  try {
    const res = await fetch(new URL("/icons/icon-512x512.png", origin).toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      logoCache = null
      return undefined
    }
    const buf = await res.arrayBuffer()
    if (!buf.byteLength || buf.byteLength > 1_500_000) {
      logoCache = null
      return undefined
    }
    logoCache = toDataUri(buf, "image/png")
    return logoCache
  } catch {
    logoCache = null
    return undefined
  }
}
