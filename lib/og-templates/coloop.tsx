/**
 * CoLoop OG Template — collaboration-focused composition.
 *
 * Shows: co-loop title, contributor count, collaboration visual
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
  AvatarStack,
  BrandPill,
  TypeBadge,
  BottomBar,
  buildOrbs,
  truncate,
} from "../og-tokens"

export interface CoLoopOgProps {
  title?: string
  description?: string
  username?: string
  avatar?: string
  verified?: boolean
  contributorCount?: number
  contributorAvatars?: string[]
}

export function CoLoopOG({
  title,
  description,
  username,
  avatar,
  verified,
  contributorCount,
  contributorAvatars,
}: CoLoopOgProps): ReactElement {
  const accent = ACCENTS.cyan
  const heading = truncate(title || "Co-Loop", 100)
  const desc = truncate(description || "Collaboratively created on Loop", 200)
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
        <TypeBadge label="🤝 Co-Loop" accent={accent} />

        <div style={{ height: 34 }} />

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: 60,
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

        <div style={{ height: 24 }} />

        {/* Contributors */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {contributorAvatars && contributorAvatars.length > 0 && (
            <AvatarStack avatars={contributorAvatars} left={0} top={0} size={36} gap={8} />
          )}
          <div style={{ fontSize: 22, fontWeight: 600, color: accent.light }}>
            {contributorCount || 0} contributor{(contributorCount || 0) !== 1 ? "s" : ""}
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "flex", gap: 14 }}>
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
            Collaboratively created on Loop
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

      <AvatarSphere src={avatar} left={825} top={255} size={110} verified={verified} accent={accent} />

      {orbs.map((orb, i) => (
        <Sphere key={`orb-${i}`} orb={orb} />
      ))}

      <BottomBar accent={accent} />
    </div>
  )
}
