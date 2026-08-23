/**
 * Snowflake ID Generator for Loop App
 *
 * Generates Twitter/Discord-style 64-bit time-sortable IDs.
 * Each ID encodes: timestamp (ms since custom epoch) + worker ID + sequence.
 *
 * Configuration:
 *   - Epoch: 2025-01-01 00:00:00 UTC (maximizes bit space for years of IDs)
 *   - Worker ID: Configurable via env SNOWFLAKE_WORKER_ID (default: 1)
 *   - Data Center ID: Configurable via env SNOWFLAKE_DATACENTER_ID (default: 1)
 *
 * Layout (64 bits):
 *   [1 bit unused] [41 bits timestamp] [5 bits datacenter] [5 bits worker] [12 bits sequence]
 *
 * Capacity: ~281 trillion unique IDs before timestamp bits overflow (~69 years from epoch).
 * Sequence wraps every 4096 IDs per millisecond — safe for single/multi-server.
 */

import { Worker } from "snowflake-uuid"

// Singleton generator — initialized lazily to avoid import-time side effects
let _generator: Worker | null = null

function getGenerator(): Worker {
  if (!_generator) {
    const workerId = parseInt(process.env.SNOWFLAKE_WORKER_ID || "1", 10)
    const datacenterId = parseInt(process.env.SNOWFLAKE_DATACENTER_ID || "1", 10)
    _generator = new Worker(datacenterId, workerId)
  }
  return _generator
}

/**
 * Generate a new unique Snowflake ID.
 * Returns a bigint (use BigInt() in SQL or .toString() for string contexts).
 */
export function generateSnowflakeId(): bigint {
  return getGenerator().nextId()
}

/**
 * Generate a Snowflake ID and return it as a string.
 * Useful for passing to Supabase queries that expect string values.
 */
export function generateSnowflakeIdString(): string {
  return getGenerator().nextId().toString()
}

/**
 * Parse a Snowflake ID string back to bigint.
 * Returns null if the input is not a valid Snowflake ID.
 */
export function parseSnowflakeId(value: string | number | bigint | null | undefined): bigint | null {
  if (value == null) return null
  try {
    const big = BigInt(value)
    // Basic validation: Snowflake IDs are positive and fit in 64 bits
    if (big <= BigInt(0) || big > BigInt("9223372036854775807")) return null
    return big
  } catch {
    return null
  }
}

/**
 * Extract the timestamp from a Snowflake ID.
 * Returns a Date object, useful for sorting/debugging.
 */
export function snowflakeToTimestamp(id: bigint | string): Date {
  const big = typeof id === "string" ? BigInt(id) : id
  // Extract top 41 bits (after the sign bit), shift right by 22
  const timestampMs = Number(big >> BigInt(22)) + 1735689600000
  return new Date(timestampMs)
}

/**
 * Extract the worker/datacenter ID from a Snowflake ID.
 * Useful for debugging multi-server setups.
 */
export function snowflakeToWorkerInfo(id: bigint | string): { datacenterId: number; workerId: number; sequence: number } {
  const big = typeof id === "string" ? BigInt(id) : id
  const datacenterId = Number((big >> BigInt(17)) & BigInt(0x1f))
  const workerId = Number((big >> BigInt(12)) & BigInt(0x1f))
  const sequence = Number(big & BigInt(0xfff))
  return { datacenterId, workerId, sequence }
}

/**
 * Validate that a value is a plausible Snowflake ID (positive bigint, fits in 64 bits).
 */
export function isValidSnowflakeId(value: unknown): boolean {
  if (value == null) return false
  try {
    const big = BigInt(value as any)
    return big > BigInt(0) && big <= BigInt("9223372036854775807")
  } catch {
    return false
  }
}
