/**
 * Live OG Template — energetic live-room visual.
 *
 * Shows: LIVE badge, room title, viewer count, energetic accent
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
  BottomBar,
  buildOrbs,
  Sphere,
  truncate,
} from "../og-tokens"

export interface LiveOgProps {
  title?: string
  description?: string
  username?: string
  viewerCount?: number
}

export function LiveOG({ title, viewerCount }: LiveOgProps): ReactElement {
  const accent = ACCENTS.red
  const heading = truncate(title || "Live Session", 100)
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

      {/* Pulsing red glow overlay */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          marginLeft: -300,
          marginTop: -300,
          width: 600,
          height: 600,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(239,68,68,0.15), transparent 70%)",
        }}
      />

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
            background: "rgba(239,68,68,0.2)",
            border: "1px solid rgba(239,68,68,0.5)",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.24em",
            color: "#fca5a5",
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "#ef4444",
              boxShadow: "0 0 14px rgba(239,68,68,0.8)",
            }}
          />
          LIVE NOW
        </div>

        <div style={{ height: 40 }} />

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

        <div style={{ height: 20 }} />

        {viewerCount !== undefined && viewerCount > 0 && (
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 600,
              color: "#fca5a5",
            }}
          >
            {viewerCount.toLocaleString()} {viewerCount === 1 ? "person" : "people"} watching
          </div>
        )}

        <div style={{ height: 28 }} />

        <div
          style={{
            display: "flex",
            padding: "14px 28px",
            borderRadius: 999,
            background: "rgba(239,68,68,0.2)",
            border: "1px solid rgba(239,68,68,0.5)",
            fontSize: 22,
            fontWeight: 700,
            color: "#fca5a5",
          }}
        >
          JOIN THE CONVERSATION
        </div>
      </div>

      {orbs.map((orb, i) => (
        <Sphere key={`orb-${i}`} orb={orb} />
      ))}

      <BottomBar accent={accent} />
    </div>
  )
}
