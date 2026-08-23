/**
 * Dual-ID Utility Layer
 *
 * During the transition period (Phase 3), both UUID and Snowflake IDs coexist.
 * This module provides helpers that let application code work seamlessly:
 *
 * - Write new rows with BOTH UUID (via default) and Snowflake ID (via generator)
 * - Query by either ID format
 * - Resolve a Snowflake ID to a UUID (for Better Auth compatibility)
 * - Resolve a UUID to a Snowflake ID (for API responses)
 *
 * After Phase 4 (cutover), the UUID columns will be dropped and this layer
 * can be simplified or removed.
 */

import { createClient } from "@/lib/supabase"
import { generateSnowflakeId, generateSnowflakeIdString } from "@/lib/snowflake-id"

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase configuration")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ─── Insert helpers ────────────────────────────────────────────────────────

/**
 * Generate a Snowflake ID to include in a new row's payload.
 * Call this when inserting any row that has a snowflake_id column.
 *
 * Usage in API routes:
 *   const payload = { id: uuid, snowflake_id: sfId(), author_id: user.id, ... }
 *   await supabase.from("loops").insert(payload)
 */
export function sfId(): string {
  return generateSnowflakeIdString()
}

/**
 * Generate a Snowflake ID bigint for raw SQL or direct DB access.
 */
export function sfIdBigInt(): bigint {
  return generateSnowflakeId()
}

// ─── Lookup helpers ────────────────────────────────────────────────────────

/**
 * Resolve a Snowflake ID to a UUID (for Better Auth / session lookups).
 * Returns null if not found.
 */
export async function snowflakeToUUID(
  table: string,
  snowflakeId: string | number | bigint
): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("snowflake_id", String(snowflakeId))
    .maybeSingle()
  if (error || !data) return null
  return data.id as string
}

/**
 * Resolve a UUID to a Snowflake ID (for API responses / URLs).
 * Returns null if not found.
 */
export async function uuidToSnowflake(
  table: string,
  uuid: string
): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from(table)
    .select("snowflake_id")
    .eq("id", uuid)
    .maybeSingle()
  if (error || !data || !data.snowflake_id) return null
  return String(data.snowflake_id)
}

/**
 * Look up a row by either UUID or Snowflake ID.
 * Automatically detects which format was passed and queries accordingly.
 *
 * Usage:
 *   const loop = await findById("loops", loopId)
 *   // loopId could be a UUID or a Snowflake ID string
 */
export async function findById(
  table: string,
  id: string,
  select: string = "*"
): Promise<Record<string, unknown> | null> {
  const supabase = createServiceClient()

  // Try UUID first (contains hyphens)
  if (id.includes("-")) {
    const { data } = await supabase.from(table).select(select).eq("id", id).maybeSingle()
    return (data as unknown as Record<string, unknown>) || null
  }

  // Try Snowflake ID (pure numeric)
  if (/^\d+$/.test(id)) {
    const { data } = await supabase.from(table).select(select).eq("snowflake_id", id).maybeSingle()
    return (data as unknown as Record<string, unknown>) || null
  }

  return null
}

/**
 * Look up a row by Snowflake ID only. Faster than findById when you know
 * the ID is a Snowflake.
 */
export async function findBySnowflakeId(
  table: string,
  snowflakeId: string | number | bigint,
  select: string = "*"
): Promise<Record<string, unknown> | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from(table)
    .select(select)
    .eq("snowflake_id", String(snowflakeId))
    .maybeSingle()
  return (data as unknown as Record<string, unknown>) || null
}

// ─── Batch lookup helpers ──────────────────────────────────────────────────

/**
 * Map an array of UUIDs to their Snowflake IDs.
 * Returns a Map<uuid, snowflakeId>.
 */
export async function uuidsToSnowflakes(
  table: string,
  uuids: string[]
): Promise<Map<string, string>> {
  if (uuids.length === 0) return new Map()
  const supabase = createServiceClient()
  const { data } = await supabase
    .from(table)
    .select("id, snowflake_id")
    .in("id", uuids)
  const map = new Map<string, string>()
  for (const row of data || []) {
    if (row.snowflake_id) map.set(row.id, String(row.snowflake_id))
  }
  return map
}

/**
 * Map an array of Snowflake IDs to their UUIDs.
 * Returns a Map<snowflakeId, uuid>.
 */
export async function snowflakesToUUIDs(
  table: string,
  snowflakeIds: (string | number | bigint)[]
): Promise<Map<string, string>> {
  if (snowflakeIds.length === 0) return new Map()
  const supabase = createServiceClient()
  const { data } = await supabase
    .from(table)
    .select("id, snowflake_id")
    .in("snowflake_id", snowflakeIds.map(String))
  const map = new Map<string, string>()
  for (const row of data || []) {
    if (row.snowflake_id) map.set(String(row.snowflake_id), row.id)
  }
  return map
}

// ─── Response formatting ───────────────────────────────────────────────────

/**
 * Transform a database row to include snowflake_id as the primary "id" field
 * for API responses. During the transition, this adds the snowflake_id alongside
 * the existing UUID id.
 *
 * Usage in API routes:
 *   const loop = formatForResponse(rawLoopData, "loops")
 *   // loop.id remains UUID for backward compat, loop.snowflake_id added
 */
export function formatForResponse(
  row: Record<string, unknown>,
  _table?: string
): Record<string, unknown> {
  // During Phase 3, we include both. The snowflake_id is in the row from the DB.
  // No transformation needed — the raw row already has both `id` (UUID) and
  // `snowflake_id` (bigint). Just ensure snowflake_id is a string for JSON.
  if (row.snowflake_id != null) {
    return { ...row, snowflake_id: String(row.snowflake_id) }
  }
  return row
}

/**
 * Format multiple rows for API responses.
 */
export function formatManyForResponse(
  rows: Record<string, unknown>[],
  table?: string
): Record<string, unknown>[] {
  return rows.map((r) => formatForResponse(r, table))
}
