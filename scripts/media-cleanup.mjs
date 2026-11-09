#!/usr/bin/env node
// Weekly orphan sweep for the VPS media store.
//
// Deletes files that no media_uploads row references (for example an upload
// interrupted between "write" and "insert"), source files left behind by failed
// transcodes, and empty date directories. Files younger than --min-age-hours
// are never touched, so an upload in flight cannot be mistaken for an orphan.
//
//   node scripts/media-cleanup.mjs --dry-run
//   node scripts/media-cleanup.mjs
//
// Env: DATABASE_URL (or SUPABASE_DB_URL), MEDIA_STORAGE_ROOT (default
// /var/loop-uploads). Exit code is non-zero when the sweep fails.

import { promises as fs } from "node:fs"
import path from "node:path"
import pg from "pg"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const minAgeHours = Number(
  (args.find((arg) => arg.startsWith("--min-age-hours=")) || "").split("=")[1] || 24,
)
const root = path.resolve(process.env.MEDIA_STORAGE_ROOT || "/var/loop-uploads")
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

if (!databaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required.")
  process.exit(1)
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
await client.connect()

let removedFiles = 0
let removedBytes = 0
let removedDirs = 0

async function knownPaths() {
  const known = new Set()
  const { rows } = await client.query(
    "select storage_path, source_path from media_uploads where storage_path is not null or source_path is not null",
  )
  for (const row of rows) {
    if (row.storage_path) known.add(path.resolve(root, row.storage_path))
    if (row.source_path) known.add(path.resolve(root, row.source_path))
  }
  // Any rendition sharing a stored basename belongs to that row. Variant
  // suffixes are spelled out so `abc-1024.webp` is not mistaken for an orphan
  // when the row points at `abc.webp`.
  const bases = new Set()
  for (const absolute of known) {
    const base = absolute.replace(/\.[^.]+$/, "")
    bases.add(base)
    for (const suffix of ["-thumb", "-480", "-1024", "-poster"]) bases.add(`${base}${suffix}`)
  }
  return { known, bases }
}

async function walk(dir, visit) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, visit)
    } else if (entry.isFile()) {
      await visit(full, entry.name)
    }
  }
}

const { known, bases } = await knownPaths()
const cutoff = Date.now() - minAgeHours * 3600_000

for (const kind of ["images", "videos", "audio", "files"]) {
  await walk(path.join(root, kind), async (full) => {
    const base = full.replace(/\.[^.]+$/, "")
    if (known.has(full) || bases.has(base)) return
    let stat
    try {
      stat = await fs.stat(full)
    } catch {
      return
    }
    if (stat.mtimeMs > cutoff) return
    if (!dryRun) await fs.rm(full, { force: true })
    removedFiles += 1
    removedBytes += stat.size
  })
}

// Abandoned chunked uploads (`.part` files) sit in `.incoming` itself. A day is
// long enough for a mobile connection to resume; after that they are dead.
const incomingDir = path.join(root, ".incoming")
let incoming = []
try {
  incoming = await fs.readdir(incomingDir, { withFileTypes: true })
} catch {
  /* no temp dir yet */
}
for (const entry of incoming) {
  if (!entry.isFile()) continue
  const full = path.join(incomingDir, entry.name)
  let stat
  try {
    stat = await fs.stat(full)
  } catch {
    continue
  }
  if (stat.mtimeMs > Date.now() - 24 * 3600_000) continue
  if (!dryRun) await fs.rm(full, { force: true })
  removedFiles += 1
  removedBytes += stat.size
}

// Sources belong to jobs that failed; keep a week to allow a retry after an
// ffmpeg fix, then reclaim the space.
const sourceDir = path.join(root, ".incoming", "sources")
await walk(sourceDir, async (full) => {
  let stat
  try {
    stat = await fs.stat(full)
  } catch {
    return
  }
  if (stat.mtimeMs > Date.now() - 7 * 24 * 3600_000) return
  if (!dryRun) await fs.rm(full, { force: true })
  removedFiles += 1
  removedBytes += stat.size
})

// Remove empty YYYY/MM directories (leave the roots themselves).
for (const kind of ["images", "videos", "audio", "files"]) {
  const kindDir = path.join(root, kind)
  let years = []
  try {
    years = await fs.readdir(kindDir, { withFileTypes: true })
  } catch {
    continue
  }
  for (const year of years.filter((entry) => entry.isDirectory())) {
    const yearDir = path.join(kindDir, year.name)
    const months = await fs.readdir(yearDir, { withFileTypes: true }).catch(() => [])
    for (const month of months.filter((entry) => entry.isDirectory())) {
      const monthDir = path.join(yearDir, month.name)
      const remaining = await fs.readdir(monthDir).catch(() => [])
      if (remaining.length === 0) {
        if (!dryRun) await fs.rmdir(monthDir).catch(() => {})
        removedDirs += 1
      }
    }
  }
}

await client.end()

console.log(
  `${dryRun ? "[dry run] " : ""}media cleanup: ${removedFiles} file(s), ${(removedBytes / 1024 / 1024).toFixed(1)}MB, ${removedDirs} empty dir(s) under ${root}`,
)
