/**
 * Input sanitization library for XSS prevention.
 * Strips dangerous HTML, scripts, and event handlers while preserving safe content.
 */

// ─── HTML Sanitization ─────────────────────────────────────────────

const DANGEROUS_TAGS = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
const DANGEROUS_EVENT_HANDLERS = /\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi
const DANGEROUS_PROTOCOLS = /(?:javascript|vbscript|data)\s*:/gi
const IFRAME_TAGS = /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi
const OBJECT_TAGS = /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi
const EMBED_TAGS = /<embed\b[^>]*>/gi
const FORM_TAGS = /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi
const STYLE_TAGS = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi
const LINK_TAGS = /<link\b[^>]*>/gi
const META_TAGS = /<meta\b[^>]*>/gi

/**
 * Strip all HTML tags from a string (full sanitize)
 */
export function stripHtml(input: string): string {
  if (!input) return ""
  return input
    .replace(DANGEROUS_TAGS, "")
    .replace(IFRAME_TAGS, "")
    .replace(OBJECT_TAGS, "")
    .replace(EMBED_TAGS, "")
    .replace(FORM_TAGS, "")
    .replace(STYLE_TAGS, "")
    .replace(LINK_TAGS, "")
    .replace(META_TAGS, "")
    .replace(/<[^>]+>/g, "")
    .trim()
}

/**
 * Sanitize user input for display (allows safe HTML like bold/italic)
 */
export function sanitizeDisplay(input: string): string {
  if (!input) return ""
  return input
    .replace(DANGEROUS_TAGS, "")
    .replace(IFRAME_TAGS, "")
    .replace(OBJECT_TAGS, "")
    .replace(EMBED_TAGS, "")
    .replace(DANGEROUS_EVENT_HANDLERS, "")
    .replace(DANGEROUS_PROTOCOLS, "safe:")
    .replace(FORM_TAGS, "")
    .replace(SCRIPT_TAGS, "")
}

// ─── Text Sanitization ─────────────────────────────────────────────

const SCRIPT_TAGS = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi

/**
 * Sanitize text content (no HTML allowed)
 */
export function sanitizeText(input: string): string {
  if (!input) return ""
  return stripHtml(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

/**
 * Sanitize a username (alphanumeric, underscore, hyphen, 3-30 chars)
 */
export function sanitizeUsername(input: string): string {
  if (!input) return ""
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 30)
}

/**
 * Sanitize a display name (allows letters, numbers, spaces, some punctuation)
 */
export function sanitizeDisplayName(input: string): string {
  if (!input) return ""
  return input
    .replace(/[<>"'&]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50)
}

/**
 * Sanitize bio content (allows newlines and basic formatting)
 */
export function sanitizeBio(input: string): string {
  if (!input) return ""
  return stripHtml(input)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 500)
}

/**
 * Sanitize a URL (only allow http/https protocols)
 */
export function sanitizeUrl(input: string): string {
  if (!input) return ""
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`)
    if (!["http:", "https:"].includes(url.protocol)) {
      return ""
    }
    return url.toString()
  } catch {
    return ""
  }
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(input: string): string {
  if (!input) return ""
  const email = input.toLowerCase().trim()
  // Basic email validation
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    return ""
  }
  return email
}

// ─── Content Sanitization ──────────────────────────────────────────

/**
 * Sanitize loop/post content (text + hashtags)
 */
export function sanitizePostContent(input: string): string {
  if (!input) return ""
  return stripHtml(input)
    .replace(/\n{5,}/g, "\n\n\n")
    .trim()
    .slice(0, 5000) // Max 5000 chars
}

/**
 * Sanitize comment content
 */
export function sanitizeCommentContent(input: string): string {
  if (!input) return ""
  return stripHtml(input)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000) // Max 2000 chars
}

/**
 * Sanitize hashtag (lowercase, alphanumeric + underscore)
 */
export function sanitizeHashtag(input: string): string {
  if (!input) return ""
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^#/, "")
    .slice(0, 30)
}

/**
 * Sanitize a message/chat content
 */
export function sanitizeMessageContent(input: string): string {
  if (!input) return ""
  return stripHtml(input)
    .replace(/\n{10,}/g, "\n\n\n\n")
    .trim()
    .slice(0, 5000)
}

// ─── Validation Helpers ────────────────────────────────────────────

/**
 * Validate that a string contains only safe characters
 */
export function isSafeString(input: string, maxLength: number = 500): boolean {
  if (!input || typeof input !== "string") return false
  if (input.length > maxLength) return false
  // Check for null bytes
  if (input.includes("\0")) return false
  return true
}

/**
 * Validate that a number is within expected range
 */
export function isSafeNumber(input: any, min: number = 0, max: number = Number.MAX_SAFE_INTEGER): boolean {
  const num = Number(input)
  if (isNaN(num) || !isFinite(num)) return false
  return num >= min && num <= max
}

/**
 * Validate UUID format
 */
export function isValidUUID(input: string): boolean {
  if (!input) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)
}

/**
 * Detect potential SQL injection attempts
 */
export function detectSqlInjection(input: string): boolean {
  if (!input) return false
  const patterns = [
    /'\s*or\s+'1'\s*=\s*'1/i,
    /'\s*or\s+1\s*=\s*1/i,
    /;\s*drop\s+table/i,
    /;\s*delete\s+from/i,
    /;\s*insert\s+into/i,
    /;\s*update\s+.+\s+set/i,
    /union\s+select/i,
    /\/\*.*\*\//,
    /--\s/,
    /'\s*;\s*/i,
  ]
  return patterns.some((p) => p.test(input))
}

/**
 * Detect potential XSS attempts
 */
export function detectXss(input: string): boolean {
  if (!input) return false
  const patterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<link[^>]+rel\s*=\s*["']stylesheet/i,
    /expression\s*\(/i,
    /data:\s*text\/html/i,
  ]
  return patterns.some((p) => p.test(input))
}

/**
 * Comprehensive input check — returns sanitized string or null if dangerous
 */
export function safeInput(input: string, options: {
  maxLength?: number
  allowHtml?: boolean
  type?: "text" | "username" | "email" | "url" | "bio" | "post" | "comment" | "message"
} = {}): string | null {
  const { maxLength = 5000, allowHtml = false, type = "text" } = options

  if (!input || typeof input !== "string") return null
  if (input.length > maxLength) return null
  if (detectSqlInjection(input)) return null
  if (detectXss(input)) return null

  switch (type) {
    case "username":
      return sanitizeUsername(input) || null
    case "email":
      return sanitizeEmail(input) || null
    case "url":
      return sanitizeUrl(input) || null
    case "bio":
      return sanitizeBio(input) || null
    case "post":
      return sanitizePostContent(input) || null
    case "comment":
      return sanitizeCommentContent(input) || null
    case "message":
      return sanitizeMessageContent(input) || null
    default:
      return allowHtml ? sanitizeDisplay(input) : sanitizeText(input)
  }
}
