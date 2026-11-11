/**
 * Mirror the Telegram animated emoji collection into our public folder.
 *
 * Source: Tarikul-Islam-Anik/Telegram-Animated-Emojis (animated WebP).
 * The telemoji repo is the canonical reference for codepoint naming, but its
 * WebP files are Git LFS pointers (132 bytes), so they cannot be served.
 *
 * Collection files are named after the emoji ("Grinning Face.webp"), so each
 * one is matched to its character through the CLDR names in unicode-emoji-json.
 * Files are resized to 48px / 20 frames (~14KB) and written as
 * `U+1F600.webp`, keeping the Unicode → file mapping canonical.
 *
 * Usage:
 *   node scripts/mirror-animated-emojis.mjs --dry-run
 *   node scripts/mirror-animated-emojis.mjs
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { gunzipSync } from "node:zlib"
import sharp from "sharp"

const REPO = "Tarikul-Islam-Anik/Telegram-Animated-Emojis"
const RAW = `https://raw.githubusercontent.com/${REPO}/main`
const TELEMOJI_LOTTIE = "https://saeedtahmtan.github.io/telemoji/lottie/animated"
const OUT_DIR = path.join(process.cwd(), "public", "emojis", "animated")
const LOTTIE_DIR = path.join(process.cwd(), "public", "emojis", "lottie")
const MANIFEST = path.join(process.cwd(), "lib", "emoji", "animated-emoji-assets.json")

const CATEGORIES = [
  "Smileys",
  "People",
  "Animals and Nature",
  "Food and Drink",
  "Objects",
  "Symbols",
  "Travel and Places",
  "Activity",
]

/** Emoji that also get a Lottie version for large renders / previews. */
const LOTTIE_HEROES = new Set(["😀", "😂", "🔥", "❤️"])

/** Group order used for the picker. */
const GROUP_ORDER = [
  "Smileys & Emotion",
  "People & Body",
  "Animals & Nature",
  "Food & Drink",
  "Activities",
  "Travel & Places",
  "Objects",
  "Symbols",
  "Flags",
]

const dryRun = process.argv.includes("--dry-run")

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** `😀` → `U+1F600`; ZWJ joins keep every part, variation selectors are dropped. */
export function emojiToCodePoints(emoji) {
  return Array.from(emoji)
    .map((char) => char.codePointAt(0))
    .filter((cp) => cp !== 0xfe0f && cp !== 0xfe0e)
    .map((cp) => `U+${cp.toString(16).toUpperCase()}`)
}

const cldr = JSON.parse(
  await fs.readFile(path.join(process.cwd(), "node_modules", "unicode-emoji-json", "data-by-emoji.json"), "utf8"),
)

const byName = new Map()
for (const [emoji, meta] of Object.entries(cldr)) {
  const key = normalize(meta.name)
  if (!byName.has(key)) byName.set(key, emoji)
}

// Collect every collection file once.
const files = []
for (const category of CATEGORIES) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(category)}`, {
    headers: { "user-agent": "loop-emoji-mirror" },
  })
  if (!res.ok) {
    console.error(`listing failed for ${category}: ${res.status}`)
    continue
  }
  const entries = await res.json()
  for (const file of entries) {
    if (!file?.name?.endsWith(".webp")) continue
    files.push({
      category,
      name: file.name.replace(/\.webp$/i, ""),
      downloadUrl: file.download_url,
      fileName: file.name,
    })
  }
}

// Match files → emoji, keeping one file per character.
const matches = []
const seen = new Set()
for (const file of files) {
  const emoji = byName.get(normalize(file.name))
  if (!emoji || seen.has(emoji)) continue
  seen.add(emoji)
  matches.push({ ...file, emoji, group: cldr[emoji]?.group || "Symbols" })
}
matches.sort((a, b) => {
  const ga = GROUP_ORDER.indexOf(a.group)
  const gb = GROUP_ORDER.indexOf(b.group)
  if (ga !== gb) return ga - gb
  return a.name.localeCompare(b.name)
})

console.log(`collection files: ${files.length}, matched emoji: ${matches.length}`)
if (dryRun) {
  const bytes = 0
  console.log(`dry run: would mirror ${matches.length} emoji (${bytes} bytes)`)
  process.exit(0)
}

await fs.mkdir(OUT_DIR, { recursive: true })
await fs.mkdir(LOTTIE_DIR, { recursive: true })
await fs.mkdir(path.dirname(MANIFEST), { recursive: true })

const manifest = {}
let totalBytes = 0
let cursor = 0

async function mirrorOne(match) {
  const filename = `${emojiToCodePoints(match.emoji).join("_")}.webp`
  const target = path.join(OUT_DIR, filename)

  // Re-runs skip work already done, so an interrupted mirror can resume.
  const existing = await fs.stat(target).catch(() => null)
  if (existing?.size) {
    totalBytes += existing.size
    manifest[match.emoji] = {
      file: filename,
      name: cldr[match.emoji]?.name || match.name,
      group: match.group,
      cdn: `${RAW}/${match.category.replace(/ /g, "%20")}/${encodeURIComponent(match.fileName)}`,
    }
    return
  }

  const download = await fetch(match.downloadUrl)
  if (!download.ok) {
    console.error(`download failed ${match.name}: ${download.status}`)
    return
  }
  const input = Buffer.from(await download.arrayBuffer())
  const meta = await sharp(input, { animated: true }).metadata()
  const pages = meta.pages ? Math.min(20, meta.pages) : undefined
  const output = await sharp(input, pages ? { animated: true, pages } : { animated: true })
    .resize({
      width: 48,
      height: 48,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 32, alphaQuality: 40, effort: 6, loop: 0 })
    .toBuffer()
  await fs.writeFile(target, output)
  totalBytes += output.byteLength

  const entry = {
    file: filename,
    name: cldr[match.emoji]?.name || match.name,
    group: match.group,
    cdn: `${RAW}/${match.category.replace(/ /g, "%20")}/${encodeURIComponent(match.fileName)}`,
  }

  if (LOTTIE_HEROES.has(match.emoji)) {
    try {
      const lottieName = `${emojiToCodePoints(match.emoji).join("_")}_1.json`
      const res = await fetch(`${TELEMOJI_LOTTIE}/${encodeURIComponent(lottieName)}`)
      if (res.ok) {
        let buf = Buffer.from(await res.arrayBuffer())
        // telemoji serves pre-compressed bytes without a Content-Encoding header.
        if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf)
        const json = JSON.parse(buf.toString("utf8"))
        if (json && Array.isArray(json.layers)) {
          await fs.writeFile(path.join(LOTTIE_DIR, `${emojiToCodePoints(match.emoji).join("_")}.json`), JSON.stringify(json))
          entry.lottie = `${emojiToCodePoints(match.emoji).join("_")}.json`
        }
      }
    } catch {
      /* Lottie is a bonus, never block the WebP mirror. */
    }
  }

  manifest[match.emoji] = entry
}

const CONCURRENCY = 10
async function worker() {
  while (cursor < matches.length) {
    const index = cursor++
    const match = matches[index]
    try {
      await mirrorOne(match)
    } catch (err) {
      console.error(`failed ${match.name}:`, err?.message || err)
    }
    if ((index + 1) % 50 === 0) console.log(`mirrored ${index + 1}/${matches.length}`)
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))

await fs.writeFile(
  MANIFEST,
  `${JSON.stringify(
    {
      generatedFrom: REPO,
      note: "Generated by scripts/mirror-animated-emojis.mjs. Do not hand-edit.",
      emojis: manifest,
    },
    null,
    2,
  )}\n`,
)

const mirrored = Object.keys(manifest).length
console.log(`\nmirrored ${mirrored}/${matches.length} emoji, ${(totalBytes / 1024 / 1024).toFixed(1)}MB total`)
