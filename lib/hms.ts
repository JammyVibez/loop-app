import jwt from "jsonwebtoken"

/**
 * 100ms server-side helpers (livestream + video/voice calls).
 *
 * Credentials live in the server environment only:
 *   HMS_ACCESS_KEY  — 100ms App Access Key (dashboard → Developer)
 *   HMS_SECRET      — 100ms App Secret (dashboard → Developer)
 *
 * Optional tuning:
 *   HMS_HOST_ROLE   — role used for call/livestream creators  (default "host")
 *   HMS_GUEST_ROLE  — role used for call participants/viewers (default "guest")
 *   HMS_REGION      — "eu" | "in" | "us" | "auto"              (default "auto")
 *
 * Auth model (see https://www.100ms.live/docs/get-started/v2/get-started/security-and-tokens):
 *  - a "management" JWT authenticates REST calls (create room)
 *  - an "app" JWT (room_id + role + user_id) lets a client SDK join a room
 * The secret never leaves the server.
 */

const HMS_API_BASE = "https://api.100ms.live/v2"

export function hmsConfigured(): boolean {
  return Boolean(process.env.HMS_ACCESS_KEY && process.env.HMS_SECRET)
}

export function hmsHostRole(): string {
  return process.env.HMS_HOST_ROLE || "host"
}

export function hmsGuestRole(): string {
  return process.env.HMS_GUEST_ROLE || "guest"
}

function requireCredentials() {
  const key = process.env.HMS_ACCESS_KEY
  const secret = process.env.HMS_SECRET
  if (!key || !secret) {
    throw new Error(
      "100ms is not configured. Set HMS_ACCESS_KEY and HMS_SECRET in your environment (dashboard → Developer → App Access Key / App Secret).",
    )
  }
  return { key, secret }
}

/** JWT used to authenticate requests to the 100ms REST API (24h validity). */
function managementToken(): string {
  const { key, secret } = requireCredentials()
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      access_key: key,
      type: "management",
      version: 2,
      iat: now,
      nbf: now,
    },
    secret,
    { algorithm: "HS256", expiresIn: "24h", jwtid: crypto.randomUUID() },
  )
}

/** JWT that lets one of your users join a room as `role`. */
export function createHmsAppToken(opts: {
  roomId: string
  userId: string
  role: string
  ttlSeconds?: number
}): string {
  const { key, secret } = requireCredentials()
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      access_key: key,
      room_id: opts.roomId,
      user_id: opts.userId,
      role: opts.role,
      type: "app",
      version: 2,
      iat: now,
      nbf: now,
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: opts.ttlSeconds || 24 * 3600,
      jwtid: crypto.randomUUID(),
    },
  )
}

export type HmsRoom = { id: string; name: string }

/**
 * Create a 100ms room. Reusing an existing room name returns the same room,
 * so callers must pass a unique name per session (we use a uuid suffix).
 */
export async function createHmsRoom(name: string, description?: string): Promise<HmsRoom> {
  const body: Record<string, unknown> = { name, description }
  const region = process.env.HMS_REGION
  if (region) body.region = region

  let res: Response
  try {
    res = await fetch(`${HMS_API_BASE}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })
  } catch (err) {
    console.error("[hms] createHmsRoom network error:", err)
    throw new Error("Could not reach the 100ms API. Check HMS_ACCESS_KEY / HMS_SECRET.")
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error("[hms] createHmsRoom failed:", res.status, data)
    const msg =
      typeof data?.message === "string" ? data.message : `100ms create room failed (${res.status})`
    throw new Error(msg)
  }
  if (!data?.id) throw new Error("100ms did not return a room id")
  return { id: data.id, name: data.name }
}

/** Build a unique, human-readable room name for a loop call/livestream. */
export function hmsRoomName(prefix: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10)
  return `loop-${prefix}-${suffix}`
}
