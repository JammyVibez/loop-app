/**
 * Note colour themes: the actual class strings.
 *
 * Deliberately a component-layer module. Tailwind only scans `app/`,
 * `components/` and the root config files (see tailwind.config.ts#content), so
 * a class written in `lib/` is purged before it ever reaches the stylesheet —
 * the bubble would lose its colour while the code looked correct. The
 * allowlist itself stays in lib/profile-note.ts, where the API, the picker and
 * the database CHECK all read it.
 *
 * Every class is written out in full: Tailwind ships what it can see, so
 * `border-${theme}-400/35` would compile to nothing.
 */

import { noteThemeFromRow, type NoteTheme } from "@/lib/profile-note"

export interface NoteThemeStyle {
  /** Name shown on the swatch in the composer. */
  label: string
  /** The picker dot — a solid colour so the choice is obvious at a glance. */
  swatch: string
  /** Card chip: border, wash and glow for the one-line bubble. */
  chip: string
  /** Profile bubble: border, gradient and glow for the larger bubble. */
  profile: string
  /** Tint shared by both bubbles' glyph. */
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

/** Never-fashionable lookup: an unknown theme renders as the default palette. */
export function noteThemeStyle(theme: unknown): NoteThemeStyle {
  return NOTE_THEME_STYLES[noteThemeFromRow(theme)]
}
