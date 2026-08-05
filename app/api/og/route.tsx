import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

type OgType = "loop" | "profile" | "circle" | "developer" | "reel" | "live"

const THEMES: Record<OgType, { from: string; to: string; accent: string; label: string; icon: string }> = {
  loop: { from: "#06b6d4", to: "#4f46e5", accent: "#22d3ee", label: "Loop", icon: "∞" },
  profile: { from: "#8b5cf6", to: "#ec4899", accent: "#c084fc", label: "Profile", icon: "@" },
  circle: { from: "#f59e0b", to: "#ea580c", accent: "#fbbf24", label: "Circle", icon: "◎" },
  developer: { from: "#10b981", to: "#0891b2", accent: "#34d399", label: "Dev Project", icon: "</>" },
  reel: { from: "#ef4444", to: "#db2777", accent: "#fb7185", label: "Reel", icon: "▶" },
  live: { from: "#dc2626", to: "#7c3aed", accent: "#f87171", label: "Live", icon: "●" },
}

function isOgType(value: string): value is OgType {
  return value in THEMES
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const title = searchParams.get("title") || "Loop - Collaborative Social OS"
    const description =
      searchParams.get("description") ||
      "Connect, create, and collaborate in real time with live streams, co-loops, and interactive circles."
    const rawType = searchParams.get("type") || "loop"
    const type: OgType = isOgType(rawType) ? rawType : "loop"
    const username = searchParams.get("username")
    const verified = searchParams.get("verified") === "true"
    const stat = searchParams.get("stat")
    const statLabel = searchParams.get("stat_label")
    let avatar = searchParams.get("avatar") || ""

    if (avatar && !avatar.startsWith("http://") && !avatar.startsWith("https://")) {
      avatar = ""
    }

    const theme = THEMES[type]

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "space-between",
            backgroundColor: "#070b16",
            backgroundImage:
              `radial-gradient(circle at 8% 8%, ${theme.from}33, transparent 45%), ` +
              `radial-gradient(circle at 95% 15%, ${theme.to}2e, transparent 40%), ` +
              `radial-gradient(circle at 85% 92%, ${theme.accent}22, transparent 45%)`,
            padding: "56px 76px",
            fontFamily: "sans-serif",
            color: "#ffffff",
            position: "relative",
          }}
        >
          {/* Top Header / Branding */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, #06b6d4, #4f46e5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#ffffff",
                }}
              >
                ∞
              </div>
              <span style={{ fontSize: "28px", fontWeight: "bold", color: "#ffffff" }}>
                LOOP <span style={{ color: "#22d3ee" }}>SOCIAL OS</span>
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 22px",
                borderRadius: "999px",
                border: `1px solid ${theme.accent}66`,
                backgroundColor: `${theme.accent}22`,
                color: theme.accent,
                fontSize: "17px",
                fontWeight: "bold",
              }}
            >
              <span style={{ fontSize: "18px" }}>{theme.icon}</span>
              {theme.label.toUpperCase()}
            </div>
          </div>

          {/* Main Body */}
          <div style={{ display: "flex", flexDirection: "column", gap: "22px", maxWidth: "1000px" }}>
            {(username || avatar) && (
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={avatar}
                    alt={username || "avatar"}
                    width={64}
                    height={64}
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "999px",
                      border: `2px solid ${theme.accent}`,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "999px",
                      border: `2px solid ${theme.accent}`,
                      backgroundColor: "#1e293b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: theme.accent,
                    }}
                  >
                    {(username || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                {username && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "24px", color: "#cbd5e1", fontWeight: "600" }}>@{username}</span>
                    {verified && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "26px",
                          height: "26px",
                          borderRadius: "999px",
                          backgroundColor: theme.accent,
                          color: "#070b16",
                          fontSize: "15px",
                          fontWeight: "bold",
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <h1
              style={{
                fontSize: title.length > 50 ? "46px" : "58px",
                fontWeight: "800",
                lineHeight: 1.15,
                color: "#f8fafc",
                margin: 0,
              }}
            >
              {title}
            </h1>

            <p
              style={{
                fontSize: "23px",
                color: "#94a3b8",
                lineHeight: 1.45,
                margin: 0,
                maxWidth: "920px",
              }}
            >
              {description.length > 160 ? `${description.slice(0, 157)}...` : description}
            </p>

            {stat && (
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                  marginTop: "4px",
                }}
              >
                <span style={{ fontSize: "34px", fontWeight: "800", color: theme.accent }}>{stat}</span>
                {statLabel && (
                  <span style={{ fontSize: "20px", color: "#64748b", fontWeight: "600" }}>{statLabel}</span>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              paddingTop: "24px",
              fontSize: "18px",
              color: "#64748b",
            }}
          >
            <span>Loop Social OS</span>
            <span style={{ color: theme.accent }}>Live Streams • Co-Loops • Circles • Developer Hub</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "content-type": "image/png",
          "cache-control": "public, max-age=86400, s-maxage=86400",
        },
      }
    )
  } catch (err) {
    console.error("Error generating OG image:", err)
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#080d1a",
            color: "#ffffff",
            fontSize: "48px",
            fontWeight: "bold",
          }}
        >
          LOOP SOCIAL OS
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "content-type": "image/png",
        },
      }
    )
  }
}
