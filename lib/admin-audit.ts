import { createServerClient } from "@/lib/supabase"

/**
 * Admin audit logging for coin / pricing / subscription actions.
 * Writes to `admin_action_log` (see scripts/admin-monetization-schema.sql).
 * Never throws — audit failures must not break the admin action itself.
 */
export type AdminAuditAction =
  | "coin_pricing_create"
  | "coin_pricing_update"
  | "coin_pricing_delete"
  | "coin_pricing_deactivate"
  | "coin_adjust"
  | "coin_tx_edit"
  | "coin_tx_delete"
  | "coin_tx_restore"
  | "premium_grant"
  | "premium_revoke"
  | "premium_edit"

export interface AdminAuditEntry {
  adminId: string
  action: AdminAuditAction
  /** Affected user (e.g. the user whose coins/sub was changed), if any. */
  targetUserId?: string | null
  /** Free-text reason/note captured from the admin UI. */
  reason?: string | null
  details?: Record<string, unknown>
}

export async function logAdminAction(
  supabase: ReturnType<typeof createServerClient> | any,
  entry: AdminAuditEntry,
): Promise<void> {
  try {
    const row: Record<string, unknown> = {
      admin_id: entry.adminId,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      reason: entry.reason ?? null,
      details: entry.details ? entry.details : null,
    }
    await supabase.from("admin_action_log").insert(row)
  } catch (error) {
    console.error("Admin audit log failed:", error)
  }
}
