/**
 * Native share with clipboard fallback. Returns "shared" | "copied" | "aborted" | "failed".
 */
export async function shareContent(options: {
  url: string
  title?: string
  text?: string
}): Promise<"shared" | "copied" | "aborted" | "failed"> {
  const { url, title, text } = options
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title, text, url })
      return "shared"
    }
    await navigator.clipboard.writeText(url)
    return "copied"
  } catch (error: any) {
    if (error?.name === "AbortError") return "aborted"
    try {
      await navigator.clipboard.writeText(url)
      return "copied"
    } catch {
      return "failed"
    }
  }
}

export function absoluteAppUrl(path: string): string {
  if (typeof window === "undefined") return path
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${window.location.origin}${normalized}`
}
