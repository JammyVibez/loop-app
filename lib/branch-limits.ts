/**
 * Branch limits for a post's reply tree.
 *
 * Historically a branch tree stopped dead at 10 levels with no way for the
 * author to change it. Now the root post carries two optional limits:
 *
 *   max_branch_depth      — how deep the tree may grow below the root
 *   max_branches_per_user — how many branches one account may add to the root
 *
 * Both are NULL/0 for "unlimited", and both are inherited: a branch never
 * re-declares them, the whole tree reads them from its top-most post.
 */

export type BranchLimits = {
  /** Top-most post of the tree — where the limits (and their author) live. */
  rootId: string | null
  /** Maximum tree depth below the root. `null` = unlimited. */
  maxDepth: number | null
  /** Maximum branches one account may add to the root. `null` = unlimited. */
  maxPerUser: number | null
}

export const DEFAULT_BRANCH_LIMITS: BranchLimits = {
  rootId: null,
  maxDepth: null,
  maxPerUser: null,
}

/** Coerce a stored limit to a positive integer, or `null` for unlimited. */
export function normalizeBranchLimit(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

/**
 * Walk up `parent_loop_id` to the top-most post and read its limits.
 * Falls back to unlimited (and skips the extra columns) on databases that
 * have not yet run the migration, so branch creation never hard-fails
 * because of a missing column.
 */
export async function resolveBranchLimits(
  supabase: any,
  loopId: string,
): Promise<BranchLimits> {
  let currentId: string | null = loopId
  let root: { id: string; parent_loop_id: string | null; max_branch_depth?: unknown; max_branches_per_user?: unknown } | null = null
  const seen = new Set<string>()

  for (let hops = 0; hops < 64 && currentId; hops++) {
    if (seen.has(currentId)) break
    seen.add(currentId)

    const withLimits: { data: any; error: any } = await supabase
      .from("loops")
      .select("id, parent_loop_id, max_branch_depth, max_branches_per_user")
      .eq("id", currentId)
      .maybeSingle()

    let row: any = withLimits.data

    // Pre-migration database: the limit columns don't exist yet.
    if (withLimits.error) {
      const withoutLimits: { data: any; error: any } = await supabase
        .from("loops")
        .select("id, parent_loop_id")
        .eq("id", currentId)
        .maybeSingle()
      row = withoutLimits.data
    }

    if (!row) break
    root = row
    currentId = row.parent_loop_id || null
  }

  if (!root) return DEFAULT_BRANCH_LIMITS

  return {
    rootId: root.id,
    maxDepth: normalizeBranchLimit(root.max_branch_depth),
    maxPerUser: normalizeBranchLimit(root.max_branches_per_user),
  }
}

/**
 * True when a new branch at `parentDepth + 1` would cross the depth cap.
 * `maxDepth` counts levels *below the root*, so a parent already sitting at
 * the cap cannot take a child.
 */
export function exceedsDepthLimit(parentDepth: number, maxDepth: number | null): boolean {
  if (maxDepth == null) return false
  return parentDepth >= maxDepth
}

/** True when `existingCount` branches already fill the per-account cap. */
export function exceedsPerUserLimit(existingCount: number, maxPerUser: number | null): boolean {
  if (maxPerUser == null) return false
  return existingCount >= maxPerUser
}

/** How many branches this account has already added directly to the root. */
export async function countBranchesByUser(
  supabase: any,
  rootId: string,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("loops")
    .select("id", { count: "exact", head: true })
    .eq("parent_loop_id", rootId)
    .eq("author_id", userId)
  if (error) return 0
  return count || 0
}
