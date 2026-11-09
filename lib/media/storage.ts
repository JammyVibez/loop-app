import "server-only"
import { randomBytes } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import type { MediaFamily } from "./magic"

/**
 * Where uploaded media lives and how it is addressed.
 *
 * Files are written outside the application checkout (default
 * `/var/loop-uploads`) so a deploy, `rm -rf .next` or a git clean never touches
 * them, and so Nginx — not the Next.js process — can serve them straight from
 * disk. Layout is `{kind}/{yyyy}/{mm}/{random-name}.{ext}`; original filenames
 * are never used, which makes every URL safe to cache immutably.
 *
 * Public URLs are relative (`/media/...`) by default so the app works on any
 * hostname; `MEDIA_PUBLIC_BASE` can point them at a dedicated hostname for
 * rendering absolute URLs in OG cards and push payloads.
 */

const DEFAULT_ROOT = "/var/loop-uploads"
const TMP_DIR_NAME = ".incoming"

export const MEDIA_URL_BASE = (process.env.MEDIA_PUBLIC_BASE || "/media").replace(/\/+$/, "")

export function mediaRoot(): string {
  return path.resolve(process.env.MEDIA_STORAGE_ROOT || DEFAULT_ROOT)
}

export function tmpRoot(): string {
  return path.join(mediaRoot(), TMP_DIR_NAME)
}

const KIND_DIR: Record<MediaFamily, string> = {
  image: "images",
  vector: "images",
  animation: "images",
  video: "videos",
  audio: "audio",
}

export const ALLOWED_KINDS = ["images", "videos", "audio", "files"] as const

export function kindDirFor(family: MediaFamily): string {
  return KIND_DIR[family] || "files"
}

/** 16 random bytes — collision-free enough to cache forever. */
export function randomName(): string {
  return randomBytes(16).toString("hex")
}

/** `images/2026/11/abcdef...webp` */
export function buildStoragePath(family: MediaFamily, ext: string, now = new Date()): string {
  const year = String(now.getUTCFullYear())
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return [kindDirFor(family), year, month, `${randomName()}.${ext.replace(/^\./, "")}`].join("/")
}

/** Resolve a stored relative path to disk, refusing anything outside the root. */
export function absolutePath(relativePath: string): string {
  const root = mediaRoot()
  const normalized = relativePath.replace(/^\/+/, "").replace(/\\/g, "/")
  if (normalized.split("/").some((segment) => segment === ".." || segment === "" || segment.startsWith("."))) {
    throw new Error("Invalid media path")
  }
  const resolved = path.resolve(root, normalized)
  if (!resolved.startsWith(root + path.sep)) throw new Error("Invalid media path")
  return resolved
}

/**
 * Resolve an internal path (`.incoming/...`) that never becomes public.
 * Upload sources live here while a transcode is queued, and Nginx refuses
 * anything under a dot-directory.
 */
export function internalAbsolutePath(relativePath: string): string {
  const root = mediaRoot()
  const normalized = relativePath.replace(/^\/+/, "").replace(/\\/g, "/")
  if (!normalized.startsWith(`${TMP_DIR_NAME}/`) || normalized.split("/").includes("..")) {
    throw new Error("Invalid internal media path")
  }
  const resolved = path.resolve(root, normalized)
  if (!resolved.startsWith(root + path.sep)) throw new Error("Invalid internal media path")
  return resolved
}

/** Same check for paths that arrive from the database rather than a request. */
export function isInsideMediaRoot(absolute: string): boolean {
  const root = mediaRoot()
  const resolved = path.resolve(absolute)
  return resolved === root || resolved.startsWith(root + path.sep)
}

export function publicUrl(storagePath: string): string {
  return `${MEDIA_URL_BASE}/${storagePath.replace(/^\/+/, "")}`
}

/** Turn a stored path or `/media/...` URL into an absolute URL for servers. */
export function absoluteMediaUrl(urlOrPath: string, origin?: string): string {
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath
  const base = /^https?:\/\//i.test(MEDIA_URL_BASE)
    ? MEDIA_URL_BASE
    : `${(origin || process.env.NEXT_PUBLIC_APP_URL || "https://loopapp.me").replace(/\/+$/, "")}${MEDIA_URL_BASE}`
  const pathPart = urlOrPath.startsWith(MEDIA_URL_BASE)
    ? urlOrPath.slice(MEDIA_URL_BASE.length)
    : urlOrPath.replace(/^\/media/, "")
  return `${base.replace(/\/+$/, "")}/${pathPart.replace(/^\/+/, "")}`
}

/** Hosts whose `/media/*` paths are ours (app origin and the media base). */
function mediaHosts(): string[] {
  const hosts = ["loopapp.me", "www.loopapp.me"]
  for (const raw of [process.env.NEXT_PUBLIC_APP_URL, MEDIA_URL_BASE]) {
    if (!raw || !/^https?:\/\//i.test(raw)) continue
    try {
      const host = new URL(raw).host.toLowerCase()
      if (!hosts.includes(host)) hosts.push(host)
    } catch {
      /* ignore malformed base */
    }
  }
  return hosts
}

export function isOurMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (url.startsWith(`${MEDIA_URL_BASE}/`)) return true
  if (/^https?:\/\//i.test(MEDIA_URL_BASE) && url.startsWith(`${MEDIA_URL_BASE}/`)) return true
  // Absolute self URLs (OG cards, push payloads, a media base added later) must
  // still be recognised so deleting a post removes its files — but only for our
  // own hosts, so `https://example.com/media/x.jpg` is never treated as ours.
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url)
      return mediaHosts().includes(parsed.host.toLowerCase()) && parsed.pathname.startsWith("/media/")
    } catch {
      return false
    }
  }
  return false
}

/** Extract the storage-relative path from one of our public URLs. */
export function storagePathFromUrl(url: string): string | null {
  if (!isOurMediaUrl(url)) return null
  let pathPart = url
  if (/^https?:\/\//i.test(url)) {
    try {
      pathPart = new URL(url).pathname
    } catch {
      return null
    }
  }
  let markerPath = "/media/"
  if (/^https?:\/\//i.test(MEDIA_URL_BASE)) {
    try {
      markerPath = `${new URL(MEDIA_URL_BASE).pathname.replace(/\/+$/, "")}/`
    } catch {
      markerPath = "/media/"
    }
  }
  const marker = pathPart.indexOf(markerPath)
  if (marker === -1) return null
  const clean = pathPart.slice(marker + markerPath.length).split("?")[0].split("#")[0].replace(/^\/+/, "")
  return clean || null
}

export async function ensureMediaDirs(): Promise<void> {
  const root = mediaRoot()
  await fs.mkdir(root, { recursive: true })
  await fs.mkdir(tmpRoot(), { recursive: true })
  for (const kind of ["images", "videos", "audio", "files"]) {
    await fs.mkdir(path.join(root, kind), { recursive: true })
  }
}

export type DiskUsage = {
  root: string
  totalBytes: number
  freeBytes: number
  usedBytes: number
  usedPercent: number
  available: boolean
  error?: string
}

/**
 * Filesystem usage for the media volume. `statfs` reports the filesystem that
 * backs the storage root, which is the number that matters for "will the VPS
 * run out of space" — not the size of the app checkout.
 */
export async function getDiskUsage(): Promise<DiskUsage> {
  const root = mediaRoot()
  // `statfs` is Node 18.15+; the cast keeps older @types/node from failing the
  // build while the runtime check below still covers a missing implementation.
  const statfs = (fs as unknown as { statfs?: (path: string) => Promise<any> }).statfs
  if (!statfs) {
    return { root, totalBytes: 0, freeBytes: 0, usedBytes: 0, usedPercent: 0, available: false, error: "statfs unavailable" }
  }
  try {
    const stats = await statfs(root)
    const blockSize = Number(stats.bsize)
    const totalBytes = Number(stats.blocks) * blockSize
    const freeBytes = Number(stats.bavail) * blockSize
    const usedBytes = Math.max(0, totalBytes - freeBytes)
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0
    return { root, totalBytes, freeBytes, usedBytes, usedPercent, available: true }
  } catch (error) {
    // The root may not exist yet (fresh VPS). Report unavailable rather than
    // blocking uploads — the write itself will fail loudly if it is truly gone.
    try {
      await ensureMediaDirs()
      const stats = await statfs(root)
      const blockSize = Number(stats.bsize)
      const totalBytes = Number(stats.blocks) * blockSize
      const freeBytes = Number(stats.bavail) * blockSize
      const usedBytes = Math.max(0, totalBytes - freeBytes)
      return {
        root,
        totalBytes,
        freeBytes,
        usedBytes,
        usedPercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
        available: true,
      }
    } catch (inner) {
      return {
        root,
        totalBytes: 0,
        freeBytes: 0,
        usedBytes: 0,
        usedPercent: 0,
        available: false,
        error: inner instanceof Error ? inner.message : String(inner ?? error),
      }
    }
  }
}

/** Total bytes currently stored on disk under the media root. */
export async function measureStorageBytes(): Promise<{ bytes: number; files: number }> {
  let bytes = 0
  let files = 0
  const walk = async (dir: string) => {
    let entries: import("node:fs").Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(full)
          bytes += stat.size
          files += 1
        } catch {
          /* ignore vanished files */
        }
      }
    }
  }
  await walk(mediaRoot())
  return { bytes, files }
}
