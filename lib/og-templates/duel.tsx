/**
 * Duel OG Template — debate/voting-focused card.
 *
 * Shows: topic, participants, vote count, competition visual
 */
import type { ReactElement } from "react"
import {
  ACCENTS,
  BG_DARK,
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

export interface DuelOgProps {
  title?: string
  description?: string
  username?: string
  avatar?: string
  verified?: boolean
  voteCount?: number
}

export function DuelOG({
  title,
  description,
  voteCount,
}: DuelOgProps): ReactElement {
  const accent = ACCENTS.rose
  const heading = truncate(title || "Community Duel", 100)
  const desc = truncate(description || "Which side are you on?", 200)
  const orbs = buildOrbs(accent)

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: CANVAS.width,
        height: CANVAS.height,
        overflow: "hidden",
        background: BG_DARK,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <AmbientGlows accent={accent} />
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
          width: 580,
        }}
      >
        <BrandPill accent={accent} />

        <div style={{ height: 14 }} />
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
          ⚔️ Community Duel
        </div>

        <div style={{ height: 34 }} />

        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: TEXT.white,
            maxWidth: 560,
          }}
        >
          {heading}
        </div>

        <div style={{ height: 16 }} />

        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 400,
            lineHeight: 1.45,
            color: TEXT.light,
            maxWidth: 540,
          }}
        >
          {desc}
        </div>

        <div style={{ height: 28 }} />

        <div style={{ display: "flex", gap: 14 }}>
          {voteCount !== undefined && voteCount > 0 && (
            <div
              style={{
                display: "flex",
                padding: "11px 20px",
                borderRadius: 999,
                background: `${accent.base}22`,
                border: `1px solid ${accent.base}66`,
                fontSize: 21,
                fontWeight: 600,
                color: accent.light,
              }}
            >
              {voteCount.toLocaleString()} votes
            </div>
          )}
          <div
            style={{
              display: "flex",
              padding: "11px 20px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.18)",
              fontSize: 21,
              fontWeight: 600,
              color: TEXT.offWhite,
            }}
          >
            Take a side
          </div>
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
          background: `radial-gradient(circle, ${accent.base}33, ${accent.base}08 52%, transparent 72%)`,
        }}
      />

      <OrbitalRing accent={accent} />
      <GlossyRing />
      <GlossHighlight />

      {orbs.map((orb, i) => (
        <Sphere key={`orb-${i}`} orb={orb} />
      ))}

      <BottomBar accent={accent} />
    </div>
  )
}
