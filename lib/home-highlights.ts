/**
 * Home feed chrome budget.
 *
 * The home feed opens with a single row of quick actions, and the promotional
 * cards (welcome back, daily/weekly bonus, recap, active circles) sit behind a
 * toggle on that row. Dismissing the row is remembered so a returning user gets
 * top bar → feed tabs → first post with nothing in between.
 *
 * Kept out of the component so the persistence rules — and specifically the
 * "junk in storage must never surface chrome" rule — can be tested directly.
 */

export const HIGHLIGHTS_STORAGE_KEY = "loop:home-highlights"

export interface HighlightsState {
  /** Promotional cards revealed by the Highlights toggle. */
  expanded: boolean
  /** The whole row hidden by the user. */
  dismissed: boolean
}

export const DEFAULT_HIGHLIGHTS_STATE: HighlightsState = {
  expanded: false,
  dismissed: false,
}

/** Minimal shape of the storage we touch, so tests can pass a stub. */
export interface HighlightsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function resolveStorage(storage?: HighlightsStorage): HighlightsStorage | null {
  if (storage) return storage
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readHighlightsState(storage?: HighlightsStorage): HighlightsState {
  const store = resolveStorage(storage)
  if (!store) return { ...DEFAULT_HIGHLIGHTS_STATE }
  try {
    const raw = store.getItem(HIGHLIGHTS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_HIGHLIGHTS_STATE }
    const parsed = JSON.parse(raw) as Partial<HighlightsState> | null
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...DEFAULT_HIGHLIGHTS_STATE }
    }
    return {
      expanded: parsed.expanded === true,
      dismissed: parsed.dismissed === true,
    }
  } catch {
    // Corrupt entry or storage blocked — show the default row, never crash.
    return { ...DEFAULT_HIGHLIGHTS_STATE }
  }
}

export function writeHighlightsState(
  state: HighlightsState,
  storage?: HighlightsStorage,
): void {
  const store = resolveStorage(storage)
  if (!store) return
  try {
    store.setItem(
      HIGHLIGHTS_STORAGE_KEY,
      JSON.stringify({ expanded: state.expanded === true, dismissed: state.dismissed === true }),
    )
  } catch {
    /* storage unavailable — the row just behaves per-session */
  }
}

/** `false` means "draw no pre-feed chrome at all". */
export function isHighlightsRowVisible(state: HighlightsState): boolean {
  return !state.dismissed
}

/** `false` means "only the slim toolbar row, no promotional cards". */
export function areHighlightsCardsVisible(state: HighlightsState): boolean {
  return !state.dismissed && state.expanded
}
