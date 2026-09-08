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
 * Attaches the real parent-loop payload to every loop that was branched from
 * another loop.
 *
 * PostgREST's self-referencing `loops!parent_loop_id` embed silently resolves
 * to an empty array for self-FK relationships, so feed responses used to ship
 * branches without any parent info — making every card render the generic
 * "Branch from the original post" fallback instead of naming the author.
 *
 * This does what the embed should have done, in one batched query, and sets
 * `loop.parent_loop` in the exact shape normalizeLoop expects
 * ({ id, content_text, author: { username, display_name, is_verified, ... } }).
 * Rows that already carry a usable parent are left untouched.
 */
export async function attachParentAuthors(supabase: any, loops: any[]): Promise<any[]> {
  if (!Array.isArray(loops) || loops.length === 0) return loops

  // Only request parents for rows that have no usable parent payload yet
  // (the PostgREST embed returns [] for self-FK rows, so treat empty as missing).
  const missing = loops.filter(
    (l) => l?.parent_loop_id && !(l?.parent_loop && (Array.isArray(l.parent_loop) ? l.parent_loop.length : true)),
  )
  const parentIds = [...new Set(missing.map((l) => l.parent_loop_id).filter(Boolean))]
  if (parentIds.length === 0) return loops

  const CHUNK = 200
  const parents = new Map<string, any>()
  for (let i = 0; i < parentIds.length; i += CHUNK) {
    const chunk = parentIds.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from("loops")
      .select(`
        id, content_text, content_title, author_id,
        author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, is_team_member)
      `)
      .in("id", chunk)
    if (error) {
      console.error("attachParentAuthors error:", error.message)
      continue
    }
    for (const row of data || []) {
      const parentAuthor = Array.isArray(row.author) ? row.author[0] : row.author
      parents.set(row.id, {
        id: row.id,
        content_text: row.content_text,
        content_title: row.content_title,
        author_id: row.author_id,
        author: parentAuthor || null,
      })
    }
  }
  if (parents.size === 0) return loops

  for (const loop of loops) {
    if (!loop?.parent_loop_id) continue
    // Skip rows that already carry a resolved parent object (or a non-empty array).
    const existing = loop.parent_loop
    if (existing && typeof existing === "object") {
      if (!Array.isArray(existing) && (existing.author || existing.id)) continue
      if (Array.isArray(existing) && existing.length > 0) continue
    }
    const parent = parents.get(loop.parent_loop_id)
    if (parent) loop.parent_loop = parent
  }
  return loops
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
