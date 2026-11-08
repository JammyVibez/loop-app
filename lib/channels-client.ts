/**
 * Browser-side access to the Channels APIs.
 *
 * Keeps the "not connected / failed / succeeded" distinction in one place so
 * every channel surface renders the same states.
 */

import type { ChannelTitle, ChannelTitleDetails, ChannelTitleKind } from "@/lib/channels-library"

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

async function request<T>(url: string): Promise<ChannelResource<T>> {
  try {
    const response = await fetch(url, { cache: "no-store" })
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

function queryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value))
  }
  return query.toString()
}

/** UltraSrc-backed resources (dramas and novels). */
export async function loadChannelResource<T>(
  params: Record<string, string | number | undefined>,
): Promise<ChannelResource<T>> {
  return request<T>(`/api/channels?${queryString(params)}`)
}

/** First-party library: movies and shows uploaded by staff. */
export async function loadLibrary(
  params: { kind?: ChannelTitleKind; q?: string; limit?: number } = {},
): Promise<ChannelResource<{ titles: ChannelTitle[] }>> {
  return request<{ titles: ChannelTitle[] }>(`/api/channels/library?${queryString(params)}`)
}

export async function loadLibraryTitle(id: string): Promise<ChannelResource<ChannelTitleDetails>> {
  return request<ChannelTitleDetails>(`/api/channels/library/${encodeURIComponent(id)}`)
}
