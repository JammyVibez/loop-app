/**
 * Regenerate the web app icon set (PNGs + favicon.ico) from the current
 * public/icons/icon.svg brand mark so the Loop logo shows everywhere:
 * browser tab, PWA install, apple touch icons, Windows tiles.
 *
 * Usage: node scripts/generate-web-icons.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const svgPath = resolve(root, "public/icons/icon.svg")
const svg = readFileSync(svgPath)

const sizes = [
  { file: "favicon-16x16.png", size: 16 },
  { file: "favicon-32x32.png", size: 32 },
  { file: "favicon-48x48.png", size: 48 },
  { file: "icon-144x144.png", size: 144 },
  { file: "icon-192x192.png", size: 192 },
  { file: "icon-192x192-maskable.png", size: 192, padding: 0.12 },
  { file: "icon-384x384.png", size: 384 },
  { file: "icon-512x512.png", size: 512 },
  { file: "icon-512x512-maskable.png", size: 512, padding: 0.12 },
  { file: "touch-icon-iphone.png", size: 120 },
  { file: "touch-icon-ipad.png", size: 152 },
  { file: "touch-icon-ipad-retina.png", size: 167 },
  { file: "touch-icon-iphone-retina.png", size: 180 },
]

for (const { file, size, padding } of sizes) {
  const out = resolve(root, "public/icons", file)
  let buf = svg
  // Maskable icons need safe-zone padding so the mark survives any mask.
  if (padding) {
    buf = await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 3, g: 7, b: 18, alpha: 1 } },
    })
      .png()
      .toBuffer()
    const mark = await sharp(svg).resize(Math.round(size * (1 - padding * 2))).png().toBuffer()
    buf = await sharp(buf)
      .composite([{ input: mark, gravity: "center" }])
      .png()
      .toBuffer()
  } else {
    buf = await sharp(svg).resize(size, size).png().toBuffer()
  }
  writeFileSync(out, buf)
  console.log(`[ok] public/icons/${file} (${size}x${size})`)
}

// favicon.ico — ICO container embedding a 32×32 PNG (supported by all modern
// browsers, including Chrome/Firefox which content-sniff anyway).
const icoPng = await sharp(svg).resize(32, 32).png().toBuffer()
// ICO header (6 bytes) + directory entry (16 bytes) + PNG payload
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // count
const entry = Buffer.alloc(16)
entry.writeUInt8(32, 0) // width (0 means 256)
entry.writeUInt8(32, 1) // height
entry.writeUInt8(0, 2) // palette
entry.writeUInt8(0, 3) // reserved
entry.writeUInt16LE(1, 4) // color planes
entry.writeUInt16LE(32, 6) // bits per pixel
entry.writeUInt32LE(icoPng.length, 8) // size
entry.writeUInt32LE(22, 12) // offset
const ico = Buffer.concat([header, entry, icoPng])
writeFileSync(resolve(root, "public/favicon.ico"), ico)
console.log("[ok] public/favicon.ico (32×32 PNG in ICO)")
console.log("Done.")
