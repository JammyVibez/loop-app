/**
 * Reel OG Template — media-first composition.
 *
 * Shows: thumbnail background, creator, caption, LOOP REELS badge
 */
import type { ReactElement } from "react"
import {
  ACCENTS,
  TEXT,
  PADDING,
  CANVAS,
  Starfield,
  AmbientGlows,
  BottomBar,
  buildOrbs,
  Sphere,
  truncate,
} from "../og-tokens"

export interface ReelOgProps {
  title?: string
  description?: string
  username?: string
  avatar?: string
  verified?: boolean
  mediaUrl?: string
}

export function ReelOG({
  title,
  description,
  username,
  mediaUrl,
}: ReelOgProps): ReactElement {
  const accent = ACCENTS.rose
  const heading = truncate(title || "Loop Reel", 80)
  const desc = truncate(description || "", 160)
  const orbs = buildOrbs(accent)

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: CANVAS.width,
        height: CANVAS.height,
        overflow: "hidden",
        background: mediaUrl
          ? `linear-gradient(160deg, rgba(10,8,25,0.85), rgba(10,8,25,0.7) 50%, rgba(10,8,25,0.9) 100%), url(${mediaUrl})`
          : "linear-gradient(160deg, #0a0819 0%, #1c1248 50%, #0c0a24 100%)",
        backgroundSize: "cover",
        backgroundPosition: "center",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "11px 20px",
            borderRadius: 999,
            background: `${accent.base}22`,
            border: `1px solid ${accent.base}66`,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "0.24em",
            color: accent.light,
          }}
        >
          🔴 LOOP REELS
        </div>

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
            </div>
          </>
        )}

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
      </div>

      {/* Right: media thumbnail overlay visual */}
      {!mediaUrl && (
        <>
          <div
            style={{
              position: "absolute",
              right: 80,
              top: "50%",
              marginTop: -120,
              width: 240,
              height: 240,
              borderRadius: 24,
              background: `linear-gradient(135deg, ${accent.dark}88, ${accent.base}44)`,
              border: `3px solid ${accent.base}55`,
              boxShadow: `0 0 60px ${accent.glow}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 72,
            }}
          >
            ▶
          </div>
        </>
      )}

      {orbs.map((orb, i) => (
        <Sphere key={`orb-${i}`} orb={orb} />
      ))}

      <BottomBar accent={accent} />
    </div>
  )
}
