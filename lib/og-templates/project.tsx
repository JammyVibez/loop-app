/**
 * Project OG Template — building together composition.
 *
 * Shows: project name, contributors, progress, status
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
  BrandPill,
  BottomBar,
  buildOrbs,
  Sphere,
  truncate,
} from "../og-tokens"

export interface ProjectOgProps {
  title?: string
  description?: string
  contributorCount?: number
  progress?: number
  status?: string
}

export function ProjectOG({
  title,
  description,
  contributorCount,
  progress,
  status,
}: ProjectOgProps): ReactElement {
  const accent = ACCENTS.emerald
  const heading = truncate(title || "Community Project", 100)
  const desc = truncate(description || "", 200)
  const orbs = buildOrbs(accent)

  const progressPercent = Math.min(100, Math.max(0, progress || 0))

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
          🛠️ BUILDING TOGETHER
        </div>

        <div style={{ height: 34 }} />

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

        {/* Stats row */}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {contributorCount !== undefined && contributorCount > 0 && (
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
              {contributorCount} contributor{contributorCount !== 1 ? "s" : ""}
            </div>
          )}
          {progressPercent > 0 && (
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
              {progressPercent}% complete
            </div>
          )}
          {status && (
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
              {status}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {progressPercent > 0 && (
          <>
            <div style={{ height: 20 }} />
            <div
              style={{
                width: 400,
                height: 8,
                borderRadius: 999,
                background: "rgba(255,255,255,0.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${accent.dark}, ${accent.base})`,
                }}
              />
            </div>
          </>
        )}
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

      {orbs.map((orb, i) => (
        <Sphere key={`orb-${i}`} orb={orb} />
      ))}

      <BottomBar accent={accent} />
    </div>
  )
}
