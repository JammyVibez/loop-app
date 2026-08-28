/**
 * Security audit logging system.
 * Tracks login attempts, 2FA events, password changes, and suspicious activity.
 */

import { createServerClient } from "@/lib/supabase"

export type SecurityAction =
  // Auth events
  | "login_success"
  | "login_failed"
  | "logout"
  | "signup"
  | "password_changed"
  | "password_reset_requested"
  | "password_reset_completed"
  // 2FA events
  | "2fa_enabled"
  | "2fa_disabled"
  | "2fa_backup_code_used"
  | "2fa_code_failed"
  // Account events
  | "email_changed"
  | "account_deleted"
  | "account_deletion_cancelled"
  | "profile_updated"
  // Session events
  | "session_revoked"
  | "all_sessions_revoked"
  // Suspicious activity
  | "rate_limit_exceeded"
  | "sql_injection_attempt"
  | "xss_attempt"
  | "unauthorized_access_attempt"
  // Financial events
  | "coins_purchased"
  | "coins_gifted"
  | "withdrawal_requested"
  | "withdrawal_completed"

export interface AuditLogEntry {
  userId?: string
  action: SecurityAction
  details?: Record<string, any>
  ip?: string
  userAgent?: string
  timestamp?: Date
}

/**
 * Log a security event to the database
 */
export async function logSecurityEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createServerClient()

    const logEntry = {
      user_id: entry.userId || null,
      action: entry.action,
      details: entry.details ? JSON.stringify(entry.details) : null,
      ip_address: entry.ip || null,
      user_agent: entry.userAgent?.slice(0, 500) || null,
      created_at: new Date().toISOString(),
    }

    // Non-blocking insert — don't fail the main request if logging fails
    await supabase.from("security_audit_log").insert(logEntry)
  } catch (error) {
    // Audit logging should never crash the app
    console.error("Security audit log failed:", error)
  }
}

/**
 * Get client IP from request headers
 */
export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

/**
 * Get user agent from request headers
 */
export function getRequestUserAgent(request: Request): string {
  return request.headers.get("user-agent") || "unknown"
}

/**
 * Check for suspicious activity patterns
 */
export async function checkSuspiciousActivity(
  ip: string,
  timeWindowMs: number = 15 * 60 * 1000 // 15 minutes
): Promise<{
  suspicious: boolean
  reasons: string[]
  failedAttempts: number
}> {
  const reasons: string[] = []
  let failedAttempts = 0

  try {
    const supabase = createServerClient()
    const since = new Date(Date.now() - timeWindowMs).toISOString()

    // Check failed logins from this IP
    const { data: failedLogins } = await supabase
      .from("security_audit_log")
      .select("id")
      .eq("ip_address", ip)
      .eq("action", "login_failed")
      .gte("created_at", since)

    failedAttempts = failedLogins?.length || 0
    if (failedAttempts >= 5) {
      reasons.push(`${failedAttempts} failed login attempts in ${timeWindowMs / 60000} minutes`)
    }

    // Check for injection attempts
    const { data: injections } = await supabase
      .from("security_audit_log")
      .select("id")
      .eq("ip_address", ip)
      .in("action", ["sql_injection_attempt", "xss_attempt"])
      .gte("created_at", since)

    if (injections && injections.length > 0) {
      reasons.push(`${injections.length} injection attempts detected`)
    }

    // Check for rate limit hits
    const { data: rateLimits } = await supabase
      .from("security_audit_log")
      .select("id")
      .eq("ip_address", ip)
      .eq("action", "rate_limit_exceeded")
      .gte("created_at", since)

    if (rateLimits && rateLimits.length > 5) {
      reasons.push(`${rateLimits.length} rate limit violations`)
    }
  } catch {
    // Don't fail on audit check errors
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
    failedAttempts,
  }
}

/**
 * Get recent security events for a user
 */
export async function getUserSecurityEvents(
  userId: string,
  limit: number = 50
): Promise<Array<{
  id: string
  action: string
  details: any
  ip_address: string
  created_at: string
}>> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("security_audit_log")
      .select("id, action, details, ip_address, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    return (data || []).map((row) => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null,
    }))
  } catch {
    return []
  }
}
