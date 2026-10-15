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
  theme: NoteTheme
  show_on_profile: boolean
  show_on_posts: boolean
  show_on_communities: boolean
  created_at: string
  expires_at: string
}

/** The three places a note can be shown, in surface terms. */
export type NoteVisibility = Record<NoteSurface, boolean>

/* ── Colour themes ────────────────────────────────────────────────────────
 *
 * A note is a bubble; the author picks its colour. The list is closed — the
 * database CHECK, the API validator and the picker all read this one array,
 * so a typo cannot invent a colour the stylesheet has never heard of, and
 * every class below is written out in full because Tailwind only ships
 * classes it can see in the source.
 */
export const NOTE_THEMES = [
  "indigo",
  "violet",
  "fuchsia",
  "cyan",
  "emerald",
  "amber",
  "rose",
  "slate",
] as const
export type NoteTheme = (typeof NOTE_THEMES)[number]

/** The colour every existing note gets, and the one new notes start on. */
export const DEFAULT_NOTE_THEME: NoteTheme = "indigo"

export interface NoteThemeStyle {
  /** Name shown under the swatch in the composer. */
  label: string
  /** The picker dot. */
  swatch: string
  /** Card chip: border, wash and glow for the one-line bubble. */
  chip: string
  /** Profile bubble: border, gradient and glow for the larger bubble. */
  profile: string
  /** Tint shared by the bubbles' glyph. */
  icon: string
}

export const NOTE_THEME_STYLES: Record<NoteTheme, NoteThemeStyle> = {
  indigo: {
    label: "Indigo",
    swatch: "bg-indigo-400",
    chip: "border-indigo-400/35 bg-indigo-500/15 shadow-indigo-950/30",
    profile: "border-indigo-400/40 bg-gradient-to-br from-indigo-500/25 to-cyan-500/20 shadow-indigo-950/40",
    icon: "text-indigo-300",
  },
  violet: {
    label: "Violet",
    swatch: "bg-violet-400",
    chip: "border-violet-400/35 bg-violet-500/15 shadow-violet-950/30",
    profile: "border-violet-400/40 bg-gradient-to-br from-violet-500/25 to-purple-500/20 shadow-violet-950/40",
    icon: "text-violet-300",
  },
  fuchsia: {
    label: "Fuchsia",
    swatch: "bg-fuchsia-400",
    chip: "border-fuchsia-400/35 bg-fuchsia-500/15 shadow-fuchsia-950/30",
    profile: "border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-500/25 to-pink-500/20 shadow-fuchsia-950/40",
    icon: "text-fuchsia-300",
  },
  cyan: {
    label: "Cyan",
    swatch: "bg-cyan-400",
    chip: "border-cyan-400/35 bg-cyan-500/15 shadow-cyan-950/30",
    profile: "border-cyan-400/40 bg-gradient-to-br from-cyan-500/25 to-sky-500/20 shadow-cyan-950/40",
    icon: "text-cyan-300",
  },
  emerald: {
    label: "Emerald",
    swatch: "bg-emerald-400",
    chip: "border-emerald-400/35 bg-emerald-500/15 shadow-emerald-950/30",
    profile: "border-emerald-400/40 bg-gradient-to-br from-emerald-500/25 to-teal-500/20 shadow-emerald-950/40",
    icon: "text-emerald-300",
  },
  amber: {
    label: "Amber",
    swatch: "bg-amber-400",
    chip: "border-amber-400/35 bg-amber-500/15 shadow-amber-950/30",
    profile: "border-amber-400/40 bg-gradient-to-br from-amber-500/25 to-orange-500/20 shadow-amber-950/40",
    icon: "text-amber-300",
  },
  rose: {
    label: "Rose",
    swatch: "bg-rose-400",
    chip: "border-rose-400/35 bg-rose-500/15 shadow-rose-950/30",
    profile: "border-rose-400/40 bg-gradient-to-br from-rose-500/25 to-red-500/20 shadow-rose-950/40",
    icon: "text-rose-300",
  },
  slate: {
    label: "Slate",
    swatch: "bg-slate-300",
    chip: "border-slate-300/35 bg-slate-400/15 shadow-slate-950/30",
    profile: "border-slate-300/40 bg-gradient-to-br from-slate-400/25 to-zinc-500/20 shadow-slate-950/40",
    icon: "text-slate-200",
  },
}

export function isNoteTheme(value: unknown): value is NoteTheme {
  return typeof value === "string" && (NOTE_THEMES as readonly string[]).includes(value)
}

/**
 * A row's theme, or the default. Rows written before themes existed (and any
 * row a direct SQL write left blank) fall back instead of rendering nothing.
 */
export function noteThemeFromRow(value: unknown): NoteTheme {
  return isNoteTheme(value) ? value : DEFAULT_NOTE_THEME
}

/** Never-fashionable lookup: unknown themes render as the default palette. */
export function noteThemeStyle(theme: unknown): NoteThemeStyle {
  return NOTE_THEME_STYLES[noteThemeFromRow(theme)]
}

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

/**
 * Whether a viewer may see a note that lives on a profile page.
 *
 * The note sits under the bio, so a profile that hides its bio from strangers
 * must hide its note too — otherwise the privacy setting quietly stops
 * meaning anything. The owner and accepted followers always see it; a public
 * profile shows it to everyone, because that is what the author chose.
 */
export function canViewProfileNote(options: {
  visibility?: string | null
  viewerId?: string | null
  ownerId?: string | null
  isFollower?: boolean
}): boolean {
  const { visibility, viewerId, ownerId, isFollower } = options
  const isRestricted = visibility === "private" || visibility === "followers"
  if (!isRestricted) return true
  if (viewerId && ownerId && viewerId === ownerId) return true
  return Boolean(isFollower)
}
