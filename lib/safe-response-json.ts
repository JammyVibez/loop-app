import { RustApiError } from "@/lib/rust-api"

/** Parse JSON without leaking a framework HTML document into UI error messages. */
export async function safeResponseJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const raw = await response.text().catch(() => "")
  if (!raw.trim()) {
    throw new RustApiError(`The server returned an empty response (${response.status}).`, response.status)
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    if (/<\s*(!doctype|html)\b/i.test(raw.slice(0, 160))) {
      throw new RustApiError(
        "This feature's API route is unavailable; the server returned an HTML page instead of JSON.",
        response.status,
        "service_unavailable",
      )
    }
    throw new RustApiError("The server returned an invalid JSON response.", response.status, "invalid_json")
  }
}
