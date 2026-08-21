/**
 * Real-time loop stats helpers.
 *
 * The denormalized `loop_stats.comments_count` counter can drift or go
 * missing (older posts created before counters existed, RPC failures,
 * legacy insert paths), which shows wrong comment counts in the UI.
 *
 * These helpers recompute the count from the authoritative `comments`
 * table in one batched query so every surface always shows the truth.
 */

/**
 * Returns loop_id -> total number of comments (including replies) from the
 * `comments` table. Uses a raw count query per loop for accuracy on large
 * datasets instead of pulling every row.
 */
export async function realCommentCounts(
  supabase: any,
  loopIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const ids = [...new Set(loopIds.filter(Boolean))]
  if (!ids.length) return map

  // Chunk to stay under URL/IN clause limits.
  const CHUNK = 200
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from("comments")
      .select("loop_id, id", { count: "exact", head: false })
      .in("loop_id", chunk)
    if (error) {
      console.error("realCommentCounts error:", error.message)
      continue
    }
    for (const row of data || []) {
      map.set(row.loop_id, (map.get(row.loop_id) || 0) + 1)
    }
  }
  return map
}

/**
 * Overwrites the `comments_count` inside each loop's `loop_stats` (or injects
 * a minimal stats row) with the true count from the `comments` table.
 * Pass raw (pre-normalize) loop rows; returns the same array mutated in place.
 */
export async function applyRealCommentCounts(supabase: any, loops: any[]): Promise<any[]> {
  if (!Array.isArray(loops) || loops.length === 0) return loops
  const counts = await realCommentCounts(
    supabase,
    loops.map((l) => l?.id),
  )
  if (!counts.size) return loops

  for (const loop of loops) {
    const real = counts.get(loop?.id)
    if (real === undefined) continue
    const stats = Array.isArray(loop?.loop_stats) ? loop.loop_stats[0] : loop?.loop_stats
    if (stats && typeof stats === "object") {
      stats.comments_count = real
    } else {
      loop.loop_stats = {
        likes_count: 0,
        comments_count: real,
        branches_count: 0,
        shares_count: 0,
        views_count: 0,
      }
    }
  }
  return loops
}

/**
 * Returns loop_id -> total number of branches (posts where parent_loop_id = loop_id)
 * from the `loops` table. This recomputes the denormalized branches_count from truth.
 */
export async function realBranchCounts(
  supabase: any,
  loopIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const ids = [...new Set(loopIds.filter(Boolean))]
  if (!ids.length) return map

  const CHUNK = 200
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    // Count loops that branch FROM each parent_loop_id
    const { data, error } = await supabase
      .from("loops")
      .select("parent_loop_id, id", { count: "exact", head: false })
      .in("parent_loop_id", chunk)
      .is("deleted_at", null)
    if (error) {
      console.error("realBranchCounts error:", error.message)
      continue
    }
    for (const row of data || []) {
      if (row.parent_loop_id) {
        map.set(row.parent_loop_id, (map.get(row.parent_loop_id) || 0) + 1)
      }
    }
  }
  return map
}

/**
 * Overwrites the `branches_count` inside each loop's `loop_stats` with the
 * true count from the `loops` table (posts where parent_loop_id = loop.id).
 */
export async function applyRealBranchCounts(supabase: any, loops: any[]): Promise<any[]> {
  if (!Array.isArray(loops) || loops.length === 0) return loops
  const counts = await realBranchCounts(
    supabase,
    loops.map((l) => l?.id),
  )
  if (!counts.size) return loops

  for (const loop of loops) {
    const real = counts.get(loop?.id)
    if (real === undefined) continue
    const stats = Array.isArray(loop?.loop_stats) ? loop.loop_stats[0] : loop?.loop_stats
    if (stats && typeof stats === "object") {
      stats.branches_count = real
    } else {
      loop.loop_stats = {
        likes_count: 0,
        comments_count: 0,
        branches_count: real,
        shares_count: 0,
        views_count: 0,
      }
    }
  }
  return loops
}
