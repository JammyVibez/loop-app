/**
 * Profile notes — the short, self-erasing line under your name (Instagram
 * Notes style): up to 60 characters, gone after 24 hours.
 *
 * Two rules carry the feature:
 *
 * 1. A note never outlives a day. Nothing to remember, nothing to clean up,
 *    and a stale opinion can't be dug up in six months.
 * 2. The author decides where it appears. A note is public by default (their
 *    profile, their posts, the communities they post in), but any of those
 *    three surfaces can be switched off per note — so "everywhere" is the
 *    default, not a fixed rule.
 *
 * Everything here is pure so both the API route and the UI agree on what a
 * note is, and so the rules can be tested without a database.
 */

export const NOTE_MAX_LENGTH = 60
export const NOTE_TTL_HOURS = 24

export const NOTE_SURFACES = ["profile", "posts", "communities"] as const
export type NoteSurface = (typeof NOTE_SURFACES)[number]

/** Row shape returned by the API. */
export interface ProfileNote {
  id: string
  user_id: string
  content: string
  show_on_profile: boolean
  show_on_posts: boolean
  show_on_communities: boolean
  created_at: string
  expires_at: string
}

/** The three places a note can be shown, in surface terms. */
export type NoteVisibility = Record<NoteSurface, boolean>

const SURFACE_COLUMN: Record<NoteSurface, "show_on_profile" | "show_on_posts" | "show_on_communities"> = {
  profile: "show_on_profile",
  posts: "show_on_posts",
  communities: "show_on_communities",
}

/** Default surface flags written to the row (public everywhere). */
export function visibilityFlags(visibility: Partial<NoteVisibility>) {
  return {
    show_on_profile: visibility.profile !== false,
    show_on_posts: visibility.posts !== false,
    show_on_communities: visibility.communities !== false,
  }
}

export function visibilityFromRow(note: Pick<ProfileNote, "show_on_profile" | "show_on_posts" | "show_on_communities">): NoteVisibility {
  return {
    profile: Boolean(note.show_on_profile),
    posts: Boolean(note.show_on_posts),
    communities: Boolean(note.show_on_communities),
  }
}

/**
 * Normalise user input into note text: collapse runs of whitespace (so a
 * pasted paragraph becomes one line) and drop control characters.
 */
function collapseWhitespace(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " " )
    .trim()
}

/**
 * The text that will be stored: collapsed, then cut at the limit so a broken
 * client can never park an essay where the UI promises one line.
 */
export function sanitizeNoteText(raw: unknown): string {
  return collapseWhitespace(raw).slice(0, NOTE_MAX_LENGTH)
}

/**
 * Whether the input is acceptable as written — over-long input is rejected,
 * not silently shortened, so a client that ignores the counter hears about it.
 */
export function isNoteLengthValid(raw: unknown): boolean {
  const text = collapseWhitespace(raw)
  return text.length > 0 && text.length <= NOTE_MAX_LENGTH
}

/** A note is live only until its expiry — reads never trust the row blindly. */
export function isNoteLive(note: Pick<ProfileNote, "expires_at"> | null | undefined, now: number = Date.now()): boolean {
  if (!note?.expires_at) return false
  const expires = Date.parse(note.expires_at)
  return Number.isFinite(expires) && expires > now
}

export function noteVisibleFor(
  note: Pick<ProfileNote, "show_on_profile" | "show_on_posts" | "show_on_communities" | "expires_at"> | null | undefined,
  surface: NoteSurface,
  now: number = Date.now(),
): boolean {
  if (!note || !isNoteLive(note, now)) return false
  return Boolean(note[SURFACE_COLUMN[surface]])
}

/** Hours left on a live note, for copy like "expires in 6h". */
export function noteHoursLeft(note: Pick<ProfileNote, "expires_at"> | null | undefined, now: number = Date.now()): number {
  if (!note?.expires_at) return 0
  const expires = Date.parse(note.expires_at)
  if (!Number.isFinite(expires)) return 0
  return Math.max(0, Math.ceil((expires - now) / 3_600_000))
}

/** "2h", "14h" — used on the profile bubble where the timer is worth showing. */
export function noteExpiryLabel(note: Pick<ProfileNote, "expires_at"> | null | undefined, now: number = Date.now()): string {
  const hours = noteHoursLeft(note, now)
  return `${Math.max(1, hours)}h`
}

/** Expiry timestamp for a note created right now. */
export function noteExpiryFrom(now: number = Date.now()): Date {
  return new Date(now + NOTE_TTL_HOURS * 3_600_000)
}

/** Which DB column a surface reads, so the API and the UI can't drift. */
export function surfaceColumn(surface: NoteSurface) {
  return SURFACE_COLUMN[surface]
}

/** Human label for the composer's toggles. */
export function surfaceLabel(surface: NoteSurface): string {
  switch (surface) {
    case "profile":
      return "On my profile"
    case "posts":
      return "On my posts"
    case "communities":
      return "In communities"
  }
}
