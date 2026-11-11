/**
 * Generate the full standard emoji library for the picker.
 *
 * Source: unicode-emoji-json (CLDR names + groups). The output is a compact
 * static JSON under public/ so the picker can lazy-fetch it on open instead of
 * shipping ~1900 emoji names in the JS bundle.
 *
 * Usage: node scripts/generate-standard-emoji.mjs
 */
import { promises as fs } from "node:fs"
import path from "node:path"

const data = JSON.parse(
  await fs.readFile(path.join(process.cwd(), "node_modules", "unicode-emoji-json", "data-by-emoji.json"), "utf8"),
)

const GROUP_LABELS = {
  "Smileys & Emotion": "Smileys",
  "People & Body": "People",
  "Component": "Components",
  "Animals & Nature": "Nature",
  "Food & Drink": "Food",
  "Travel & Places": "Travel",
  "Activities": "Activity",
  "Objects": "Objects",
  Symbols: "Symbols",
  Flags: "Flags",
}

const groups = new Map()
for (const [emoji, meta] of Object.entries(data)) {
  if (meta.group === "Component") continue
  const id = meta.group.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  if (!groups.has(id)) groups.set(id, { id, label: GROUP_LABELS[meta.group] || meta.group, emojis: [] })
  // [character, CLDR name] — the name doubles as the search index.
  groups.get(id).emojis.push([emoji, meta.name])
}

const payload = {
  generatedFrom: "unicode-emoji-json",
  groups: [...groups.values()],
}

const target = path.join(process.cwd(), "public", "emojis", "standard-emoji.json")
await fs.mkdir(path.dirname(target), { recursive: true })
await fs.writeFile(target, JSON.stringify(payload))

const count = payload.groups.reduce((sum, group) => sum + group.emojis.length, 0)
const stats = await fs.stat(target)
console.log(`wrote ${count} emoji in ${payload.groups.length} groups (${(stats.size / 1024).toFixed(0)}KB)`)
