import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/default-avatar?id=<userId>&name=<username>&size=<px>
 *
 * Returns a unique, animated SVG avatar based on the user's ID.
 * The avatar features:
 * - A colorful gradient background unique to the user
 * - Animated floating particles
 * - The user's initials in the center
 * - A subtle breathing animation
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id") || "default"
  const name = searchParams.get("name") || "U"
  const type = searchParams.get("type") // "avatar" (default) or "banner"
  const isBanner = type === "banner"
  const size = isBanner ? undefined : parseInt(searchParams.get("size") || "256", 10)

  // Deterministic color palette from user ID
  const hash = simpleHash(id)
  const hue1 = hash % 360
  const hue2 = (hue1 + 40 + (hash % 60)) % 360
  const hue3 = (hue1 + 120 + (hash % 80)) % 360

  const bg1 = `hsl(${hue1}, 70%, 45%)`
  const bg2 = `hsl(${hue2}, 65%, 35%)`
  const bg3 = `hsl(${hue3}, 60%, 50%)`

  const initials = getInitials(name)

  // Generate deterministic particle positions from the hash
  const particles = Array.from({ length: 8 }, (_, i) => {
    const seed = simpleHash(`${id}-${i}`)
    const cx = 20 + (seed % 60)
    const cy = 15 + ((seed * 7) % 70)
    const r = 2 + (seed % 4)
    const delay = ((seed * 3) % 50) / 10
    const dur = 3 + (seed % 3)
    const opacity = 0.15 + ((seed % 30) / 100)
    const color = i % 2 === 0 ? "rgba(255,255,255,0.6)" : `hsl(${(hue1 + i * 30) % 360}, 50%, 80%)`
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}">
      <animate attributeName="cy" values="${cy};${cy - 15 - (seed % 10)};${cy}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
      <animate attributeName="cx" values="${cx};${cx + ((seed % 7) - 3)};${cx}" dur="${dur + 1}s" begin="${delay}s" repeatCount="indefinite" />
    </circle>`
  }).join("")

  if (isBanner) {
    // Wide banner SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}">
        <animate attributeName="stop-color" values="${bg1};${bg2};${bg3};${bg1}" dur="10s" repeatCount="indefinite" />
      </stop>
      <stop offset="50%" stop-color="${bg2}">
        <animate attributeName="stop-color" values="${bg2};${bg3};${bg1};${bg2}" dur="10s" repeatCount="indefinite" />
      </stop>
      <stop offset="100%" stop-color="${bg3}">
        <animate attributeName="stop-color" values="${bg3};${bg1};${bg2};${bg3}" dur="10s" repeatCount="indefinite" />
      </stop>
    </linearGradient>
  </defs>
  <rect width="1200" height="400" fill="url(#bg)" />
  ${Array.from({ length: 20 }, (_, i) => {
    const seed = simpleHash(`${id}-banner-${i}`)
    const cx = seed % 1200
    const cy = (seed * 3) % 400
    const r = 3 + (seed % 8)
    const opacity = 0.08 + ((seed % 20) / 100)
    const delay = ((seed * 2) % 60) / 10
    const dur = 4 + (seed % 4)
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.5)" opacity="${opacity}">
      <animate attributeName="cy" values="${cy};${cy - 20 - (seed % 15)};${cy}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
    </circle>`
  }).join("\n  ")}
</svg>`

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}">
        <animate attributeName="stop-color" values="${bg1};${bg2};${bg3};${bg1}" dur="8s" repeatCount="indefinite" />
      </stop>
      <stop offset="50%" stop-color="${bg2}">
        <animate attributeName="stop-color" values="${bg2};${bg3};${bg1};${bg2}" dur="8s" repeatCount="indefinite" />
      </stop>
      <stop offset="100%" stop-color="${bg3}">
        <animate attributeName="stop-color" values="${bg3};${bg1};${bg2};${bg3}" dur="8s" repeatCount="indefinite" />
      </stop>
    </linearGradient>
    <radialGradient id="shine" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.15)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </radialGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg)">
    <animateTransform attributeName="transform" type="rotate" values="0 50 50;3 50 50;0 50 50;-3 50 50;0 50 50" dur="6s" repeatCount="indefinite" />
  </rect>
  <rect width="100" height="100" rx="50" fill="url(#shine)" />
  ${particles}
  <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font-size="${initials.length > 1 ? 32 : 38}" font-weight="700" fill="white"
    letter-spacing="1" style="text-shadow: 0 1px 3px rgba(0,0,0,0.2)">
    ${escapeXml(initials)}
  </text>
</svg>`

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash)
}

function getInitials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}
