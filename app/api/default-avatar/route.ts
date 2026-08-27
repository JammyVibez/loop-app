import { type NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/default-avatar?id=<userId>&name=<username>&type=<avatar|banner>
 *
 * Returns a unique animated SVG cartoon character avatar based on the user's ID.
 * Each user gets a unique combination of colors, face style, expression, and
 * accessories — all animated with SMIL animations that work in <img> tags.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id") || "default"
  const name = searchParams.get("name") || "U"
  const type = searchParams.get("type")

  if (type === "banner") {
    return generateBanner(id)
  }
  return generateAvatar(id, name)
}

function hash(str: string, salt = 0): number {
  let h = salt
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h % 360}, ${s}%, ${l}%)`
}

/* -------------------------------------------------------------------------- */
/*  Avatar generator                                                          */
/* -------------------------------------------------------------------------- */

function generateAvatar(id: string, name: string) {
  const h1 = hash(id, 0)
  const h2 = hash(id, 7)
  const h3 = hash(id, 13)
  const h4 = hash(id, 29)
  const h5 = hash(id, 41)

  // Color palette — warm, vivid, approachable
  const bgHue = h1 % 360
  const bg1 = hsl(bgHue, 72, 52)
  const bg2 = hsl((bgHue + 35) % 360, 68, 38)
  const skinHue = pick([25, 30, 35, 20, 15, 40], h2)
  const skinColor = hsl(skinHue, 55, 72)
  const skinShadow = hsl(skinHue, 50, 62)
  const hairHue = pick([0, 20, 40, 200, 220, 260, 280, 300, 340, 30], h3)
  const hairColor = hsl(hairHue, 65, 30)
  const hairHighlight = hsl(hairHue, 60, 45)
  const eyeColor = pick([210, 160, 130, 100, 260, 200, 180], h4)
  const cheekColor = hsl(0, 65, 75)

  // Face style
  const faceShape = h1 % 3 // 0=round, 1=oval, 2=square-ish
  const expression = h2 % 5 // 0=happy, 1=wink, 2=smile, 3=excited, 4=chill
  const hairStyle = h3 % 6 // 0=spiky, 1=flowing, 2=bob, 3=ponytail, 4=buzz, 5=curly
  const accessory = h4 % 8 // 0=none, 1=glasses, 2=hat, 3=headband, 4=earring, 5=bow, 6=mask, 7=crown

  const initials = getInitials(name)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}">
        <animate attributeName="stop-color" values="${bg1};${bg2};${hsl((bgHue+60)%360,70,45)};${bg1}" dur="8s" repeatCount="indefinite"/>
      </stop>
      <stop offset="100%" stop-color="${bg2}">
        <animate attributeName="stop-color" values="${bg2};${hsl((bgHue+60)%360,70,45)};${bg1};${bg2}" dur="8s" repeatCount="indefinite"/>
      </stop>
    </linearGradient>
    <radialGradient id="shine" cx="35%" cy="30%" r="50%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <clipPath id="faceClip"><circle cx="50" cy="50" r="48"/></clipPath>
  </defs>

  <!-- Background circle -->
  <circle cx="50" cy="50" r="50" fill="url(#bg)">
    <animateTransform attributeName="transform" type="rotate" values="0 50 50;2 50 50;0 50 50;-2 50 50;0 50 50" dur="6s" repeatCount="indefinite"/>
  </circle>

  <g clip-path="url(#faceClip)">
    <!-- Floating particles -->
    ${generateParticles(id, bgHue)}

    <!-- Neck -->
    <rect x="42" y="68" width="16" height="12" rx="4" fill="${skinShadow}"/>

    <!-- Body / shoulders -->
    <ellipse cx="50" cy="88" rx="28" ry="18" fill="${hairColor}" opacity="0.9"/>
    <ellipse cx="50" cy="86" rx="24" ry="14" fill="${hsl((hairHue+20)%360, 50, 40)}"/>

    <!-- Head shape -->
    ${generateHead(faceShape, skinColor, skinShadow)}

    <!-- Hair (behind face for some styles) -->
    ${generateHairBack(hairStyle, hairColor, hairHighlight)}

    <!-- Face features -->
    ${generateEyes(expression, eyeColor, h5)}
    ${generateMouth(expression, h5)}
    ${generateNose(h5)}
    ${generateCheeks(cheekColor)}

    <!-- Hair (in front) -->
    ${generateHairFront(hairStyle, hairColor, hairHighlight, h3)}

    <!-- Accessory -->
    ${generateAccessory(accessory, h4, hairColor)}
  </g>

  <!-- Shine overlay -->
  <circle cx="50" cy="50" r="48" fill="url(#shine)"/>
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

/* -------------------------------------------------------------------------- */
/*  Part generators                                                           */
/* -------------------------------------------------------------------------- */

function generateParticles(id: string, hue: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const s = hash(`${id}-p${i}`, i * 17)
    const cx = 10 + (s % 80)
    const cy = 10 + ((s * 3) % 80)
    const r = 1.5 + (s % 3)
    const opacity = 0.12 + ((s % 25) / 100)
    const delay = ((s * 2) % 40) / 10
    const dur = 3 + (s % 3)
    const color = i % 2 === 0 ? "rgba(255,255,255,0.5)" : hsl((hue + i * 40) % 360, 50, 80)
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}">
      <animate attributeName="cy" values="${cy};${cy - 10 - (s % 12)};${cy}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
      <animate attributeName="cx" values="${cx};${cx + ((s % 5) - 2)};${cx}" dur="${dur + 0.8}s" begin="${delay}s" repeatCount="indefinite"/>
    </circle>`
  }).join("\n    ")
}

function generateHead(shape: number, skin: string, shadow: string): string {
  switch (shape) {
    case 0: // Round
      return `<circle cx="50" cy="44" r="24" fill="${skin}"/>
              <circle cx="50" cy="46" r="22" fill="${shadow}" opacity="0.15"/>`
    case 1: // Oval
      return `<ellipse cx="50" cy="44" rx="20" ry="25" fill="${skin}"/>
              <ellipse cx="50" cy="46" rx="18" ry="23" fill="${shadow}" opacity="0.15"/>`
    default: // Slightly square
      return `<rect x="30" y="22" width="40" height="44" rx="18" fill="${skin}"/>
              <rect x="32" y="24" width="36" height="40" rx="16" fill="${shadow}" opacity="0.15"/>`
  }
}

function generateEyes(expression: number, eyeColor: number, seed: number): string {
  const leftX = 40
  const rightX = 60
  const y = 42
  const blinkDur = 3 + (seed % 3)

  // Eye white
  const whites = `
    <ellipse cx="${leftX}" cy="${y}" rx="5" ry="4.5" fill="white"/>
    <ellipse cx="${rightX}" cy="${y}" rx="5" ry="4.5" fill="white"/>`

  // Iris + pupil
  const iris = (cx: number) => `
    <circle cx="${cx}" cy="${y}" r="3.2" fill="${hsl(eyeColor, 65, 40)}">
      <animate attributeName="cx" values="${cx};${cx + 0.5};${cx};${cx - 0.5};${cx}" dur="4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${cx}" cy="${y - 0.5}" r="1.5" fill="hsl(0,0%,10%)"/>
    <circle cx="${cx - 0.8}" cy="${y - 1.2}" r="0.8" fill="rgba(255,255,255,0.85)"/>`

  const irises = iris(leftX) + iris(rightX)

  // Blink animation
  const blink = `
    <animateTransform attributeName="transform" type="scale" values="1 1;1 0.1;1 1" dur="${blinkDur}s" begin="2s" repeatCount="indefinite" additive="sum"/>`

  switch (expression) {
    case 1: // Wink
      return whites + irises + `
    <line x1="${rightX - 4}" y1="${y}" x2="${rightX + 4}" y2="${y}" stroke="hsl(0,0%,20%)" stroke-width="1.8" stroke-linecap="round"/>`
    case 3: // Excited (sparkle eyes)
      return `
    <ellipse cx="${leftX}" cy="${y}" rx="5.5" ry="5" fill="white"/>
    <ellipse cx="${rightX}" cy="${y}" rx="5.5" ry="5" fill="white"/>
    <polygon points="${leftX},${y - 3} ${leftX + 1.5},${y - 0.5} ${leftX},${y + 2} ${leftX - 1.5},${y - 0.5}" fill="${hsl(eyeColor, 70, 45)}"/>
    <polygon points="${rightX},${y - 3} ${rightX + 1.5},${y - 0.5} ${rightX},${y + 2} ${rightX - 1.5},${y - 0.5}" fill="${hsl(eyeColor, 70, 45)}"/>
    <circle cx="${leftX}" cy="${y - 1}" r="1" fill="white"/>
    <circle cx="${rightX}" cy="${y - 1}" r="1" fill="white"/>`
    case 4: // Chill (half-closed)
      return `
    <ellipse cx="${leftX}" cy="${y}" rx="5" ry="2.5" fill="white"/>
    <ellipse cx="${rightX}" cy="${y}" rx="5" ry="2.5" fill="white"/>
    <circle cx="${leftX}" cy="${y}" r="2.8" fill="${hsl(eyeColor, 60, 38)}"/>
    <circle cx="${rightX}" cy="${y}" r="2.8" fill="${hsl(eyeColor, 60, 38)}"/>
    <circle cx="${leftX}" cy="${y}" r="1.3" fill="hsl(0,0%,10%)"/>
    <circle cx="${rightX}" cy="${y}" r="1.3" fill="hsl(0,0%,10%)"/>
    <circle cx="${leftX - 0.7}" cy="${y - 0.8}" r="0.6" fill="rgba(255,255,255,0.7)"/>
    <circle cx="${rightX - 0.7}" cy="${y - 0.8}" r="0.6" fill="rgba(255,255,255,0.7)"/>`
    default: // Happy / Smile
      return whites + irises + `
    <ellipse cx="${leftX}" cy="${y - 4.5}" rx="5" ry="0.8" fill="hsl(0,0%,20%)" opacity="0.15"/>`
  }
}

function generateMouth(expression: number, seed: number): string {
  const y = 52
  switch (expression) {
    case 0: // Happy
      return `<path d="M 43 ${y} Q 50 ${y + 5} 57 ${y}" fill="none" stroke="hsl(0,0%,25%)" stroke-width="1.5" stroke-linecap="round"/>`
    case 1: // Wink
      return `<path d="M 44 ${y} Q 50 ${y + 4} 56 ${y}" fill="none" stroke="hsl(0,0%,25%)" stroke-width="1.5" stroke-linecap="round"/>`
    case 2: // Smile (bigger)
      return `<path d="M 42 ${y - 1} Q 50 ${y + 7} 58 ${y - 1}" fill="hsl(350, 60%, 65%)" stroke="hsl(0,0%,25%)" stroke-width="1" stroke-linecap="round"/>
              <path d="M 44 ${y + 1} Q 50 ${y + 5} 56 ${y + 1}" fill="white" opacity="0.6"/>`
    case 3: // Excited (open mouth)
      return `<ellipse cx="50" cy="${y + 1}" rx="5" ry="3.5" fill="hsl(350, 55%, 55%)" stroke="hsl(0,0%,25%)" stroke-width="1"/>
              <ellipse cx="50" cy="${y + 3}" rx="3" ry="1.5" fill="hsl(350, 65%, 70%)"/>`
    default: // Chill (small 'o')
      return `<ellipse cx="50" cy="${y}" rx="2.5" ry="2" fill="hsl(350, 50%, 60%)" stroke="hsl(0,0%,25%)" stroke-width="0.8"/>`
  }
}

function generateNose(seed: number): string {
  const style = seed % 3
  if (style === 0) return `<circle cx="50" cy="47" r="1.2" fill="hsl(0,0%,70%)" opacity="0.4"/>`
  if (style === 1) return `<path d="M 49 46 Q 50 48 51 46" fill="none" stroke="hsl(0,0%,65%)" stroke-width="0.8" opacity="0.5"/>`
  return `<ellipse cx="50" cy="47" rx="1.5" ry="1" fill="hsl(0,0%,68%)" opacity="0.35"/>`
}

function generateCheeks(color: string): string {
  return `
    <ellipse cx="35" cy="49" rx="4.5" ry="2.5" fill="${color}" opacity="0.35">
      <animate attributeName="opacity" values="0.35;0.5;0.35" dur="3s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="65" cy="49" rx="4.5" ry="2.5" fill="${color}" opacity="0.35">
      <animate attributeName="opacity" values="0.35;0.5;0.35" dur="3s" begin="0.5s" repeatCount="indefinite"/>
    </ellipse>`
}

function generateHairBack(style: number, color: string, highlight: string): string {
  switch (style) {
    case 0: // Spiky (back tufts)
      return `<path d="M 28 30 L 22 15 L 32 28" fill="${color}"/>
              <path d="M 72 30 L 78 15 L 68 28" fill="${color}"/>`
    case 1: // Flowing
      return `<path d="M 26 35 Q 20 50 28 65 Q 30 55 28 40 Z" fill="${color}"/>
              <path d="M 74 35 Q 80 50 72 65 Q 70 55 72 40 Z" fill="${color}"/>`
    case 2: // Bob
      return `<path d="M 26 32 Q 24 48 30 58 L 30 35 Z" fill="${color}"/>
              <path d="M 74 32 Q 76 48 70 58 L 70 35 Z" fill="${color}"/>`
    case 3: // Ponytail
      return `<path d="M 68 28 Q 80 20 82 35 Q 78 45 72 40" fill="${color}"/>
              <path d="M 70 30 Q 80 24 80 38 Q 76 44 72 38" fill="${highlight}" opacity="0.5"/>`
    case 4: // Buzz (no back hair)
      return ""
    default: // Curly
      return `<circle cx="27" cy="30" r="6" fill="${color}"/>
              <circle cx="73" cy="30" r="6" fill="${color}"/>
              <circle cx="25" cy="38" r="5" fill="${color}"/>
              <circle cx="75" cy="38" r="5" fill="${color}"/>`
  }
}

function generateHairFront(style: number, color: string, highlight: string, seed: number): string {
  switch (style) {
    case 0: // Spiky
      return `<path d="M 30 26 L 35 8 L 42 22 L 48 5 L 52 20 L 58 8 L 62 22 L 68 12 L 70 28 Q 50 18 30 26 Z" fill="${color}"/>
              <path d="M 35 20 L 40 12 L 45 18" fill="${highlight}" opacity="0.4"/>
              <path d="M 55 18 L 60 10 L 63 20" fill="${highlight}" opacity="0.3"/>`
    case 1: // Flowing
      return `<path d="M 28 28 Q 35 8 50 10 Q 65 8 72 28 Q 65 16 50 18 Q 35 16 28 28 Z" fill="${color}"/>
              <path d="M 32 22 Q 40 12 50 14 Q 42 14 32 22 Z" fill="${highlight}" opacity="0.4"/>
              <path d="M 26 32 Q 22 42 28 52" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
              <path d="M 74 32 Q 78 42 72 52" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`
    case 2: // Bob
      return `<path d="M 28 28 Q 35 8 50 10 Q 65 8 72 28 L 72 42 Q 65 48 50 46 Q 35 48 28 42 Z" fill="${color}"/>
              <path d="M 32 20 Q 42 10 52 14 Q 40 14 32 20 Z" fill="${highlight}" opacity="0.35"/>
              <rect x="28" y="30" width="44" height="3" rx="1.5" fill="${color}" opacity="0.4"/>`
    case 3: // Ponytail
      return `<path d="M 30 26 Q 38 8 50 10 Q 62 8 70 26 Q 62 16 50 18 Q 38 16 30 26 Z" fill="${color}"/>
              <path d="M 34 20 Q 42 12 50 14 Q 44 14 34 20 Z" fill="${highlight}" opacity="0.35"/>
              <circle cx="70" cy="28" r="4" fill="${color}"/>`
    case 4: // Buzz
      return `<path d="M 30 26 Q 38 10 50 12 Q 62 10 70 26 Q 62 16 50 18 Q 38 16 30 26 Z" fill="${color}" opacity="0.7"/>`
    default: // Curly
      return `<circle cx="35" cy="20" r="8" fill="${color}"/>
              <circle cx="50" cy="14" r="9" fill="${color}"/>
              <circle cx="65" cy="20" r="8" fill="${color}"/>
              <circle cx="28" cy="28" r="6" fill="${color}"/>
              <circle cx="72" cy="28" r="6" fill="${color}"/>
              <circle cx="42" cy="14" r="5" fill="${highlight}" opacity="0.3"/>
              <circle cx="58" cy="14" r="5" fill="${highlight}" opacity="0.25"/>`
  }
}

function generateAccessory(type: number, seed: number, hairColor: string): string {
  switch (type) {
    case 1: // Glasses
      return `<circle cx="40" cy="42" r="5.5" fill="none" stroke="hsl(0,0%,25%)" stroke-width="1.2"/>
              <circle cx="60" cy="42" r="5.5" fill="none" stroke="hsl(0,0%,25%)" stroke-width="1.2"/>
              <line x1="45.5" y1="42" x2="54.5" y2="42" stroke="hsl(0,0%,25%)" stroke-width="1"/>
              <line x1="34.5" y1="42" x2="30" y2="40" stroke="hsl(0,0%,25%)" stroke-width="1"/>
              <line x1="65.5" y1="42" x2="70" y2="40" stroke="hsl(0,0%,25%)" stroke-width="1"/>`
    case 2: // Hat
      return `<ellipse cx="50" cy="20" rx="26" ry="4" fill="${hairColor}"/>
              <rect x="32" y="4" width="36" height="16" rx="8" fill="${hairColor}"/>
              <rect x="34" y="14" width="32" height="3" rx="1.5" fill="hsl(0,0%,100%)" opacity="0.2"/>`
    case 3: // Headband
      return `<path d="M 28 28 Q 50 12 72 28" fill="none" stroke="hsl(${(seed * 30) % 360}, 70%, 55%)" stroke-width="3" stroke-linecap="round"/>
              <circle cx="65" cy="24" r="2" fill="hsl(${(seed * 30) % 360}, 70%, 55%)"/>`
    case 4: // Earring
      return `<circle cx="26" cy="48" r="2" fill="hsl(45, 80%, 60%)">
                <animate attributeName="ry" values="2;2.5;2" dur="2s" repeatCount="indefinite"/>
              </circle>
              <circle cx="26" cy="52" r="1.2" fill="hsl(45, 85%, 70%)"/>`
    case 5: // Bow
      return `<path d="M 50 14 Q 42 8 38 14 Q 42 20 50 16 Z" fill="hsl(${(seed * 40) % 360}, 70%, 60%)"/>
              <path d="M 50 14 Q 58 8 62 14 Q 58 20 50 16 Z" fill="hsl(${(seed * 40) % 360}, 70%, 55%)"/>
              <circle cx="50" cy="15" r="1.5" fill="hsl(${(seed * 40) % 360}, 75%, 45%)"/>`
    case 6: // Face mask (kawaii style)
      return `<rect x="38" y="48" width="24" height="12" rx="6" fill="white" opacity="0.85"/>
              <rect x="38" y="48" width="24" height="12" rx="6" fill="none" stroke="hsl(200, 30%, 80%)" stroke-width="0.8"/>
              <path d="M 44 52 Q 47 55 50 52 Q 53 49 56 52" fill="none" stroke="hsl(200, 40%, 70%)" stroke-width="0.8"/>`
    default: // Crown
      return `<path d="M 32 18 L 36 8 L 42 14 L 50 4 L 58 14 L 64 8 L 68 18 Z" fill="hsl(45, 85%, 55%)" stroke="hsl(40, 80%, 45%)" stroke-width="0.5"/>
              <circle cx="36" cy="10" r="1.5" fill="hsl(0, 70%, 55%)"/>
              <circle cx="50" cy="6" r="1.8" fill="hsl(220, 70%, 55%)"/>
              <circle cx="64" cy="10" r="1.5" fill="hsl(120, 60%, 50%)"/>`
  }
}

/* -------------------------------------------------------------------------- */
/*  Banner generator                                                          */
/* -------------------------------------------------------------------------- */

function generateBanner(id: string) {
  const h1 = hash(id, 0)
  const bgHue = h1 % 360
  const bg1 = hsl(bgHue, 70, 48)
  const bg2 = hsl((bgHue + 35) % 360, 65, 35)
  const bg3 = hsl((bgHue + 70) % 360, 60, 42)

  const particles = Array.from({ length: 16 }, (_, i) => {
    const s = hash(`${id}-bp${i}`, i * 11)
    const cx = s % 1200
    const cy = (s * 3) % 400
    const r = 2 + (s % 6)
    const opacity = 0.06 + ((s % 15) / 100)
    const delay = ((s * 2) % 50) / 10
    const dur = 4 + (s % 4)
    const color = i % 3 === 0 ? "rgba(255,255,255,0.4)" : hsl((bgHue + i * 25) % 360, 45, 75)
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}">
      <animate attributeName="cy" values="${cy};${cy - 18 - (s % 12)};${cy}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
    </circle>`
  }).join("\n    ")

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}">
        <animate attributeName="stop-color" values="${bg1};${bg2};${bg3};${bg1}" dur="10s" repeatCount="indefinite"/>
      </stop>
      <stop offset="50%" stop-color="${bg2}">
        <animate attributeName="stop-color" values="${bg2};${bg3};${bg1};${bg2}" dur="10s" repeatCount="indefinite"/>
      </stop>
      <stop offset="100%" stop-color="${bg3}">
        <animate attributeName="stop-color" values="${bg3};${bg1};${bg2};${bg3}" dur="10s" repeatCount="indefinite"/>
      </stop>
    </linearGradient>
  </defs>
  <rect width="1200" height="400" fill="url(#bg)"/>
  ${particles}
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

function getInitials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
}
