/**
 * Feed density rules.
 *
 * X-style density means a feed card renders a count only when there is
 * something to count. A post with zero likes, comments, branches and shares
 * shows four quiet icons — not "0 0 0 0", which is the single biggest source of
 * visual noise in a timeline.
 */

/**
 * Whether a feed action should render its numeric count.
 *
 * Guards against the usual suspects as well as zero: `undefined`/`null` (field
 * missing from the API), `NaN` (bad arithmetic upstream) and negative values
 * all resolve to "no count" rather than printing junk next to an icon.
 */
export function shouldShowCount(value: unknown): boolean {
  const n = Number(value)
  return Number.isFinite(n) && n > 0
}

/**
 * Whether a secondary/status badge row is worth rendering on a feed card.
 * Returns false when nothing is set, so a normal post keeps a single author
 * line instead of an empty row.
 */
export function hasAnyFlag(flags: Array<unknown>): boolean {
  return flags.some((flag) => flag === true)
}
