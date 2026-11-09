const CHUNK_ERROR_PATTERN = /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Importing a module script failed|error loading dynamically imported module/i

const RELOAD_KEY = "loop:chunk-reload-at"

/** A deploy replaced the build, so the tab is asking for a chunk that no longer exists. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const { name, message } = error as { name?: unknown; message?: unknown }
  return CHUNK_ERROR_PATTERN.test(`${typeof name === "string" ? name : ""} ${typeof message === "string" ? message : ""}`)
}

/**
 * Reload the tab once so it picks up the current build. The guard stops a
 * reload loop when the chunk is genuinely missing (bad deploy, offline) — the
 * caller then shows a manual "Reload" instead of retrying forever.
 */
export function reloadOnceForChunkError(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < 30_000) return false
    const now = Date.now()
    window.sessionStorage.setItem(RELOAD_KEY, String(now))
    const freshUrl = new URL(window.location.href)
    freshUrl.searchParams.set("__loop_chunk_reload", String(now))
    window.location.replace(freshUrl.toString())
  } catch {
    return false
  }
  return true
}
