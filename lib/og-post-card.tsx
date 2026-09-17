/**
 * Clean, premium OG card for post shares (loops + community posts).
 *
 * Substack-inspired: author row (avatar, name, badges, date) → post text →
 * quiet Loop branding. Rendered through satori, so only the CSS subset it
 * supports is used (flexbox, border-radius, gradients, box-shadow, line clamp).
 * No backdrop filters, no clip-paths.
 */

export interface PostOgCardProps {
  body: string
  name: string
  username?: string
  date?: string
  likes?: number
  verified?: boolean
  premium?: boolean
  /** Custom verification mark (admin badge) — gradient colors. */
  badgeColors?: string[]
  /** Avatar already inlined as a data URI (or undefined to fall back to an initial). */
  avatarDataUri?: string
  /** Short label shown in the top-right corner, e.g. "Loop Post". */
  kicker?: string
}

const SANS = "Inter, system-ui, -apple-system, sans-serif"
const PANEL_BG = "linear-gradient(155deg, #0C1024 0%, #141A38 48%, #0B0F22 100%)"

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "L"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
}

function likesLabel(n?: number) {
  const v = Number(n || 0)
  if (v <= 0) return ""
  const short = v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(v)
  return `${short} ${v === 1 ? "like" : "likes"}`
}

/** Gradient disc with a white check — the verified seal, drawn with borders. */
function Seal({ size, colors }: { size: number; colors: string[] }) {
  const from = colors[0] || "#22D3EE"
  const to = colors[1] || colors[0] || "#818CF8"
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 999,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        boxShadow: `0 4px 14px ${from}55`,
      }}
    >
      <div
        style={{
          width: size * 0.42,
          height: size * 0.24,
          marginTop: -size * 0.05,
          borderLeft: `${Math.max(2, size * 0.11)}px solid #FFFFFF`,
          borderBottom: `${Math.max(2, size * 0.11)}px solid #FFFFFF`,
          transform: "rotate(-45deg)",
        }}
      />
    </div>
  )
}

function ProPill() {
  return (
    <div
      style={{
        display: "flex",
        padding: "4px 12px",
        borderRadius: 999,
        background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: "0.06em",
        color: "#241505",
      }}
    >
      PRO
    </div>
  )
}

function LoopMark({ size = 38 }: { size?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: "linear-gradient(135deg, #7C3AED, #22D3EE)",
        color: "#FFFFFF",
        fontSize: Math.round(size * 0.6),
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      L
    </div>
  )
}

export function PostOgCard({
  body,
  name,
  username,
  date,
  likes,
  verified,
  premium,
  badgeColors,
  avatarDataUri,
  kicker,
}: PostOgCardProps) {
  const meta = [username ? `@${username}` : "", date || "", likesLabel(likes)].filter(Boolean).join("  ·  ")
  const custom = badgeColors && badgeColors.length ? badgeColors : null

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: 1200,
        height: 630,
        background: "#0A0C18",
        fontFamily: SANS,
        overflow: "hidden",
      }}
    >
      {/* ambient brand glow */}
      <div
        style={{
          position: "absolute",
          left: -140,
          top: -160,
          width: 620,
          height: 620,
          borderRadius: 9999,
          background: "radial-gradient(circle, rgba(124,58,237,0.34) 0%, rgba(124,58,237,0.08) 45%, rgba(124,58,237,0) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -180,
          bottom: -220,
          width: 700,
          height: 700,
          borderRadius: 9999,
          background: "radial-gradient(circle, rgba(34,211,238,0.20) 0%, rgba(34,211,238,0.05) 48%, rgba(34,211,238,0) 72%)",
        }}
      />

      {/* rounded card panel — soft corners, hairline rim, no heavy border */}
      <div
        style={{
          position: "absolute",
          left: 26,
          top: 26,
          width: 1148,
          height: 578,
          display: "flex",
          flexDirection: "column",
          borderRadius: 34,
          background: PANEL_BG,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
          padding: "52px 56px 44px 56px",
          overflow: "hidden",
        }}
      >
        {/* ── Author row ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 88,
              height: 88,
              borderRadius: 999,
              padding: 3,
              background: "linear-gradient(135deg, #8B5CF6, #22D3EE)",
              boxShadow: "0 8px 28px rgba(139,92,246,0.35)",
            }}
          >
            {avatarDataUri ? (
              <div
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 999,
                  backgroundImage: `url(${avatarDataUri})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 82,
                  height: 82,
                  borderRadius: 999,
                  background: "#151B3A",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 34,
                  fontWeight: 800,
                }}
              >
                {initials(name)}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF" }}>
                {name}
              </div>
              {verified && <Seal size={30} colors={["#22D3EE", "#818CF8"]} />}
              {premium && <ProPill />}
              {custom && <Seal size={30} colors={custom} />}
            </div>
            {meta && (
              <div style={{ fontSize: 22, fontWeight: 400, color: "rgba(255,255,255,0.55)" }}>{meta}</div>
            )}
          </div>

          {kicker && (
            <div
              style={{
                display: "flex",
                padding: "8px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.72)",
              }}
            >
              {kicker.toUpperCase()}
            </div>
          )}
        </div>

        <div style={{ height: 34 }} />

        {/* ── Post text ── */}
        <div
          style={{
            // satori honours -webkit-box + line clamp for multi-line ellipsis
            display: "-webkit-box",
            fontSize: 42,
            fontWeight: 500,
            lineHeight: 1.42,
            letterSpacing: "-0.01em",
            color: "rgba(255,255,255,0.95)",
            WebkitLineClamp: 5,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {body}
        </div>

        {/* ── Footer: quiet branding watermark ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: 22,
            borderTop: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <LoopMark size={38} />
            <div style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>Loop</div>
            <div style={{ fontSize: 21, fontWeight: 400, color: "rgba(255,255,255,0.38)" }}>loopapp.me</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "linear-gradient(135deg, #8B5CF6, #22D3EE)",
              }}
            />
            <div style={{ fontSize: 21, fontWeight: 600, color: "rgba(255,255,255,0.38)" }}>Build together</div>
          </div>
        </div>
      </div>
    </div>
  )
}
