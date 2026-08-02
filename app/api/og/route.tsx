import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const title = searchParams.get("title") || "Loop - Collaborative Social OS"
    const description =
      searchParams.get("description") ||
      "Connect, create, and collaborate in real time with live streams, co-loops, and interactive circles."
    const type = searchParams.get("type") || "loop"
    const username = searchParams.get("username")
    let avatar = searchParams.get("avatar") || ""

    if (avatar && !avatar.startsWith("http://") && !avatar.startsWith("https://")) {
      avatar = ""
    }

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
            backgroundColor: "#080d1a",
            padding: "60px 80px",
            fontFamily: "sans-serif",
            color: "#ffffff",
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
                padding: "8px 20px",
                borderRadius: "999px",
                border: "1px solid rgba(34, 211, 238, 0.4)",
                backgroundColor: "rgba(6, 182, 212, 0.15)",
                color: "#22d3ee",
                fontSize: "16px",
                fontWeight: "bold",
                textTransform: "uppercase",
              }}
            >
              {type.toUpperCase()}
            </div>
          </div>

          {/* Main Body */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1000px" }}>
            {username && (
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={avatar}
                    alt={username}
                    style={{ width: "56px", height: "56px", borderRadius: "999px", border: "2px solid #22d3ee" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "999px",
                      border: "2px solid #22d3ee",
                      backgroundColor: "#1e293b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: "#22d3ee",
                    }}
                  >
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: "22px", color: "#94a3b8", fontWeight: "600" }}>@{username}</span>
              </div>
            )}

            <h1
              style={{
                fontSize: title.length > 50 ? "44px" : "56px",
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
                fontSize: "22px",
                color: "#94a3b8",
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              {description}
            </p>
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
            <span style={{ color: "#22d3ee" }}>Live Streams • Co-Loops • Circles</span>
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
