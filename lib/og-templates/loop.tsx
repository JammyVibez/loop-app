/**
 * Loop (Post) OG Template — premium share card for individual posts.
 *
 * Shows: creator info, post content, engagement stats, post type
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
  TypeBadge,
  StatBadge,
  BottomBar,
  buildOrbs,
  truncate,
} from "../og-tokens"

export interface LoopOgProps {
  title?: string
  description?: string
  username?: string
  avatar?: string
  verified?: boolean
  stat?: string
  statLabel?: string
}

export function LoopOG({
  title,
  description,
  username,
  avatar,
  verified,
  stat,
  statLabel,
}: LoopOgProps): ReactElement {
  const accent = ACCENTS.violet
  const heading = truncate(title || "Loop Post", 100)
  const desc = truncate(description || "", 240)
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

        {username && (
          <>
            <div style={{ height: 14 }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 600, color: TEXT.offWhite }}>
                @{username}
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
          </>
        )}

        <div style={{ height: 28 }} />

        {/* Post title / content */}
        <div
          style={{
            display: "flex",
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: TEXT.white,
            maxWidth: 560,
          }}
        >
          {heading}
        </div>

        {desc && (
          <>
            <div style={{ height: 16 }} />
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 400,
                lineHeight: 1.45,
                color: TEXT.light,
                maxWidth: 540,
              }}
            >
              {desc}
            </div>
          </>
        )}

        <div style={{ height: 28 }} />

        {/* Chips */}
        <div style={{ display: "flex", gap: 14 }}>
          <TypeBadge label="Loop Post" accent={accent} />
          {stat && statLabel && <StatBadge stat={stat} label={statLabel} accent={accent} />}
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

      <OrbitalRing accent={accent} />
      <GlossyRing />
      <GlossHighlight />

      <AvatarSphere
        src={avatar}
        left={825}
        top={255}
        size={110}
        verified={verified}
        accent={accent}
      />

      {orbs.map((orb, i) => (
        <Sphere key={`orb-${i}`} orb={orb} />
      ))}

      <BottomBar accent={accent} />
    </div>
  )
}
