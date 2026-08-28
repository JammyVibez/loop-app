/**
 * TOTP (Time-based One-Time Password) implementation for 2FA.
 * Uses HMAC-SHA1 with 30-second windows and 6-digit codes.
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 */

import crypto from "crypto"

const TOTP_PERIOD = 30 // seconds
const TOTP_DIGITS = 6
const TOTP_ALGORITHM = "sha1"
const BACKUP_CODES_COUNT = 10

/**
 * Generate a random base32 secret key for TOTP
 */
export function generateSecret(): string {
  const buffer = crypto.randomBytes(20)
  return base32Encode(buffer)
}

/**
 * Generate TOTP URI for QR code scanning
 * Format: otpauth://totp/{issuer}:{email}?secret={secret}&issuer={issuer}&digits=6&period=30
 */
export function generateTOTPUri(
  secret: string,
  email: string,
  issuer: string = "Loop"
): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedEmail = encodeURIComponent(email)
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}&algorithm=SHA1`
}

/**
 * Generate the current TOTP code for a given secret
 */
export function generateTOTP(secret: string, timeOffset: number = 0): string {
  const key = base32Decode(secret)
  const time = Math.floor(Date.now() / 1000 / TOTP_PERIOD) + timeOffset

  // Convert time to 8-byte big-endian buffer
  const timeBuffer = Buffer.alloc(8)
  timeBuffer.writeUInt32BE(0, 0)
  timeBuffer.writeUInt32BE(time, 4)

  // HMAC-SHA1
  const hmac = crypto.createHmac(TOTP_ALGORITHM, key)
  hmac.update(timeBuffer)
  const hash = hmac.digest()

  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)

  const otp = code % Math.pow(10, TOTP_DIGITS)
  return otp.toString().padStart(TOTP_DIGITS, "0")
}

/**
 * Verify a TOTP code against a secret.
 * Checks current window and ±1 window (90 second tolerance).
 */
export function verifyTOTP(secret: string, code: string): boolean {
  // Check current window and ±1 window for clock drift tolerance
  for (let offset = -1; offset <= 1; offset++) {
    const expectedCode = generateTOTP(secret, offset)
    if (timingSafeEqual(code, expectedCode)) {
      return true
    }
  }
  return false
}

/**
 * Generate backup/recovery codes (one-time use)
 */
export function generateBackupCodes(count: number = BACKUP_CODES_COUNT): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(4)
    // Format: XXXX-XXXX-XXXX
    const code = [
      bytes.toString("hex", 0, 2).toUpperCase(),
      bytes.toString("hex", 2, 4).toUpperCase(),
      bytes.toString("hex", 4, 6).toUpperCase(),
    ].join("-")
    codes.push(code)
  }
  return codes
}

/**
 * Hash backup codes for secure storage (never store plaintext)
 */
export function hashBackupCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.replace(/-/g, "").toLowerCase())
    .digest("hex")
}

/**
 * Verify a backup code against its hash
 */
export function verifyBackupCode(code: string, hash: string): boolean {
  const computed = hashBackupCode(code)
  return timingSafeEqual(computed, hash)
}

// ─── Helpers ───────────────────────────────────────────────────────

function base32Encode(buffer: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = ""
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0")
  }
  let result = ""
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0")
    result += alphabet[parseInt(chunk, 2)]
  }
  return result
}

function base32Decode(encoded: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const clean = encoded.replace(/[^A-Z2-7]/gi, "").toUpperCase()
  let bits = ""
  for (const char of clean) {
    const val = alphabet.indexOf(char)
    if (val === -1) continue
    bits += val.toString(2).padStart(5, "0")
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return crypto.timingSafeEqual(bufA, bufB)
}
