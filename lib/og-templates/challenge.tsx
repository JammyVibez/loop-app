/**
 * Challenge OG Template — time-limited challenge composition.
 *
 * Shows: challenge title, time remaining, participant count, community
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

export interface ChallengeOgProps {
  title?: string
  description?: string
  endsAt?: string
  participantCount?: number
  communityName?: string
}

export function ChallengeOG({
  title,
  description,
  endsAt,
  participantCount,
  communityName,
}: ChallengeOgProps): ReactElement {
  const accent = ACCENTS.amber
  const heading = truncate(title || "Community Challenge", 100)
  const desc = truncate(description || "", 200)
  const orbs = buildOrbs(accent)

  let timeLeft = ""
  if (endsAt) {
    try {
      const end = new Date(endsAt).getTime()
      const now = Date.now()
      const diff = end - now
      if (diff <= 0) {
        timeLeft = "Ended"
      } else {
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(hours / 24)
        if (days > 0) timeLeft = `${days}d ${hours % 24}h remaining`
        else if (hours > 0) timeLeft = `${hours}h remaining`
        else timeLeft = `${Math.ceil(diff / 60000)}m remaining`
      }
    } catch {
      timeLeft = ""
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
          🏆 CHALLENGE
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
          {timeLeft && (
            <div
              style={{
                display: "flex",
                padding: "11px 20px",
                borderRadius: 999,
                background: timeLeft === "Ended" ? "rgba(107,114,128,0.2)" : `${accent.base}22`,
                border: `1px solid ${timeLeft === "Ended" ? "rgba(107,114,128,0.4)" : `${accent.base}66`}`,
                fontSize: 21,
                fontWeight: 600,
                color: timeLeft === "Ended" ? "#9ca3af" : accent.light,
              }}
            >
              ⏱️ {timeLeft}
            </div>
          )}
          {participantCount !== undefined && participantCount > 0 && (
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
              {participantCount.toLocaleString()} participants
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
