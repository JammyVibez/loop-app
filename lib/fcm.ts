import "server-only"
import crypto from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Firebase Cloud Messaging (HTTP v1) delivery for the native Capacitor shell.
 *
 * Works with either:
 *  - a Firebase service account (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 *    FIREBASE_PRIVATE_KEY) — recommended, uses OAuth2 JWT auth, or
 *  - the legacy server key (FCM_SERVER_KEY) — simple, uses the older endpoint.
 *
 * Without any Firebase env vars this is a graceful no-op, so web-only
 * deployments keep working and the native pipeline lights up the moment the
 * keys are added (see docs/NATIVE_APP.md).
 */

type FcmResult = { delivered: number; failed: number; skipped?: string }

function firebaseConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()?.replace(/\\n/g, "\n")
  const serverKey = process.env.FCM_SERVER_KEY?.trim()
  if (projectId && clientEmail && privateKey) {
    return { kind: "serviceAccount" as const, projectId, clientEmail, privateKey }
  }
  if (serverKey) {
    return { kind: "legacy" as const, projectId: "", clientEmail: "", privateKey: "", serverKey }
  }
  return null
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null

function signJwt(clientEmail: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const claims = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url")
  const signature = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), privateKey)
  return `${header}.${claims}.${signature.toString("base64url")}`
}

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token
  }
  const jwt = signJwt(clientEmail, privateKey)
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    throw new Error(`FCM token exchange failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  const data = await res.json()
  cachedAccessToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 }
  return data.access_token
}

function buildMessage(payload: { title: string; body: string; url?: string; icon?: string; data?: Record<string, unknown> }) {
  return {
    message: {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        url: payload.url || "/",
        icon: payload.icon || "",
        ...Object.fromEntries(Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])),
      },
      android: { priority: "high" as const },
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
    },
  }
}

/**
 * Deliver a push notification to every FCM token a user has registered.
 * No-op when Firebase is not configured.
 */
export async function sendFcmToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: { title: string; body: string; url?: string; icon?: string; data?: Record<string, unknown> },
): Promise<FcmResult> {
  const config = firebaseConfig()
  if (!config) return { delivered: 0, failed: 0, skipped: "no_firebase_config" }

  const { data: tokens, error } = await supabase
    .from("native_push_tokens")
    .select("id, token, platform")
    .eq("user_id", userId)

  if (error || !tokens?.length) {
    return { delivered: 0, failed: 0, skipped: error?.message || "no_native_tokens" }
  }

  const message = buildMessage(payload)
  let delivered = 0
  let failed = 0
  const staleIds: string[] = []

  try {
    const accessToken =
      config.kind === "serviceAccount"
        ? await getAccessToken(config.clientEmail, config.privateKey)
        : null

    await Promise.all(
      tokens.map(async (row: any) => {
        try {
          let res: Response
          if (config.kind === "serviceAccount") {
            res = await fetch(`https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ ...message, message: { ...message.message, token: row.token } }),
            })
          } else {
            res = await fetch("https://fcm.googleapis.com/fcm/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `key=${config.serverKey}`,
              },
              body: JSON.stringify({
                to: row.token,
                notification: { title: payload.title, body: payload.body },
                data: { url: payload.url || "/" },
                priority: "high",
              }),
            })
          }
          if (res.ok) {
            delivered += 1
          } else {
            failed += 1
            if (res.status === 404 || res.status === 400) staleIds.push(row.id)
            else console.warn(`FCM send failed (${res.status}):`, (await res.text()).slice(0, 160))
          }
        } catch (err) {
          failed += 1
          console.warn("FCM send error:", err)
        }
      }),
    )
  } catch (err) {
    console.warn("FCM delivery error:", err)
    return { delivered: 0, failed: tokens.length, skipped: "auth_error" }
  }

  if (staleIds.length) {
    await supabase.from("native_push_tokens").delete().in("id", staleIds)
  }

  return { delivered, failed }
}
