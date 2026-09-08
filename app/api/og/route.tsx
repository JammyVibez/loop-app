import { ImageResponse } from "next/og"

// Open Graph image generator — every share preview on the platform points
// here (app/layout.tsx builds `${siteUrl}/api/og?type=home&title=...`).
// Previously this route did not exist, so shared links rendered with a
// broken image. Pure vector rendering (no external fonts/images) so it
// works on any runtime without network dependencies.
export const runtime = "edge"

const WIDTH = 1200
const HEIGHT = 630

const DEFAULT_TITLE = "Loop — Build Together, Not Just Post Into The Void"
const DEFAULT_DESC =
  "Loop is the collaborative social network where you co-write posts live with friends, settle debates in public Duels, build communities in Circles, and earn rewards for being active."

function truncate(value: string, max: number): string {
  const clean = String(value || "").replace(/[<>&]/g, "").trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trimEnd()}…`
}

const TYPE_META: Record<string, { label: string; accent: string }> = {
  home: { label: "Loop Social", accent: "#8B5CF6" },
  profile: { label: "Profile", accent: "#22D3EE" },
  community: { label: "Community", accent: "#EC4899" },
  loop: { label: "Loop", accent: "#8B5CF6" },
  duel: { label: "Duel", accent: "#F59E0B" },
  reel: { label: "Reel", accent: "#EC4899" },
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = String(searchParams.get("type") || "home")
  const title = truncate(searchParams.get("title") || DEFAULT_TITLE, 64)
  const description = truncate(searchParams.get("description") || DEFAULT_DESC, 140)
  const meta = TYPE_META[type] || TYPE_META.home

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          padding: "72px 84px",
          background: "linear-gradient(135deg, #0B0F19 0%, #111827 55%, #191233 100%)",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* ambient glows */}
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -180,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0) 65%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -260,
            left: -200,
            width: 640,
            height: 640,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(34,211,238,0.22) 0%, rgba(34,211,238,0) 65%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 120,
            left: 420,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(236,72,153,0.18) 0%, rgba(236,72,153,0) 65%)",
          }}
        />
        {/* fine grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
              color: "#FFFFFF",
              fontSize: 26,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            L
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "#FFFFFF" }}>loopapp.me</div>
            <div style={{ fontSize: 14, color: "#8B5CF6", fontWeight: 600, letterSpacing: "0.08em" }}>
              BUILD TOGETHER, NOT JUST POST
            </div>
          </div>
        </div>

        {/* body */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: "auto", position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              alignSelf: "flex-start",
              padding: "10px 20px",
              borderRadius: 9999,
              border: `1.5px solid ${meta.accent}55`,
              background: `${meta.accent}14`,
              color: meta.accent,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 9999,
                background: meta.accent,
                boxShadow: `0 0 14px ${meta.accent}`,
              }}
            />
            {meta.label.toUpperCase()}
          </div>

          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.03em", color: "#FFFFFF" }}>
            {title}
          </div>

          <div
            style={{
              fontSize: 28,
              lineHeight: 1.4,
              color: "#A5B0C2",
              maxWidth: 900,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 56,
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            position: "relative",
          }}
        >
          <div style={{ fontSize: 18, color: "#8A94A6", fontWeight: 600 }}>
            Community · Duels · Co-Loops · Reels · Rewards
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: "#22D3EE", boxShadow: "0 0 12px #22D3EE" }} />
            <span style={{ fontSize: 18, color: "#D1D5DB", fontWeight: 600 }}>loopapp.me</span>
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )
}