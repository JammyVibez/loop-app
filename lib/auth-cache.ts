/**
 * Last known session, mirrored to localStorage.
 *
 * A hard refresh throws away all in-memory state, so the app used to re-derive
 * "am I signed in?" from scratch on every reload — and any hiccup in that
 * round-trip (a slow cold start, a 429, a dropped request) rendered as signed
 * out. Keeping a copy of the identity lets a refresh fall back to the
 * signed-in UI instead of collapsing into a guest view.
 *
 * The cache deliberately holds **presentation data only**. `token` and
 * `access_token` come from the Better Auth session and are exactly what the
 * httpOnly session cookie exists to keep away from JavaScript, so they are
 * stripped before anything is written. This cache never authenticates a
 * request; it only decides what to draw while the real check runs.
 */

export const AUTH_USER_CACHE_KEY = "loop:auth:user:v1"

/** Session-bearing fields that must never reach localStorage. */
const CREDENTIAL_FIELDS = ["token", "access_token"]

/** Copy a user object without anything that could be replayed as a credential. */
export function stripCredentials<T extends object>(user: T): T {
  const cached = { ...user } as Record<string, unknown>
  for (const field of CREDENTIAL_FIELDS) delete cached[field]
  return cached as T
}

/**
 * Read the cached identity. Returns null on anything unexpected — a corrupt
 * entry, a value missing an `id`, or a browser where storage is unavailable —
 * because a bad cache must never be able to fake a session.
 */
export function readCachedUser<T>(): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(AUTH_USER_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    if (typeof (parsed as { id?: unknown }).id !== "string" || !(parsed as { id: string }).id) {
      return null
    }
    return parsed as T
  } catch {
    return null
  }
}

/** Persist (credential-stripped) or clear the cached identity. Best-effort. */
export function writeCachedUser<T extends object>(user: T | null): void {
  if (typeof window === "undefined") return
  try {
    if (user) {
      window.localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(stripCredentials(user)))
    } else {
      window.localStorage.removeItem(AUTH_USER_CACHE_KEY)
    }
  } catch {
    /* private mode / quota — the cache is best-effort, never load-bearing */
  }
}
