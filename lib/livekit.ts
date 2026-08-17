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

export function livekitUrl(): string {
  return (process.env.LIVEKIT_URL || "").trim()
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
