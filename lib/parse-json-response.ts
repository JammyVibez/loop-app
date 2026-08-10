/**
 * Safely parse a fetch Response as JSON.
 * Host proxies (e.g. Vercel) often return plain text like "Request Entity Too Large"
 * for oversized bodies — calling `.json()` then throws "Unexpected token R...".
 */
export async function parseJsonResponse<T = any>(
  response: Response,
): Promise<{ data: T; rawText: string }> {
  const rawText = await response.text()
  const trimmed = rawText.trim()

  if (!trimmed) {
    return { data: {} as T, rawText }
  }

  try {
    return { data: JSON.parse(trimmed) as T, rawText }
  } catch {
    const lower = trimmed.toLowerCase()
    if (
      response.status === 413 ||
      lower.includes("request entity too large") ||
      lower.includes("payload too large") ||
      lower.includes("entity too large")
    ) {
      throw new Error(
        "File is too large to upload through this connection. Try a shorter clip or a smaller file (under ~4MB via proxy, or use a compressed video).",
      )
    }
    throw new Error(
      trimmed.slice(0, 160) || `Upload failed (${response.status || "unknown"})`,
    )
  }
}
