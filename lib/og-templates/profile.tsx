/**
 * Profile OG Template — creator-focused composition.
 *
 * Shows: avatar, display name, username, bio, follower count
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

export interface ProfileOgProps {
  displayName?: string
  username?: string
  bio?: string
  avatar?: string
  isVerified?: boolean
  followersCount?: number
  isPremium?: boolean
}

export function ProfileOG({
  displayName,
  username,
  bio,
  avatar,
  isVerified,
  followersCount,
  isPremium,
}: ProfileOgProps): ReactElement {
  const accent = ACCENTS.fuchsia
  const name = truncate(displayName || username || "User", 60)
  const desc = truncate(bio || "On Loop Social OS", 200)
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
              {isVerified && (
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

        <div style={{ height: 34 }} />

        {/* Display name */}
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: TEXT.white,
          }}
        >
          {name}
        </div>

        <div style={{ height: 18 }} />

        {/* Bio */}
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

        {/* Stats row */}
        <div style={{ display: "flex", gap: 14 }}>
          {followersCount !== undefined && followersCount > 0 && (
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
              {followersCount.toLocaleString()} {followersCount === 1 ? "follower" : "followers"}
            </div>
          )}
          {isPremium && (
            <div
              style={{
                display: "flex",
                padding: "11px 20px",
                borderRadius: 999,
                background: "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.4)",
                fontSize: 21,
                fontWeight: 600,
                color: "#fcd34d",
              }}
            >
              ⭐ Pro Creator
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
            Profile
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
