/**
 * OG Design Tokens — shared across all OG templates.
 *
 * Satori CSS subset only: flexbox, absolute positioning, gradients,
 * borders, border-radius, box-shadow, transforms, opacity.
 * No filters / backdrop-blur / clip-path.
 */

// ── Color System ────────────────────────────────────────────────────────────

export interface AccentColor {
  base: string
  light: string
  dark: string
  glow: string
}

export const ACCENTS: Record<string, AccentColor> = {
  indigo: { base: "#6366f1", light: "#a5b4fc", dark: "#4338ca", glow: "rgba(99,102,241,0.45)" },
  violet: { base: "#8b5cf6", light: "#c4b5fd", dark: "#6d28d9", glow: "rgba(139,92,246,0.45)" },
  cyan: { base: "#22d3ee", light: "#a5f3fc", dark: "#0e7490", glow: "rgba(34,211,238,0.45)" },
  fuchsia: { base: "#d946ef", light: "#f0abfc", dark: "#a21caf", glow: "rgba(217,70,239,0.45)" },
  amber: { base: "#f59e0b", light: "#fcd34d", dark: "#b45309", glow: "rgba(245,158,11,0.45)" },
  emerald: { base: "#34d399", light: "#a7f3d0", dark: "#047857", glow: "rgba(52,211,153,0.45)" },
  rose: { base: "#fb7185", light: "#fecdd3", dark: "#be123c", glow: "rgba(251,113,133,0.45)" },
  sky: { base: "#38bdf8", light: "#bae6fd", dark: "#0369a1", glow: "rgba(56,189,248,0.45)" },
  red: { base: "#ef4444", light: "#fca5a5", dark: "#b91c1c", glow: "rgba(239,68,68,0.45)" },
}

// ── Background ──────────────────────────────────────────────────────────────

export const BG_DARK = "linear-gradient(160deg, #0a0819 0%, #141033 38%, #1c1248 64%, #0c0a24 100%)"
export const BG_HOME = "linear-gradient(160deg, #0a0819 0%, #141033 38%, #1c1248 64%, #0c0a24 100%)"
export const BG_COMMUNITY = (accent: AccentColor) =>
  `linear-gradient(160deg, #0a0819 0%, #141033 30%, ${accent.dark}44 70%, #0c0a24 100%)`

// ── Text Colors ─────────────────────────────────────────────────────────────

export const TEXT = {
  white: "#ffffff",
  offWhite: "rgba(255,255,255,0.92)",
  light: "rgba(255,255,255,0.72)",
  muted: "rgba(255,255,255,0.45)",
  accent: "#e9d5ff",
}

// ── Layout Constants ────────────────────────────────────────────────────────

export const CANVAS = { width: 1200, height: 630 }
export const PADDING = 64

// ── Decorative Stars ────────────────────────────────────────────────────────

export interface Star {
  left: number
  top: number
  size: number
  opacity: number
  color: string
}

export const STARS: Star[] = [
  { left: 52, top: 44, size: 4, opacity: 0.7, color: "#ffffff" },
  { left: 128, top: 118, size: 3, opacity: 0.45, color: "#c4b5fd" },
  { left: 210, top: 62, size: 3, opacity: 0.55, color: "#ffffff" },
  { left: 292, top: 132, size: 4, opacity: 0.4, color: "#67e8f9" },
  { left: 348, top: 36, size: 3, opacity: 0.6, color: "#ffffff" },
  { left: 470, top: 96, size: 3, opacity: 0.5, color: "#c4b5fd" },
  { left: 556, top: 42, size: 4, opacity: 0.65, color: "#ffffff" },
  { left: 640, top: 120, size: 3, opacity: 0.4, color: "#f0abfc" },
  { left: 118, top: 560, size: 3, opacity: 0.5, color: "#ffffff" },
  { left: 268, top: 596, size: 4, opacity: 0.4, color: "#67e8f9" },
  { left: 412, top: 560, size: 3, opacity: 0.55, color: "#ffffff" },
  { left: 566, top: 596, size: 3, opacity: 0.45, color: "#c4b5fd" },
  { left: 668, top: 548, size: 4, opacity: 0.5, color: "#ffffff" },
  { left: 1156, top: 68, size: 3, opacity: 0.5, color: "#ffffff" },
  { left: 1092, top: 30, size: 4, opacity: 0.6, color: "#67e8f9" },
  { left: 1012, top: 76, size: 3, opacity: 0.4, color: "#c4b5fd" },
  { left: 1150, top: 132, size: 3, opacity: 0.55, color: "#ffffff" },
]

// ── Orbital Orbs ────────────────────────────────────────────────────────────

const ORB_INDIGO = "radial-gradient(circle at 32% 28%, #ffffff 0%, #ddd6fe 18%, #8b5cf6 48%, #4c1d95 78%, #2e1065 100%)"
const ORB_CYAN = "radial-gradient(circle at 32% 28%, #ffffff 0%, #cffafe 18%, #22d3ee 48%, #0e7490 78%, #164e63 100%)"
const ORB_FUCHSIA = "radial-gradient(circle at 32% 28%, #ffffff 0%, #fae8ff 18%, #d946ef 48%, #86198f 78%, #701a75 100%)"
const ORB_ICE = "radial-gradient(circle at 32% 28%, #ffffff 0%, #e0f2fe 20%, #7dd3fc 50%, #0369a1 80%, #0c4a6e 100%)"

export interface Orb {
  left: number
  top: number
  size: number
  body: string
  glow: string
}

export function buildOrbs(accent: AccentColor): Orb[] {
  const accentOrb = `radial-gradient(circle at 32% 28%, #ffffff 0%, ${accent.light} 20%, ${accent.base} 55%, ${accent.dark} 85%, #111827 100%)`
  return [
    { left: 1006, top: 308, size: 58, body: ORB_INDIGO, glow: "0 0 38px rgba(139,92,246,0.6)" },
    { left: 916, top: 444, size: 44, body: ORB_CYAN, glow: "0 0 30px rgba(34,211,238,0.55)" },
    { left: 756, top: 420, size: 50, body: ORB_FUCHSIA, glow: "0 0 32px rgba(217,70,239,0.55)" },
    { left: 712, top: 254, size: 42, body: ORB_ICE, glow: "0 0 26px rgba(125,211,252,0.5)" },
    { left: 806, top: 138, size: 54, body: accentOrb, glow: accent.glow },
    { left: 972, top: 172, size: 38, body: ORB_CYAN, glow: "0 0 26px rgba(34,211,238,0.5)" },
  ]
}

// ── Category → Accent Mapping ───────────────────────────────────────────────

export const CATEGORY_ACCENTS: Record<string, AccentColor> = {
  anime: ACCENTS.fuchsia,
  gaming: ACCENTS.emerald,
  technology: ACCENTS.cyan,
  developers: ACCENTS.cyan,
  education: ACCENTS.indigo,
  art: ACCENTS.violet,
  music: ACCENTS.fuchsia,
  sports: ACCENTS.emerald,
  movies: ACCENTS.rose,
  books: ACCENTS.amber,
  memes: ACCENTS.amber,
  creators: ACCENTS.violet,
  lifestyle: ACCENTS.fuchsia,
  local: ACCENTS.sky,
  professional: ACCENTS.indigo,
  general: ACCENTS.indigo,
  custom: ACCENTS.indigo,
}

export function getAccentForCategory(category?: string): AccentColor {
  if (!category) return ACCENTS.indigo
  return CATEGORY_ACCENTS[category.toLowerCase()] || ACCENTS.indigo
}

// ── Font Loading ────────────────────────────────────────────────────────────

import type { ReactElement } from "react"

interface FontSpec {
  name: string
  data: ArrayBuffer
  weight: 400 | 600 | 800
  style: "normal"
}

const FONT_URLS: Array<{ weight: 400 | 600 | 800; url: string }> = [
  { weight: 400, url: "https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-Regular.woff" },
  { weight: 600, url: "https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-SemiBold.woff" },
  { weight: 800, url: "https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-Bold.woff" },
]

let fontsCache: Promise<FontSpec[]> | null = null

export function loadOgFonts(): Promise<FontSpec[]> {
  if (!fontsCache) {
    fontsCache = (async () => {
      const fonts: FontSpec[] = []
      try {
        for (const f of FONT_URLS) {
          const res = await fetch(f.url, { signal: AbortSignal.timeout(5000) })
          if (!res.ok) continue
          const data = await res.arrayBuffer()
          fonts.push({ name: "Inter", data, weight: f.weight, style: "normal" })
        }
      } catch {
        // satori's default font fallback
      }
      return fonts
    })()
  }
  return fontsCache
}

// ── Shared Primitives ───────────────────────────────────────────────────────

/** Starfield background layer */
export function Starfield(): ReactElement {
  return (
    <>
      {STARS.map((s, i) => (
        <div
          key={`star-${i}`}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: 999,
            background: s.color,
            opacity: s.opacity,
          }}
        />
      ))}
    </>
  )
}

/** Ambient glow blobs */
export function AmbientGlows({ accent }: { accent: AccentColor }): ReactElement {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: -160,
          top: -180,
          width: 480,
          height: 480,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(124,58,237,0.30), rgba(124,58,237,0.10) 46%, transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -200,
          bottom: -220,
          width: 560,
          height: 560,
          borderRadius: 999,
          background: `radial-gradient(circle, ${accent.glow.replace("0.45", "0.20")}, ${accent.glow.replace("0.45", "0.06")} 46%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 300,
          bottom: -160,
          width: 420,
          height: 420,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(217,70,239,0.12), transparent 68%)",
        }}
      />
    </>
  )
}

/** Orbital ring (back) */
export function OrbitalRing({ accent, top = 168, size = 284 }: { accent: AccentColor; top?: number; size?: number }): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        left: 745,
        top,
        width: size,
        height: size,
        borderRadius: 999,
        border: `26px solid ${accent.base}55`,
        borderTopColor: `${accent.light}cc`,
        borderBottomColor: `${accent.dark}55`,
        transform: "rotate(-24deg)",
        boxShadow: `0 0 54px ${accent.glow}`,
      }}
    />
  )
}

/** Front glossy ring */
export function GlossyRing({ top = 148, size = 330 }: { top?: number; size?: number }): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        left: 715,
        top,
        width: size,
        height: size,
        borderRadius: 999,
        border: "34px solid #6d28d9",
        borderTopColor: "#c4b5fd",
        borderLeftColor: "#8b5cf6",
        borderRightColor: "#5b21b6",
        borderBottomColor: "#3b0764",
        transform: "rotate(18deg)",
        boxShadow: "0 0 72px rgba(124,58,237,0.45), inset 0 0 40px rgba(0,0,0,0.35)",
      }}
    />
  )
}

/** Gloss highlight */
export function GlossHighlight(): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        left: 782,
        top: 140,
        width: 64,
        height: 64,
        borderRadius: 999,
        background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.85), rgba(255,255,255,0) 70%)",
      }}
    />
  )
}

/** Accent sphere */
export function Sphere({ orb }: { orb: Orb }): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        left: orb.left,
        top: orb.top,
        width: orb.size,
        height: orb.size,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: 999,
          background: orb.body,
          boxShadow: orb.glow,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: orb.size * 0.16,
          top: orb.size * 0.12,
          width: orb.size * 0.36,
          height: orb.size * 0.36,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(255,255,255,0.95), rgba(255,255,255,0) 72%)",
        }}
      />
    </div>
  )
}

/** Avatar sphere with optional verified badge */
export function AvatarSphere({
  src,
  left,
  top,
  size = 110,
  verified,
  accent,
}: {
  src?: string
  left: number
  top: number
  size?: number
  verified?: boolean
  accent: AccentColor
}): ReactElement | null {
  if (!src) return null
  return (
    <div style={{ position: "absolute", display: "flex", left, top, width: size, height: size }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: 999,
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          border: "5px solid rgba(255,255,255,0.9)",
          boxShadow: `0 0 40px ${accent.glow}, inset 0 0 24px rgba(0,0,0,0.25)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: size * 0.23,
          top: size * 0.16,
          width: size * 0.36,
          height: size * 0.36,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(255,255,255,0.75), rgba(255,255,255,0) 70%)",
        }}
      />
      {verified && (
        <div
          style={{
            position: "absolute",
            right: -4,
            bottom: -4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "#3b82f6",
            border: "4px solid #ffffff",
            boxShadow: "0 4px 16px rgba(59,130,246,0.7)",
          }}
        >
          <div
            style={{
              width: 14,
              height: 7,
              marginTop: -2,
              borderLeft: "3px solid #ffffff",
              borderBottom: "3px solid #ffffff",
              transform: "rotate(-45deg)",
            }}
          />
        </div>
      )}
    </div>
  )
}

/** Brand pill at top-left */
export function BrandPill({ accent }: { accent: AccentColor }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 20px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.14)",
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: accent.base,
          boxShadow: `0 0 14px ${accent.glow}`,
        }}
      />
      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.24em", color: TEXT.offWhite }}>
        LOOPAPP.ME
      </div>
    </div>
  )
}

/** Type badge pill */
export function TypeBadge({ label, accent }: { label: string; accent: AccentColor }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        padding: "8px 18px",
        borderRadius: 999,
        background: `${accent.base}22`,
        border: `1px solid ${accent.base}66`,
        fontSize: 18,
        fontWeight: 600,
        color: accent.light,
      }}
    >
      {label}
    </div>
  )
}

/** Stat badge pill */
export function StatBadge({ stat, label, accent }: { stat: string; label: string; accent: AccentColor }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        padding: "8px 18px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.18)",
        fontSize: 18,
        fontWeight: 600,
        color: TEXT.offWhite,
      }}
    >
      {stat} {label}
    </div>
  )
}

/** Bottom bar with brand */
export function BottomBar({ accent }: { accent: AccentColor }): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        left: PADDING,
        right: PADDING,
        bottom: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 400, color: TEXT.muted, letterSpacing: "0.04em" }}>
        THE COLLABORATIVE SOCIAL NETWORK
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 20px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.16)",
          fontSize: 19,
          fontWeight: 600,
          color: TEXT.offWhite,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: accent.base,
            boxShadow: `0 0 12px ${accent.glow}`,
          }}
        />
        loopapp.me
      </div>
    </div>
  )
}

/** Avatar stack for showing multiple people */
export function AvatarStack({
  avatars,
  left,
  top,
  size = 36,
  gap = 8,
}: {
  avatars: string[]
  left: number
  top: number
  size?: number
  gap?: number
}): ReactElement {
  return (
    <div style={{ position: "absolute", left, top, display: "flex", alignItems: "center" }}>
      {avatars.slice(0, 5).map((src, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            backgroundImage: src ? `url(${src})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: "3px solid #141033",
            marginLeft: i > 0 ? -gap / 2 : 0,
            background: src ? undefined : "linear-gradient(135deg, #6366f1, #8b5cf6)",
          }}
        />
      ))}
    </div>
  )
}

/** Text truncation helper */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1).trimEnd() + "…"
}
