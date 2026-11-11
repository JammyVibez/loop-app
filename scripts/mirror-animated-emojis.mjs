/**
 * Mirror the most-used Telegram animated emojis into our own public folder.
 *
 * Source: Tarikul-Islam-Anik/Telegram-Animated-Emojis (animated WebP).
 * The telemoji repo is the canonical reference for codepoint naming, but its
 * WebP files are Git LFS pointers (132 bytes), so it cannot be served directly.
 *
 * Each file is resized to 96px and re-encoded as an animated WebP (~10-40KB),
 * then written as `U+1F600.webp` so the Unicode → file mapping stays canonical.
 * A manifest maps the emoji character to its local file and CDN fallback.
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

/** [emoji, Telegram asset name, use Lottie for large renders] */
const CURATED = [
  ["😀", "Grinning Face", true],
  ["😃", "Grinning Face With Big Eyes"],
  ["😄", "Grinning Face With Smiling Eyes"],
  ["😁", "Beaming Face With Smiling Eyes"],
  ["😂", "Face With Tears Of Joy", true],
  ["😊", "Smiling Face With Smiling Eyes"],
  ["🥰", "Smiling Face With Hearts"],
  ["😎", "Smiling Face With Sunglasses"],
  ["🤔", "Thinking Face"],
  ["😭", "Loudly Crying Face"],
  ["😡", "Pouting Face"],
  ["🥳", "Partying Face"],
  ["🤩", "Star-Struck"],
  ["😴", "Sleeping Face"],
  ["🤯", "Exploding Head"],
  ["😅", "Grinning Face With Sweat"],
  ["😇", "Smiling Face With Halo"],
  ["🤗", "Hugging Face"],
  ["😱", "Face Screaming In Fear"],
  ["🙃", "Upside-Down Face"],
  ["😘", "Face Blowing A Kiss"],
  ["😢", "Crying Face"],
  ["😤", "Face With Steam From Nose"],
  ["🥺", "Pleading Face"],
  ["😬", "Grimacing Face"],
  ["😉", "Winking Face"],
  ["😮", "Face With Open Mouth"],
  ["😲", "Astonished Face"],
  ["🤢", "Nauseated Face"],
  ["🤮", "Face Vomiting"],
  ["💀", "Skull"],
  ["👻", "Ghost"],
  ["💩", "Pile Of Poo"],
  ["🤡", "Clown Face"],
  ["👽", "Alien"],
  ["🤖", "Robot"],
  ["👋", "Waving Hand"],
  ["👍", "Thumbs Up"],
  ["👎", "Thumbs Down"],
  ["👏", "Clapping Hands"],
  ["🙌", "Raising Hands"],
  ["🙏", "Folded Hands"],
  ["💪", "Flexed Biceps"],
  ["🤝", "Handshake"],
  ["👀", "Eyes"],
  ["🤞", "Crossed Fingers"],
  ["✌️", "Victory Hand"],
  ["🫶", "Heart Hands"],
  ["🐱", "Cat Face"],
  ["🐶", "Dog Face"],
  ["🦊", "Fox"],
  ["🦁", "Lion"],
  ["🦄", "Unicorn"],
  ["🐼", "Panda"],
  ["🐸", "Frog"],
  ["🌈", "Rainbow"],
  ["🌸", "Cherry Blossom"],
  ["🍀", "Four Leaf Clover"],
  ["🌹", "Rose"],
  ["🌙", "Crescent Moon"],
  ["☀️", "Sun"],
  ["⭐", "Star"],
  ["✨", "Sparkles"],
  ["🔥", "Fire", true],
  ["🍕", "Pizza"],
  ["🍔", "Hamburger"],
  ["☕", "Hot Beverage"],
  ["🍩", "Doughnut"],
  ["🍷", "Wine Glass"],
  ["🍓", "Strawberry"],
  ["🎂", "Birthday Cake"],
  ["🎉", "Party Popper"],
  ["🎊", "Confetti Ball"],
  ["🏆", "Trophy"],
  ["🚀", "Rocket"],
  ["⚡", "High Voltage"],
  ["💎", "Gem Stone"],
  ["💰", "Money Bag"],
  ["🪙", "Coin"],
  ["❤️", "Red Heart", true],
  ["🧡", "Orange Heart"],
  ["💛", "Yellow Heart"],
  ["💚", "Green Heart"],
  ["💙", "Blue Heart"],
  ["💜", "Purple Heart"],
  ["🖤", "Black Heart"],
  ["🤍", "White Heart"],
  ["💖", "Sparkling Heart"],
  ["💔", "Broken Heart"],
  ["💯", "Hundred Points"],
  ["🔮", "Crystal Ball"],
  ["✅", "Check Mark Button"],
  ["❌", "Cross Mark"],
  ["💡", "Light Bulb"],
  ["👑", "Crown"],
  ["🎵", "Musical Note"],
]

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

const dryRun = process.argv.includes("--dry-run")

const listings = new Map()
for (const category of CATEGORIES) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(category)}`, {
    headers: { "user-agent": "loop-emoji-mirror" },
  })
  if (!res.ok) {
    console.error(`listing failed for ${category}: ${res.status}`)
    continue
  }
  const files = await res.json()
  for (const file of files) {
    if (!file?.name?.endsWith(".webp")) continue
    listings.set(`${category}/${file.name.replace(/\.webp$/i, "")}`, file)
  }
}

await fs.mkdir(OUT_DIR, { recursive: true })
await fs.mkdir(LOTTIE_DIR, { recursive: true })
await fs.mkdir(path.dirname(MANIFEST), { recursive: true })

const manifest = {}
const missing = []

for (const [emoji, name, preferLottie = false] of CURATED) {
  const wanted = normalize(name)
  let match = [...listings.entries()].find(([key]) => normalize(path.basename(key)) === wanted)
  if (!match) {
    match = [...listings.entries()].find(([key]) => normalize(path.basename(key)).startsWith(wanted))
  }
  if (!match) {
    match = [...listings.entries()].find(([key]) => normalize(path.basename(key)).includes(wanted))
  }
  if (!match) {
    missing.push(`${emoji} ${name}`)
    continue
  }

  const [key, file] = match
  const filename = `${emojiToCodePoints(emoji).join("_")}.webp`
  const target = path.join(OUT_DIR, filename)

  if (dryRun) {
    manifest[emoji] = { file: filename, name, cdn: `${RAW}/${key.split("/")[0]}.webp` }
    continue
  }

  const download = await fetch(file.download_url)
  if (!download.ok) {
    missing.push(`${emoji} ${name} (download ${download.status})`)
    continue
  }
  const input = Buffer.from(await download.arrayBuffer())
  // Some Telegram emoji have fewer than 32 frames; asking for more pages than
  // the file holds makes libwebp reject the decode.
  const meta = await sharp(input, { animated: true }).metadata()
  const pages = meta.pages ? Math.min(32, meta.pages) : undefined
  const output = await sharp(input, pages ? { animated: true, pages } : { animated: true })
    .resize({
      width: 64,
      height: 64,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    // 32 frames keeps a ~1s loop while cutting each file to ~30KB.
    .webp({ quality: 36, alphaQuality: 45, effort: 6, loop: 0 })
    .toBuffer()
  await fs.writeFile(target, output)

  const entry = {
    file: filename,
    name,
    cdn: `${RAW}/${key.split("/")[0].replace(/ /g, "%20")}/${encodeURIComponent(file.name)}`,
    bytes: output.byteLength,
  }

  // A handful of hero emoji also get a Lottie version for large renders.
  if (preferLottie) {
    try {
      const lottieName = `${emojiToCodePoints(emoji).join("_")}_1.json`
      const res = await fetch(`${TELEMOJI_LOTTIE}/${encodeURIComponent(lottieName)}`)
      if (res.ok) {
        let buf = Buffer.from(await res.arrayBuffer())
        // telemoji serves pre-compressed bytes without a Content-Encoding header.
        if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf)
        const json = JSON.parse(buf.toString("utf8"))
        if (json && Array.isArray(json.layers)) {
          await fs.writeFile(path.join(LOTTIE_DIR, `${emojiToCodePoints(emoji).join("_")}.json`), JSON.stringify(json))
          entry.lottie = `${emojiToCodePoints(emoji).join("_")}.json`
        }
      }
    } catch {
      /* Lottie is a bonus, never block the WebP mirror. */
    }
  }

  manifest[emoji] = entry
  console.log(`${emoji} ${name} -> ${filename} (${(output.byteLength / 1024).toFixed(1)}KB)`)
}

if (dryRun) {
  console.log(`dry run: matched ${Object.keys(manifest).length}/${CURATED.length}`)
  if (missing.length) console.log(`missing:\n  ${missing.join("\n  ")}`)
  process.exit(0)
}

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

console.log(`\nmirrored ${Object.keys(manifest).length}/${CURATED.length} emoji`)
if (missing.length) console.log(`missing:\n  ${missing.join("\n  ")}`)
