#!/usr/bin/env node
/**
 * Rasterise the bundled profile-theme artwork for Open Graph cards.
 *
 * Satori (the OG renderer) paints raster images but skips SVG backgrounds, and
 * every bundled theme's artwork is SVG. This writes a 1600x900 JPEG next to the
 * source SVG under public/profile-themes/og/, and the profile metadata points
 * sharers at that file. The profile page itself keeps using the SVG.
 *
 * Run after editing any theme artwork:
 *   node scripts/generate-profile-theme-og-images.mjs
 */

import { mkdir, readdir, stat } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const SOURCE_DIR = path.join(process.cwd(), "public", "profile-themes")
const OUTPUT_DIR = path.join(SOURCE_DIR, "og")
const WIDTH = 1600
const HEIGHT = 900

await mkdir(OUTPUT_DIR, { recursive: true })

const entries = await readdir(SOURCE_DIR, { withFileTypes: true })
const svgs = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
  .map((entry) => entry.name)
  .sort()

if (svgs.length === 0) {
  console.error("No theme artwork found in", SOURCE_DIR)
  process.exit(1)
}

let total = 0
for (const name of svgs) {
  const slug = name.replace(/\.svg$/i, "")
  const source = path.join(SOURCE_DIR, name)
  const target = path.join(OUTPUT_DIR, `${slug}.jpg`)
  await sharp(source, { density: 144 })
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "top" })
    .flatten({ background: "#07060b" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(target)
  const { size } = await stat(target)
  total += size
  console.log(`${slug}.jpg — ${Math.round(size / 1024)} KB`)
}

console.log(
  `\n${svgs.length} OG images written to public/profile-themes/og (${Math.round(total / 1024)} KB total).`,
)
