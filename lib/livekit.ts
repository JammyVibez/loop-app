import { AccessToken } from "livekit-server-sdk"

/**
 * LiveKit server-side helpers — the free, open-source fallback to 100ms for
 * livestreams and voice/video calls (same SFU/WebRTC model).
 *
 * Credentials live in the server environment only:
 *   LIVEKIT_API_KEY     — LiveKit Cloud project API key (Settings → Keys)
 *   LIVEKIT_API_SECRET  — LiveKit Cloud project API secret
 *   LIVEKIT_URL         — e.g. "wss://<project>.livekit.cloud" (client connect URL)
 *
 * Unlike 100ms there is no create-room REST call: rooms are created
 * implicitly the first time a participant with a valid token joins, so the
 * server only ever mints JWTs.
 */

export function livekitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET &&
      process.env.LIVEKIT_URL,
  )
}

/**
 * Normalized client connect URL. Accepts any of these forms and converts
 * them to a wss:// WebSocket URL the browser can dial:
 *   https://<project>.livekit.cloud   → wss://<project>.livekit.cloud
 *   <project>.livekit.cloud           → wss://<project>.livekit.cloud
 *   wss://<project>.livekit.cloud     → unchanged
 */
export function livekitUrl(): string {
  const raw = (process.env.LIVEKIT_URL || "").trim().replace(/\/+$/, "")
  if (!raw) return ""
  if (raw.startsWith("wss://") || raw.startsWith("ws://")) return raw
  if (raw.startsWith("https://")) return `wss://${raw.slice("https://".length)}`
  if (raw.startsWith("http://")) return `ws://${raw.slice("http://".length)}`
  return `wss://${raw}`
}

function requireCredentials() {
  const key = process.env.LIVEKIT_API_KEY
  const secret = process.env.LIVEKIT_API_SECRET
  const url = livekitUrl()
  if (!key || !secret || !url) {
    throw new Error(
      "LiveKit is not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL (LiveKit Cloud → Settings → Keys).",
    )
  }
  // Catch the most common paste mistakes early so users get a clear 503
  // instead of a confusing client-side "Failed to fetch".
  if (/cloud\.livekit\.io|dashboard|console/.test(url)) {
    throw new Error(
      "LIVEKIT_URL looks wrong. It must be your project WebSocket URL like wss://<project>.livekit.cloud — not the LiveKit dashboard/console URL.",
    )
  }
  return { key, secret, url }
}

/**
 * Mint a LiveKit access token for one participant. `canPublish` controls
 * whether they may publish camera/mic/screen (hosts) or can only watch and
 * listen (viewers/guests).
 */
export async function createLiveKitToken(opts: {
  room: string
  identity: string
  name?: string
  canPublish?: boolean
  canPublishData?: boolean
  ttlSeconds?: number
}): Promise<{ token: string; url: string }> {
  const { key, secret, url } = requireCredentials()
  const at = new AccessToken(key, secret, {
    identity: opts.identity,
    ttl: opts.ttlSeconds || 24 * 3600,
  })
  if (opts.name) at.name = opts.name
  at.addGrant({
    room: opts.room,
    roomJoin: true,
    canPublish: opts.canPublish !== false,
    canSubscribe: true,
    canPublishData: opts.canPublishData !== false,
  })
  const token = await at.toJwt()
  return { token, url }
}

/** Build a unique, human-readable room name for a loop call/livestream. */
export function livekitRoomName(prefix: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10)
  return `loop-${prefix}-${suffix}`
}
