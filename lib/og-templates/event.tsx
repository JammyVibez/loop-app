/**
 * Event OG Template — event-specific composition.
 *
 * Shows: event title, date/time, attendee count, community
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

export interface EventOgProps {
  title?: string
  description?: string
  startDate?: string
  attendeeCount?: number
  communityName?: string
}

export function EventOG({
  title,
  description,
  startDate,
  attendeeCount,
  communityName,
}: EventOgProps): ReactElement {
  const accent = ACCENTS.sky
  const heading = truncate(title || "Community Event", 100)
  const desc = truncate(description || "", 200)
  const orbs = buildOrbs(accent)

  let dateStr = ""
  if (startDate) {
    try {
      const d = new Date(startDate)
      dateStr = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) +
        " at " +
        d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    } catch {
      dateStr = startDate
    }
  }

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
          📅 EVENT
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

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {dateStr && (
            <div
              style={{
                display: "flex",
                padding: "11px 20px",
                borderRadius: 999,
                background: `${accent.base}22`,
                border: `1px solid ${accent.base}66`,
                fontSize: 20,
                fontWeight: 600,
                color: accent.light,
              }}
            >
              📆 {dateStr}
            </div>
          )}
          {attendeeCount !== undefined && attendeeCount > 0 && (
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
              {attendeeCount.toLocaleString()} attending
            </div>
          )}
          {communityName && (
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
              {truncate(communityName, 30)}
            </div>
          )}
        </div>
      </div>

      {orbs.map((orb, i) => (
        <Sphere key={`orb-${i}`} orb={orb} />
      ))}

      <BottomBar accent={accent} />
    </div>
  )
}
