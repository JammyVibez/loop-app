import type { ReactElement } from "react"

/**
 * Shared Open Graph image design for Loop.
 *
 * Rendered server-side via `next/og` ImageResponse (satori) at:
 *   /api/og?type=...&title=...&description=...&username=...&avatar=...&stat=...&stat_label=...
 *
 * Style rules stay within satori's supported CSS subset:
 * flexbox, absolute positioning, gradients, borders, border-radius,
 * box-shadow and transforms — no filters / backdrop blur / clip paths.
 */

export interface OgImageProps {
  title?: string
  description?: string
  type?: string
  username?: string
  avatar?: string
  verified?: boolean
  stat?: string
  statLabel?: string
}

interface FontSpec {
  name: string
  data: ArrayBuffer
  weight: 400 | 600 | 800
  style: "normal"
}

const FONT_URLS: Array<{ weight: 400 | 600 | 800; url: string }> = [
  {
    weight: 400,
    url: "https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-Regular.woff",
  },
  {
    weight: 600,
    url: "https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-SemiBold.woff",
  },
  {
    weight: 800,
    url: "https://cdn.jsdelivr.net/npm/inter-ui@3.19.3/Inter%20(web)/Inter-Bold.woff",
  },
]

let fontsCache: Promise<FontSpec[]> | null = null

/**
 * Loads Inter (regular / semibold / bold) once per process and caches it.
 * Falls back to satori's built-in font on any failure so the image never
 * breaks because the CDN was unreachable.
 */
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
        // Ignore — satori's default font will be used instead.
      }
      return fonts
    })()
  }
  return fontsCache
}

const DEFAULT_TITLE = "Loop — Build Together, Not Just Post Into The Void"
const DEFAULT_DESCRIPTION =
  "The collaborative social network: co-write posts live with friends, settle debates in Duels, build communities in Circles, and earn rewards for being active. Free to join."

// ── Per-type theming ────────────────────────────────────────────────────────

interface Accent {
  base: string
  light: string
  dark: string
  glow: string
}

const ACCENTS: Record<string, Accent> = {
  cyan: { base: "#22d3ee", light: "#a5f3fc", dark: "#0e7490", glow: "rgba(34,211,238,0.45)" },
  violet: { base: "#8b5cf6", light: "#c4b5fd", dark: "#6d28d9", glow: "rgba(139,92,246,0.45)" },
  fuchsia: { base: "#d946ef", light: "#f0abfc", dark: "#a21caf", glow: "rgba(217,70,239,0.45)" },
  amber: { base: "#f59e0b", light: "#fcd34d", dark: "#b45309", glow: "rgba(245,158,11,0.45)" },
  emerald: { base: "#34d399", light: "#a7f3d0", dark: "#047857", glow: "rgba(52,211,153,0.45)" },
  rose: { base: "#fb7185", light: "#fecdd3", dark: "#be123c", glow: "rgba(251,113,133,0.45)" },
}

interface TypeMeta {
  label?: string
  accent: Accent
}

const TYPE_META: Record<string, TypeMeta> = {
  home: { label: undefined, accent: ACCENTS.cyan },
  loop: { label: "Loop Post", accent: ACCENTS.violet },
  developer: { label: "Dev Project", accent: ACCENTS.emerald },
  profile: { label: "Profile", accent: ACCENTS.fuchsia },
  circle: { label: "Circle", accent: ACCENTS.amber },
  reel: { label: "Reel", accent: ACCENTS.rose },
  live: { label: "Live", accent: ACCENTS.rose },
}

// ── Decorative data ─────────────────────────────────────────────────────────

interface Star {
  left: number
  top: number
  size: number
  opacity: number
  color: string
}

const STARS: Star[] = [
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

interface Orb {
  left: number
  top: number
  size: number
  body: string
  glow: string
}

const ORB_INDIGO =
  "radial-gradient(circle at 32% 28%, #ffffff 0%, #ddd6fe 18%, #8b5cf6 48%, #4c1d95 78%, #2e1065 100%)"
const ORB_CYAN =
  "radial-gradient(circle at 32% 28%, #ffffff 0%, #cffafe 18%, #22d3ee 48%, #0e7490 78%, #164e63 100%)"
const ORB_FUCHSIA =
  "radial-gradient(circle at 32% 28%, #ffffff 0%, #fae8ff 18%, #d946ef 48%, #86198f 78%, #701a75 100%)"
const ORB_ICE =
  "radial-gradient(circle at 32% 28%, #ffffff 0%, #e0f2fe 20%, #7dd3fc 50%, #0369a1 80%, #0c4a6e 100%)"

function accentOrb(accent: Accent): string {
  return `radial-gradient(circle at 32% 28%, #ffffff 0%, ${accent.light} 20%, ${accent.base} 55%, ${accent.dark} 85%, #111827 100%)`
}

function buildOrbs(accent: Accent): Orb[] {
  return [
    { left: 1006, top: 308, size: 58, body: ORB_INDIGO, glow: "0 0 38px rgba(139,92,246,0.6)" },
    { left: 916, top: 444, size: 44, body: ORB_CYAN, glow: "0 0 30px rgba(34,211,238,0.55)" },
    { left: 756, top: 420, size: 50, body: ORB_FUCHSIA, glow: "0 0 32px rgba(217,70,239,0.55)" },
    { left: 712, top: 254, size: 42, body: ORB_ICE, glow: "0 0 26px rgba(125,211,252,0.5)" },
    { left: 806, top: 138, size: 54, body: accentOrb(accent), glow: accent.glow },
    { left: 972, top: 172, size: 38, body: ORB_CYAN, glow: "0 0 26px rgba(34,211,238,0.5)" },
  ]
}

const HOME_CHIPS = ["Co-Loop", "Circles", "Duels", "Live Streams"]

// ── Design ──────────────────────────────────────────────────────────────────

function Sphere({ orb }: { orb: Orb }): ReactElement {
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
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95), rgba(255,255,255,0) 72%)",
        }}
      />
    </div>
  )
}

export function OgImage({
  title,
  description,
  type = "home",
  username,
  avatar,
  verified,
  stat,
  statLabel,
}: OgImageProps): ReactElement {
  const meta = TYPE_META[type] || TYPE_META.home
  const accent = meta.accent
  const heading = (title || DEFAULT_TITLE).slice(0, 120)
  const desc = (description || DEFAULT_DESCRIPTION).slice(0, 260)
  const orbs = buildOrbs(accent)
  const safeAvatar =
    avatar && (avatar.startsWith("http://") || avatar.startsWith("https://")) ? avatar : undefined

  const chips: Array<{ text: string; accent?: boolean }> = meta.label
    ? [
        { text: meta.label },
        ...(stat && statLabel ? [{ text: `${stat} ${statLabel}`, accent: true }] : []),
      ]
    : HOME_CHIPS.map((text) => ({ text }))

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: 1200,
        height: 630,
        overflow: "hidden",
        background:
          "linear-gradient(160deg, #0a0819 0%, #141033 38%, #1c1248 64%, #0c0a24 100%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Ambient glows */}
      <div
        style={{
          position: "absolute",
          left: -160,
          top: -180,
          width: 480,
          height: 480,
          borderRadius: 999,
          background:
            "radial-gradient(circle, rgba(124,58,237,0.30), rgba(124,58,237,0.10) 46%, transparent 70%)",
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
          background: `radial-gradient(circle, ${accent.glow.replace(
            "0.45",
            "0.20"
          )}, ${accent.glow.replace("0.45", "0.06")} 46%, transparent 70%)`,
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
          background:
            "radial-gradient(circle, rgba(217,70,239,0.12), transparent 68%)",
        }}
      />

      {/* Stars */}
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

      {/* ── Left column ── */}
      <div
        style={{
          position: "absolute",
          left: 64,
          top: 58,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          width: 590,
        }}
      >
        {/* Brand pill */}
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
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "0.24em",
              color: "rgba(255,255,255,0.88)",
            }}
          >
            LOOPAPP.ME
          </div>
        </div>

        {username ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginTop: 14,
              padding: "8px 18px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                {`@${username}`}
              </div>
            {verified && (
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "#3b82f6",
                  boxShadow: "0 0 12px rgba(59,130,246,0.9)",
                }}
              />
            )}
          </div>
        ) : null}

        <div style={{ height: 34 }} />

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            fontSize: 116,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            color: "#ffffff",
          }}
        >
          Loop
        </div>

        <div style={{ height: 20 }} />

        {/* Headline */}
        <div
          style={{
            display: "flex",
            fontSize: 40,
            fontWeight: 600,
            lineHeight: 1.25,
            color: "#e9d5ff",
          }}
        >
          {heading}
        </div>

        <div style={{ height: 18 }} />

        {/* Description */}
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.72)",
            maxWidth: 560,
          }}
        >
          {desc}
        </div>

        <div style={{ height: 34 }} />

        {/* Chips */}
        <div style={{ display: "flex", gap: 14 }}>
          {chips.map((chip) => (
            <div
              key={chip.text}
              style={{
                display: "flex",
                padding: "11px 20px",
                borderRadius: 999,
                background: chip.accent
                  ? `${accent.base}22`
                  : "rgba(255,255,255,0.08)",
                border: chip.accent
                  ? `1px solid ${accent.base}66`
                  : "1px solid rgba(255,255,255,0.18)",
                fontSize: 21,
                fontWeight: 600,
                color: chip.accent ? accent.light : "rgba(255,255,255,0.92)",
              }}
            >
              {chip.text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Orbital loop (3D ring) ── */}
      <div
        style={{
          position: "absolute",
          left: 690,
          top: 112,
          width: 396,
          height: 396,
          borderRadius: 999,
          background:
            "radial-gradient(circle, rgba(139,92,246,0.30), rgba(139,92,246,0.08) 52%, transparent 72%)",
        }}
      />

      {/* Back ring (accent-tinted) */}
      <div
        style={{
          position: "absolute",
          left: 745,
          top: 168,
          width: 284,
          height: 284,
          borderRadius: 999,
          border: `26px solid ${accent.base}55`,
          borderTopColor: `${accent.light}cc`,
          borderBottomColor: `${accent.dark}55`,
          transform: "rotate(-24deg)",
          boxShadow: `0 0 54px ${accent.glow}`,
        }}
      />

      {/* Front ring (indigo) — glossy 3D bevel via per-side borders */}
      <div
        style={{
          position: "absolute",
          left: 715,
          top: 148,
          width: 330,
          height: 330,
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

      {/* Gloss reflection on the front ring */}
      <div
        style={{
          position: "absolute",
          left: 782,
          top: 140,
          width: 64,
          height: 64,
          borderRadius: 999,
          background:
            "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.85), rgba(255,255,255,0) 70%)",
        }}
      />

      {/* Avatar sphere in the ring center */}
      {safeAvatar ? (
        <div
          style={{
            position: "absolute",
            display: "flex",
            left: 825,
            top: 255,
            width: 110,
            height: 110,
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
              backgroundImage: `url(${safeAvatar})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: "5px solid rgba(255,255,255,0.9)",
              boxShadow: `0 0 40px ${accent.glow}, inset 0 0 24px rgba(0,0,0,0.25)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 26,
              top: 18,
              width: 40,
              height: 40,
              borderRadius: 999,
              background:
                "radial-gradient(circle, rgba(255,255,255,0.75), rgba(255,255,255,0) 70%)",
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
      ) : null}

      {/* Orbiting spheres */}
      {orbs.map((orb, i) => (
        <Sphere key={`orb-${i}`} orb={orb} />
      ))}

      {/* ── Bottom bar ── */}
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 400,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.04em",
          }}
        >
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
            color: "rgba(255,255,255,0.9)",
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
    </div>
  )
}