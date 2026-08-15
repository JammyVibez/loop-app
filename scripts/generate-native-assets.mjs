/**
 * Generate Loop-branded native app assets (icons + splash screens).
 *
 * Draws the logomark as SVG (indigo/violet gradient, "L" with a loop accent),
 * rasterizes to the source PNGs @capacitor/assets expects in assets/,
 * then runs the Capacitor asset generator to emit every required Android and
 * iOS size into the android/ and ios/ platform folders.
 *
 * Usage: node scripts/generate-native-assets.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const assetsDir = resolve(__dirname, "..", "assets")
mkdirSync(assetsDir, { recursive: true })

// ---------------------------------------------------------------------------
// Logomark: a rounded "L" whose foot curls into a loop — the brand's
// collaborative loop-tree motif.
// ---------------------------------------------------------------------------
const LOGO_GROUP = `
  <g fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">
    <path d="M330 250 v550 h390" stroke-width="96"/>
    <circle cx="690" cy="660" r="138" stroke-width="84"/>
  </g>
`

function iconSvg({ background = true, foreground = false } = {}) {
  const bg = background
    ? `<defs>
         <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
           <stop offset="0" stop-color="#312e81"/>
           <stop offset="0.55" stop-color="#4f46e5"/>
           <stop offset="1" stop-color="#7c3aed"/>
         </linearGradient>
         <radialGradient id="glow" cx="0.5" cy="0.38" r="0.72">
           <stop offset="0" stop-color="#a78bfa" stop-opacity="0.5"/>
           <stop offset="1" stop-color="#a78bfa" stop-opacity="0"/>
         </radialGradient>
       </defs>
       <rect width="1024" height="1024" fill="url(#bg)"/>
       <rect width="1024" height="1024" fill="url(#glow)"/>`
    : ""
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bg}
  ${LOGO_GROUP}
</svg>`
}

const SPLASH = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="sglow" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="#4338ca" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#4338ca" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="#0d1230"/>
  <rect width="1024" height="1024" fill="url(#sglow)"/>
  ${LOGO_GROUP}
</svg>`

// ---------------------------------------------------------------------------
// Rasterize sources
// ---------------------------------------------------------------------------
async function rasterize(name, svg, width, height) {
  const out = resolve(assetsDir, name)
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(width, height)
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log(`wrote ${out} (${width}x${height})`)
  return out
}

await rasterize("icon.png", iconSvg({ background: true }), 1024, 1024)
await rasterize("icon-foreground.png", iconSvg({ background: false }), 1024, 1024)
await rasterize("icon-background.png", iconSvg({ background: true }), 1024, 1024)
await rasterize("splash.png", SPLASH, 2732, 2732)
await rasterize("splash-dark.png", SPLASH, 2732, 2732)

// ---------------------------------------------------------------------------
// Emit every platform size
// ---------------------------------------------------------------------------
console.log("\nRunning @capacitor/assets…")
execSync("npx capacitor-assets generate --android --ios", { stdio: "inherit", cwd: resolve(__dirname, "..") })
console.log("\nNative assets generated for Android + iOS.")
