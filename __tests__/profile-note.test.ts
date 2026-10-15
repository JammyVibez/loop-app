/**
 * Profile notes: the 60-character, 24-hour line under your name.
 *
 * The interesting rules are the ones the UI can't enforce on its own — text
 * that survives a paste, expiry that reads never trust, and the author's
 * per-note choice of where it shows. All of that lives in pure helpers so it
 * can be pinned down here.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_NOTE_THEME,
  NOTE_MAX_LENGTH,
  NOTE_THEMES,
  NOTE_TTL_HOURS,
  canViewProfileNote,
  isNoteLengthValid,
  isNoteLive,
  isNoteTheme,
  noteExpiryFrom,
  noteExpiryLabel,
  noteHoursLeft,
  noteThemeFromRow,
  noteVisibleFor,
  sanitizeNoteText,
  surfaceColumn,
  surfaceLabel,
  visibilityFlags,
  visibilityFromRow,
  type ProfileNote,
} from "@/lib/profile-note"
import { NOTE_THEME_STYLES, noteThemeStyle } from "@/components/notes/note-theme-styles"

const HOUR = 3_600_000

function note(overrides: Partial<ProfileNote> = {}): ProfileNote {
  const now = Date.now()
  return {
    id: "n1",
    user_id: "u1",
    content: "shipping tonight",
    theme: "indigo",
    show_on_profile: true,
    show_on_posts: true,
    show_on_communities: true,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + 6 * HOUR).toISOString(),
    ...overrides,
  }
}

describe("sanitizeNoteText", () => {
  it("collapses whitespace and trims", () => {
    expect(sanitizeNoteText("  hello    world \n")).toBe("hello world")
  })

  it("drops control characters but keeps emoji", () => {
    expect(sanitizeNoteText("ship\u0000 it 🚀")).toBe("ship it 🚀")
  })

  it("cuts at the limit", () => {
    expect(sanitizeNoteText("x".repeat(200))).toHaveLength(NOTE_MAX_LENGTH)
  })

  it("returns empty for non-strings", () => {
    expect(sanitizeNoteText(null)).toBe("")
    expect(sanitizeNoteText(undefined)).toBe("")
    expect(sanitizeNoteText(42)).toBe("")
  })
})

describe("isNoteLengthValid", () => {
  it("accepts 1 to 60 characters", () => {
    expect(isNoteLengthValid("a")).toBe(true)
    expect(isNoteLengthValid("a".repeat(NOTE_MAX_LENGTH))).toBe(true)
  })

  it("rejects empty, whitespace-only and over-long input", () => {
    expect(isNoteLengthValid("")).toBe(false)
    expect(isNoteLengthValid("   ")).toBe(false)
    expect(isNoteLengthValid("a".repeat(NOTE_MAX_LENGTH + 1))).toBe(false)
  })

  it("measures the sanitized text, so padded input is not rejected", () => {
    expect(isNoteLengthValid(`  ${"a".repeat(NOTE_MAX_LENGTH)}  `)).toBe(true)
  })
})

describe("expiry", () => {
  it("a note lives for 24 hours from creation", () => {
    const created = Date.now()
    expect(noteExpiryFrom(created).getTime() - created).toBe(NOTE_TTL_HOURS * HOUR)
  })

  it("is live until the expiry instant and not after", () => {
    const created = 1_700_000_000_000
    const live = note({ expires_at: new Date(created + HOUR).toISOString() })
    expect(isNoteLive(live, created)).toBe(true)
    expect(isNoteLive(live, created + HOUR)).toBe(false)
    expect(isNoteLive(live, created + HOUR + 1)).toBe(false)
  })

  it("treats a missing or unparseable expiry as not live", () => {
    expect(isNoteLive(null)).toBe(false)
    expect(isNoteLive(note({ expires_at: "not a date" }))).toBe(false)
  })

  it("reports hours left and a compact label", () => {
    const created = Date.now()
    const live = note({ expires_at: new Date(created + 6 * HOUR).toISOString() })
    expect(noteHoursLeft(live, created)).toBe(6)
    expect(noteExpiryLabel(live, created)).toBe("6h")
  })

  it("never reports a negative countdown", () => {
    const expired = note({ expires_at: new Date(Date.now() - HOUR).toISOString() })
    expect(noteHoursLeft(expired)).toBe(0)
    expect(noteExpiryLabel(expired)).toBe("1h")
  })
})

describe("visibility", () => {
  it("defaults to every surface", () => {
    expect(visibilityFlags({})).toEqual({
      show_on_profile: true,
      show_on_posts: true,
      show_on_communities: true,
    })
  })

  it("honours per-surface opt-outs", () => {
    expect(visibilityFlags({ posts: false, communities: false })).toEqual({
      show_on_profile: true,
      show_on_posts: false,
      show_on_communities: false,
    })
  })

  it("maps surfaces onto the right column", () => {
    expect(surfaceColumn("profile")).toBe("show_on_profile")
    expect(surfaceColumn("posts")).toBe("show_on_posts")
    expect(surfaceColumn("communities")).toBe("show_on_communities")
  })

  it("round-trips row flags back to a visibility object", () => {
    const flags = visibilityFlags({ communities: false })
    expect(visibilityFromRow(flags)).toEqual({ profile: true, posts: true, communities: false })
  })

  it("shows a note only where the author opted in", () => {
    const hiddenFromCommunities = note({ show_on_communities: false })
    expect(noteVisibleFor(hiddenFromCommunities, "profile")).toBe(true)
    expect(noteVisibleFor(hiddenFromCommunities, "posts")).toBe(true)
    expect(noteVisibleFor(hiddenFromCommunities, "communities")).toBe(false)
  })

  it("hides an expired note on every surface", () => {
    const expired = note({ expires_at: new Date(Date.now() - 1).toISOString() })
    expect(noteVisibleFor(expired, "profile")).toBe(false)
    expect(noteVisibleFor(expired, "posts")).toBe(false)
    expect(noteVisibleFor(expired, "communities")).toBe(false)
  })

  it("hides nothing when there is no note at all", () => {
    expect(noteVisibleFor(null, "profile")).toBe(false)
  })

  it("labels each surface for the composer", () => {
    expect(surfaceLabel("profile")).toBe("On my profile")
    expect(surfaceLabel("posts")).toBe("On my posts")
    expect(surfaceLabel("communities")).toBe("In communities")
  })
})

describe("privacy", () => {
  const owner = "owner-1"

  it("shows a public profile's note to everyone", () => {
    expect(canViewProfileNote({ visibility: "public", ownerId: owner })).toBe(true)
    expect(canViewProfileNote({ visibility: undefined, ownerId: owner })).toBe(true)
  })

  it("hides a private profile's note from strangers", () => {
    expect(canViewProfileNote({ visibility: "private", ownerId: owner, viewerId: "visitor" })).toBe(false)
    expect(canViewProfileNote({ visibility: "private", ownerId: owner, viewerId: null })).toBe(false)
  })

  it("hides a followers-only note from non-followers, but not from followers or the owner", () => {
    expect(canViewProfileNote({ visibility: "followers", ownerId: owner, viewerId: "stranger" })).toBe(false)
    expect(
      canViewProfileNote({ visibility: "followers", ownerId: owner, viewerId: "fan", isFollower: true }),
    ).toBe(true)
    expect(canViewProfileNote({ visibility: "followers", ownerId: owner, viewerId: owner })).toBe(true)
  })
})

describe("themes", () => {
  it("starts new notes on a theme that exists", () => {
    expect(isNoteTheme(DEFAULT_NOTE_THEME)).toBe(true)
  })

  it("styles every theme it offers, with nothing left blank", () => {
    for (const theme of NOTE_THEMES) {
      const style = NOTE_THEME_STYLES[theme]
      expect(style, `missing styles for ${theme}`).toBeTruthy()
      for (const value of Object.values(style)) expect(String(value).trim()).not.toBe("")
    }
  })

  it("gives every theme a colour nobody else has", () => {
    const swatches = NOTE_THEMES.map((theme) => NOTE_THEME_STYLES[theme].swatch)
    expect(new Set(swatches).size).toBe(NOTE_THEMES.length)
  })

  it("falls back to the default for rows written before themes existed", () => {
    expect(noteThemeFromRow("violet")).toBe("violet")
    for (const junk of [null, undefined, "", "chartreuse", 42, {}, [], true]) {
      expect(noteThemeFromRow(junk)).toBe(DEFAULT_NOTE_THEME)
    }
  })

  it("paints unknown themes in the default palette rather than nothing", () => {
    expect(noteThemeStyle("chartreuse")).toEqual(NOTE_THEME_STYLES[DEFAULT_NOTE_THEME])
    expect(noteThemeStyle(undefined)).toEqual(NOTE_THEME_STYLES[DEFAULT_NOTE_THEME])
    expect(noteThemeStyle("amber")).toEqual(NOTE_THEME_STYLES.amber)
  })

  it("rejects themes outside the list", () => {
    expect(isNoteTheme("indigo")).toBe(true)
    expect(isNoteTheme("INDIGO")).toBe(false)
    expect(isNoteTheme("chartreuse")).toBe(false)
    expect(isNoteTheme(null)).toBe(false)
  })

  /**
   * The picker and the database CHECK have to agree: a colour the UI offers but
   * the constraint refuses would fail the save, and a colour the constraint
   * allows but the UI never shows would be dead weight.
   */
  it("keeps the migration's allowlist in step with the picker", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "scripts/profile-note-themes-schema.sql"),
      "utf8",
    )
    const check = /CHECK\s*\(theme IN \(([^)]*)\)\)/.exec(sql)
    expect(check, "migration has no theme allowlist").toBeTruthy()
    const allowed = (check![1].match(/'[^']+'/g) || []).map((value) => value.replace(/'/g, ""))
    expect(allowed).toEqual([...NOTE_THEMES])

    const fallback = /ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT '([a-z]+)'/.exec(sql)
    expect(fallback?.[1]).toBe(DEFAULT_NOTE_THEME)
  })
})
