/**
 * Homepage OG Template — the primary brand composition.
 *
 * Left: LOOP wordmark + tagline + feature pills
 * Right: Orbital loop + avatar sphere
 */
import type { ReactElement } from "react"
import {
  ACCENTS,
  BG_HOME,
  TEXT,
  PADDING,
  CANVAS,
  Starfield,
  AmbientGlows,
  OrbitalRing,
  GlossyRing,
  GlossHighlight,
  Sphere,
  AvatarSphere,
  BrandPill,
  BottomBar,
  buildOrbs,
  truncate,
} from "../og-tokens"

const HOME_CHIPS = ["Co-Loop", "Circles", "Duels", "Live Streams"]

export interface HomepageOgProps {
  title?: string
  description?: string
  avatar?: string
  verified?: boolean
  stat?: string
  statLabel?: string
}

const DEFAULT_TITLE = "Loop — Build Together, Not Just Post Into The Void"
const DEFAULT_DESC = "The collaborative social network: co-write posts live with friends, settle debates in Duels, build communities in Circles, and earn rewards for being active."
const ACCENT = ACCENTS.indigo

export function HomepageOG({
  title,
  description,
  avatar,
  verified,
  stat,
  statLabel,
}: HomepageOgProps): ReactElement {
  const heading = truncate(title || DEFAULT_TITLE, 120)
  const desc = truncate(description || DEFAULT_DESC, 260)
  const orbs = buildOrbs(ACCENT)

  const chips: Array<{ text: string; accent?: boolean }> = [
    ...HOME_CHIPS.map((text) => ({ text })),
    ...(stat && statLabel ? [{ text: `${stat} ${statLabel}`, accent: true }] : []),
  ]

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: CANVAS.width,
        height: CANVAS.height,
        overflow: "hidden",
        background: BG_HOME,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <AmbientGlows accent={ACCENT} />
      <Starfield />

      {/* ── Left column ── */}
      <div
        style={{
          position: "absolute",
          left: PADDING,
          top: 58,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          width: 590,
        }}
      >
        <BrandPill accent={ACCENT} />

        {/* Username pill */}
        {stat && statLabel && (
          <div style={{ height: 14 }} />
        )}

        <div style={{ height: 34 }} />

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            fontSize: 116,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            color: TEXT.white,
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
            color: TEXT.accent,
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
            color: TEXT.light,
            maxWidth: 560,
          }}
        >
          {desc}
        </div>

        <div style={{ height: 34 }} />

        {/* Feature pills */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {chips.map((chip) => (
            <div
              key={chip.text}
              style={{
                display: "flex",
                padding: "11px 20px",
                borderRadius: 999,
                background: chip.accent ? `${ACCENT.base}22` : "rgba(255,255,255,0.08)",
                border: chip.accent ? `1px solid ${ACCENT.base}66` : "1px solid rgba(255,255,255,0.18)",
                fontSize: 21,
                fontWeight: 600,
                color: chip.accent ? ACCENT.light : TEXT.offWhite,
              }}
            >
              {chip.text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Orbital loop ── */}
      <div
        style={{
          position: "absolute",
          left: 690,
          top: 112,
          width: 396,
          height: 396,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(139,92,246,0.30), rgba(139,92,246,0.08) 52%, transparent 72%)",
        }}
      />

      <OrbitalRing accent={ACCENT} />
      <GlossyRing />
      <GlossHighlight />

      <AvatarSphere
        src={avatar}
        left={825}
        top={255}
        size={110}
        verified={verified}
        accent={ACCENT}
      />

      {orbs.map((orb, i) => (
        <Sphere key={`orb-${i}`} orb={orb} />
      ))}

      <BottomBar accent={ACCENT} />
    </div>
  )
}
