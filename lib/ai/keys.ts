import "server-only"

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"

/**
 * Symmetric encryption for provider API keys at rest.
 *
 * The material comes from AI_KEY_SECRET when set, otherwise BETTER_AUTH_SECRET
 * (already required by the deployment). Losing that secret means re-entering
 * the keys in the admin panel — never silently falling back to plaintext.
 */
function keyMaterial(): Buffer {
  const secret = process.env.AI_KEY_SECRET || process.env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error("AI_KEY_SECRET (or BETTER_AUTH_SECRET) must be set to store AI provider keys")
  }
  return scryptSync(secret, "loop-ai-provider-keys", 32)
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":")
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, data] = payload.split(":")
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised stored key format")
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(iv, "base64"))
  decipher.setAuthTag(Buffer.from(tag, "base64"))
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")
}

/** Never return a key to the browser: show just enough to recognise it. */
export function maskSecret(plaintext: string): string {
  const trimmed = plaintext.trim()
  if (trimmed.length <= 8) return "••••"
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`
}
