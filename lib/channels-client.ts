/**
 * Browser-side access to `/api/channels`.
 *
 * Keeps the "not connected / failed / succeeded" distinction in one place so
 * every channel surface renders the same states.
 */

export interface ChannelResource<T> {
  configured: boolean
  data: T | null
  error: string | null
}

interface Envelope<T> {
  ok?: boolean
  configured?: boolean
  data?: T | null
  error?: string
}

export async function loadChannelResource<T>(
  params: Record<string, string | number | undefined>,
): Promise<ChannelResource<T>> {
  try {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value))
    }

    const response = await fetch(`/api/channels?${query.toString()}`, { cache: "no-store" })
    const payload = (await response.json().catch(() => null)) as Envelope<T> | null

    if (payload?.configured === false) {
      return { configured: false, data: null, error: null }
    }
    if (!response.ok || payload?.ok === false) {
      return {
        configured: true,
        data: null,
        error: payload?.error ?? "Channels could not load right now.",
      }
    }
    return { configured: true, data: payload?.data ?? null, error: null }
  } catch {
    return { configured: true, data: null, error: "Channels could not load right now." }
  }
}
