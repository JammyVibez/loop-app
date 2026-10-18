/**
 * Server-side Realtime broadcast.
 *
 * `channel.send()` from a server client only works reliably once that channel
 * has completed a WebSocket handshake; a one-shot send on a fresh channel can
 * be queued and dropped. The REST broadcast endpoint takes the message
 * straight to the Realtime service, so a route handler can fan out an event
 * without holding a socket open.
 */

const TIMEOUT_MS = 3000

export async function broadcastRealtime(
  topic: string,
  event: string,
  payload: Record<string, unknown> | unknown,
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return false

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return response.ok
  } catch {
    // Realtime being unreachable must never fail the write that triggered it.
    return false
  }
}
