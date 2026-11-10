/**
 * Feature tour configuration + persistence.
 *
 * The tour itself is a generic spotlight engine
 * (`components/tour/coach-mark-tour.tsx`) — adding a feature to the tour is
 * just another entry in this list, no new components needed.
 */

export interface CoachMarkStep {
  id: string
  /** CSS selector for the real UI element this tip explains. */
  target: string
  /** Fallback selectors, tried in order when the primary target isn't mounted. */
  fallbackTargets?: string[]
  title: string
  body: string
  /** Preferred side for the tip card (defaults to "bottom"). */
  placement?: "top" | "bottom" | "left" | "right"
  /** Extra padding around the spotlight, in px. */
  padding?: number
}

/** Local mirror of `profiles.has_seen_feature_tour` — keeps the tour from
 *  repeating even if the profile write is blocked (offline, RLS, etc.). */
export const FEATURE_TOUR_STORAGE_KEY = "loop:feature-tour:seen"

/**
 * The on-feed tour. Each step points at a REAL element in the live feed UI
 * (matched via `data-tour` attributes); steps whose element isn't present are
 * skipped automatically, so this list can grow without breaking the tour.
 */
export const FEED_TOUR_STEPS: CoachMarkStep[] = [
  {
    id: "create",
    target: '[data-tour="create-loop"]',
    fallbackTargets: ['a[href="/create"]'],
    title: "Start in the Create studio",
    body: "One place for every format: a Loop, a tree, a Moment, a live room or a Co-Loop. You can branch any post from its menu too.",
    placement: "bottom",
    padding: 8,
  },
  {
    id: "feed",
    target: '[data-tour="feed-tools"]',
    fallbackTargets: ['[data-tour="feed-tabs"]'],
    title: "Make the feed yours",
    body: "For You learns from what you engage with, Following stays newest-first, and Filters let you pick topics, view mode and sensitive content.",
    placement: "bottom",
    padding: 8,
  },
  {
    id: "mobile-menu",
    target: '[data-tour="mobile-nav"]',
    title: "The rest of Loop is one swipe away",
    body: "On Android, swipe in from the left edge to pull out the full sidebar. Quests, Chains, Audio Rooms, Channels, Drops, Events and Saved all live there.",
    placement: "top",
    padding: 6,
  },
  {
    id: "duels",
    target: '[data-tour="duels"]',
    fallbackTargets: ['[data-tour="duels-entry"]'],
    title: "Duels",
    body: "Two sides, one community vote. Duels settle the argument publicly — and the winner takes the pot.",
    placement: "top",
    padding: 10,
  },
  {
    id: "circles",
    target: '[data-tour="nav-circles"]',
    fallbackTargets: ['a[href="/communities"]', 'a[href="/circles"]'],
    title: "Circles",
    body: "Circles are Loop's community hub: rooms, forums, voice, events and challenges, all with people who care about the same things.",
    placement: "right",
    padding: 8,
  },
  {
    id: "notifications",
    target: '[data-tour="notifications"]',
    title: "Your activity, in one place",
    body: "Likes, comments, mentions, gifts and Loop announcements land here. On phones the bell opens a full-height activity sheet instead of squeezing into the bar.",
    placement: "bottom",
    padding: 8,
  },
  {
    id: "wallet",
    target: '[data-tour="wallet"]',
    fallbackTargets: ['a[href="/wallet"]'],
    title: "Coins, gifts and payouts",
    body: "Your balance opens the wallet: spend coins on gifts and boosts, convert received gifts into coins, or withdraw as a verified creator.",
    placement: "bottom",
    padding: 8,
  },
  {
    id: "profile",
    target: '[data-tour="nav-profile"]',
    fallbackTargets: ['a[href="/inventory"]'],
    title: "Your account menu",
    body: "Your avatar opens your profile, theme, settings, creator tools and linked accounts. The menu scrolls, so every option stays reachable on a phone.",
    placement: "bottom",
    padding: 8,
  },
]

export function hasSeenFeatureTour(profile?: { has_seen_feature_tour?: boolean | null } | null) {
  if (profile?.has_seen_feature_tour === true) return true
  if (typeof window === "undefined") return true
  try {
    return window.localStorage.getItem(FEATURE_TOUR_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export function markFeatureTourSeenLocally() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(FEATURE_TOUR_STORAGE_KEY, "true")
  } catch {
    /* storage unavailable — the profile flag still covers it */
  }
}

export function resetFeatureTourLocally() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(FEATURE_TOUR_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Persist `has_seen_feature_tour` on the user's profile row (best effort). */
export async function persistFeatureTourSeen(seen: boolean, authHeaders?: Record<string, string>) {
  try {
    await fetch("/api/users/update-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authHeaders || {}) },
      body: JSON.stringify({ has_seen_feature_tour: seen }),
    })
  } catch {
    /* best effort — the local flag keeps the tour from repeating */
  }
}
