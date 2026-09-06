/**
 * Community OG Template — community-specific composition.
 *
 * Shows: community identity, category, member count, activity
 * Inherits community accent color when available.
 */
import type { ReactElement } from "react"
import {
  ACCENTS,
  BG_COMMUNITY,
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
  TypeBadge,
  buildOrbs,
  getAccentForCategory,
  truncate,
} from "../og-tokens"

export interface CommunityOgProps {
  name?: string
  description?: string
  category?: string
  avatar?: string
  banner?: string
  memberCount?: number
  activeCount?: number
  isPrivate?: boolean
  isVerified?: boolean
}

export function CommunityOG({
  name,
  description,
  category,
  avatar,
  memberCount,
  activeCount,
  isPrivate,
  isVerified,
}: CommunityOgProps): ReactElement {
  const accent = category ? getAccentForCategory(category) : ACCENTS.violet
  const heading = truncate(name || "Community", 80)
  const desc = truncate(description || "A community on Loop Social OS", 200)
  const orbs = buildOrbs(accent)

  const categoryLabel = category
    ? category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ")
    : "Community"

  const statsText = [
    memberCount ? `${memberCount.toLocaleString()} members` : null,
    activeCount ? `${activeCount.toLocaleString()} active` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: CANVAS.width,
        height: CANVAS.height,
        overflow: "hidden",
        background: BG_COMMUNITY(accent),
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

        <div style={{ height: 32 }} />

        {/* Community name */}
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: TEXT.white,
            maxWidth: 560,
          }}
        >
          {heading}
        </div>

        <div style={{ height: 16 }} />

        {/* Category + privacy */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <TypeBadge label={categoryLabel} accent={accent} />
          {isPrivate && (
            <div
              style={{
                display: "flex",
                padding: "8px 16px",
                borderRadius: 999,
                background: "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.4)",
                fontSize: 18,
                fontWeight: 600,
                color: "#fcd34d",
              }}
            >
              🔒 Private
            </div>
          )}
          {isVerified && (
            <div
              style={{
                display: "flex",
                padding: "8px 16px",
                borderRadius: 999,
                background: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.4)",
                fontSize: 18,
                fontWeight: 600,
                color: "#93c5fd",
              }}
            >
              ✓ Official
            </div>
          )}
        </div>

        <div style={{ height: 20 }} />

        {/* Description */}
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

        {/* Stats */}
        {statsText && (
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 600,
              color: accent.light,
              gap: 8,
            }}
          >
            {statsText}
          </div>
        )}

        <div style={{ height: 16 }} />

        {/* CTA pills */}
        <div style={{ display: "flex", gap: 14 }}>
          <div
            style={{
              display: "flex",
              padding: "12px 24px",
              borderRadius: 999,
              background: `${accent.base}33`,
              border: `1px solid ${accent.base}66`,
              fontSize: 20,
              fontWeight: 600,
              color: accent.light,
            }}
          >
            Discuss • Create • Collaborate
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
          background: `radial-gradient(circle, ${accent.base}44, ${accent.base}11 52%, transparent 72%)`,
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
        verified={isVerified}
        accent={accent}
      />

      {orbs.map((orb, i) => (
        <Sphere key={`orb-${i}`} orb={orb} />
      ))}

      <BottomBar accent={accent} />
    </div>
  )
}
