import { Unzip, UnzipInflate } from "fflate"

/**
 * GitHub-style project sharing from a ZIP archive.
 *
 * The developer picks a `.zip` of their repo; we extract it in the browser
 * (streaming, so `node_modules/` and other junk is skipped BEFORE it is ever
 * decompressed), filter out build artifacts / lockfiles / binaries, then store
 * each kept source file on the VPS.
 *
 * Source files are code, not media, so they are not written to the public media
 * directory: `/api/media/bundle` keeps them private and serves them back as
 * plain-text attachments. Archives are stored the same way, which means no
 * upload in this feature can reach Cloudinary or be executed by a browser.
 */

export interface RepoFileEntry {
  /** Full path inside the archive, e.g. "src/components/App.tsx" */
  path: string
  /** Basename, e.g. "App.tsx" */
  name: string
  /** Directory portion ("" for root-level files) */
  dir: string
  size: number
  /** Mapped display language for syntax highlighting */
  language: string
  /** Raw UTF-8 bytes kept in memory for upload */
  bytes: Uint8Array<ArrayBuffer>
}

export interface UploadedRepoFile {
  path: string
  name: string
  url: string
  size?: number
  language?: string
}

export interface ZipParseResult {
  entries: RepoFileEntry[]
  /** Human-readable reasons for the files that were stripped out. */
  removedReasons: string[]
  removedCount: number
  totalBytes: number
  truncated: boolean
}

/**
 * Progress callback fired during ZIP parsing. `phase` is "read" while the
 * archive bytes are being pushed into the decompressor and "extract" while
 * each kept source file is being finalized.
 */
export type ZipParseProgress = (phase: "read" | "extract", percent: number, label: string) => void

export const REPO_FILE_LIMITS = {
  maxEntries: 300,
  maxFileBytes: 1024 * 1024, // 1MB per source file
  maxTotalBytes: 15 * 1024 * 1024, // 15MB of extracted source
}

export const ZIP_SIZE_LIMITS = {
  normal: 100 * 1024 * 1024, // 100MB for everyone
  pro: 500 * 1024 * 1024, // 500MB for Pro members
}

export function zipSizeLimit(isPro: boolean): number {
  return isPro ? ZIP_SIZE_LIMITS.pro : ZIP_SIZE_LIMITS.normal
}

/* ------------------------------------------------------------------ */
/* Filtering rules                                                     */
/* ------------------------------------------------------------------ */

// Directories that are build output / dependencies / editor cruft — never
// useful to browse on Loop. Matched against any path segment.
const SKIP_DIR_SEGMENTS = [
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".output",
  ".vercel",
  ".netlify",
  "dist",
  "build",
  "out",
  ".turbo",
  ".parcel-cache",
  ".cache",
  ".expo",
  "coverage",
  ".venv",
  "venv",
  "env",
  "__pycache__",
  ".idea",
  ".vscode",
  ".gradle",
  "target",
  "vendor",
  ".pytest_cache",
  ".mypy_cache",
  ".angular",
  ".serverless",
]

const SKIP_FILE_NAMES = [
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.example",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "npm-shrinkwrap.json",
  "composer.lock",
  "poetry.lock",
  "Cargo.lock",
  "go.sum",
  "Gemfile.lock",
]

// Binary formats we never store as browsable source. Kept out BEFORE
// decompression so huge media/generated files never hit memory.
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "heic", "tiff",
  "mp4", "webm", "mov", "mkv", "avi", "wmv", "flv", "m4v", "mp3", "wav",
  "ogg", "flac", "aac", "m4a", "opus", "zip", "rar", "7z", "tar", "gz",
  "bz2", "xz", "jar", "war", "class", "exe", "dll", "so", "dylib", "bin",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "psd", "ai", "eps",
  "woff", "woff2", "ttf", "otf", "eot", "map", "wasm", "pyc", "pyo", "lock",
  "db", "sqlite", "sqlite3", "crx", "iso", "img", "whl", "egg",
])

const LOCKFILE_RE = /\.(lock|lockb)$/i
const LOG_RE = /\.log$/i

function pathSegments(path: string): string[] {
  return path.split("/").filter(Boolean)
}

function shouldSkipPath(path: string): { skip: boolean; reason: string } {
  const normalized = path.replace(/\\/g, "/")
  const segments = pathSegments(normalized)
  const lower = normalized.toLowerCase()

  for (const seg of segments) {
    if (SKIP_DIR_SEGMENTS.includes(seg.toLowerCase())) {
      return { skip: true, reason: `${seg}/ folder (build/dependency cruft)` }
    }
  }

  const basename = segments[segments.length - 1] || ""
  const baseLower = basename.toLowerCase()
  if (SKIP_FILE_NAMES.includes(baseLower) || baseLower.startsWith(".env")) {
    return { skip: true, reason: `${basename} (secrets / environment file)` }
  }
  if (LOCKFILE_RE.test(baseLower) || LOG_RE.test(baseLower)) {
    return { skip: true, reason: `${basename} (lockfile / log)` }
  }

  const ext = baseLower.includes(".") ? baseLower.split(".").pop() || "" : ""
  if (BINARY_EXTENSIONS.has(ext)) {
    return { skip: true, reason: `${ext} files (binary / generated assets)` }
  }

  return { skip: false, reason: "" }
}

/* ------------------------------------------------------------------ */
/* Language mapping                                                    */
/* ------------------------------------------------------------------ */

const EXTENSION_LANGUAGES: Record<string, string> = {
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript",
  py: "Python", go: "Go", rs: "Rust", java: "Java",
  c: "C", h: "C", cpp: "C++", cc: "C++", cxx: "C++", hpp: "C++",
  cs: "C#", php: "PHP", rb: "Ruby", swift: "Swift", kt: "Kotlin",
  html: "HTML", htm: "HTML", css: "CSS", scss: "SCSS", sass: "SCSS", less: "LESS",
  json: "JSON", md: "Markdown", markdown: "Markdown", yml: "YAML", yaml: "YAML",
  sql: "SQL", sh: "Shell", bash: "Shell", zsh: "Shell",
  vue: "Vue", svelte: "Svelte", xml: "XML", svg: "SVG",
  toml: "TOML", ini: "INI", conf: "INI", txt: "Text", dart: "Dart",
  lua: "Lua", r: "R", scala: "Scala", perl: "Perl", haskell: "Haskell",
  dockerfile: "Dockerfile", makefile: "Makefile", tf: "Terraform",
}

export function languageFromPath(path: string): string {
  const lower = path.toLowerCase()
  const basename = path.split("/").pop() || ""
  if (basename === "dockerfile") return "Dockerfile"
  if (basename === "makefile") return "Makefile"
  const ext = basename.includes(".") ? basename.split(".").pop() || "" : ""
  return EXTENSION_LANGUAGES[ext] || "Text"
}

/* ------------------------------------------------------------------ */
/* ZIP parsing (streaming — junk never gets decompressed)              */
/* ------------------------------------------------------------------ */

export async function parseProjectZip(
  file: File,
  onProgress?: ZipParseProgress,
): Promise<ZipParseResult> {
  const buffer = new Uint8Array(await file.arrayBuffer())
  const entries: RepoFileEntry[] = []
  const removedReasons = new Map<string, number>()
  let totalBytes = 0
  let truncated = false

  /**
   * Push the archive in ~8MB slices, yielding to the event loop between
   * slices. Decompression itself is synchronous, but slicing keeps the UI
   * thread breathing and lets us show real extraction progress instead of a
   * frozen spinner — which is what made big (or even medium) archives feel
   * like they were "taking forever".
   */
  const PUSH_CHUNK = 8 * 1024 * 1024
  const tick = () => new Promise<void>((r) => setTimeout(r, 0))

  await new Promise<void>((resolve, reject) => {
    const unzip = new Unzip()
    // fflate does NOT register DEFLATE by default — without this, calling
    // start() on any compressed entry throws "unknown compression type 8".
    unzip.register(UnzipInflate)
    let pendingFiles = 0
    let finalPushed = false
    let totalDiscovered = 0
    let doneDiscovered = 0

    const maybeResolve = () => {
      if (finalPushed && pendingFiles === 0) resolve()
    }

    unzip.onfile = (zf) => {
      const verdict = shouldSkipPath(zf.name)
      if (verdict.skip) {
        removedReasons.set(verdict.reason, (removedReasons.get(verdict.reason) || 0) + 1)
        zf.terminate()
        return
      }
      if (zf.name.endsWith("/")) {
        zf.terminate()
        return
      }
      if (entries.length >= REPO_FILE_LIMITS.maxEntries) {
        truncated = true
        removedReasons.set("Too many files — capped at " + REPO_FILE_LIMITS.maxEntries, 1)
        zf.terminate()
        return
      }

      pendingFiles++
      totalDiscovered++
      const chunks: Uint8Array[] = []
      let size = 0

      zf.ondata = (err, chunk, final) => {
        if (err) {
          reject(err)
          return
        }
        if (chunk) {
          chunks.push(chunk)
          size += chunk.length
        }
        if (final) {
          pendingFiles--
          doneDiscovered++
          // Live per-file progress — the extraction phase now actually paints.
          // Scaled into the 90-100 band so the bar never jumps backwards from
          // the "read" phase (which caps at 95 in the UI).
          const frac = doneDiscovered / Math.max(totalDiscovered, 1)
          onProgress?.(
            "extract",
            Math.min(100, Math.round(90 + frac * 10)),
            `Extracting ${doneDiscovered}/${totalDiscovered} files…`,
          )
          try {
            if (size > REPO_FILE_LIMITS.maxFileBytes) {
              removedReasons.set(`${zf.name} (over 1MB single-file cap)`, 1)
            } else if (totalBytes + size > REPO_FILE_LIMITS.maxTotalBytes) {
              removedReasons.set("Extracted source over 15MB cap", 1)
              truncated = true
            } else {
              const merged = new Uint8Array(size)
              let offset = 0
              for (const c of chunks) {
                merged.set(c, offset)
                offset += c.length
              }
              totalBytes += size
              const cleanPath = zf.name.replace(/^\.\//, "").replace(/^\/+/, "")
              const parts = cleanPath.split("/")
              const name = parts.pop() || "file"
              entries.push({
                path: cleanPath,
                name,
                dir: parts.join("/"),
                size,
                language: languageFromPath(cleanPath),
                bytes: merged,
              })
            }
          } catch (e) {
            reject(e)
            return
          }
          maybeResolve()
        }
      }

      // THE critical call: fflate only emits ondata for a stream after
      // start() is invoked. Without it the archive is fully read (progress
      // hits 100%) but no file is ever decompressed and the promise never
      // resolves — the upload appeared stuck at "Reading archive… 100%".
      try {
        zf.start()
      } catch (e: any) {
        // Unknown compression (LZMA/BZIP2/etc.) — skip the file gracefully.
        pendingFiles--
        doneDiscovered++
        removedReasons.set(`${zf.name} (${e?.message || "unsupported compression"})`, 1)
        try {
          zf.terminate()
        } catch {
          /* ignore */
        }
        maybeResolve()
        return
      }
    }

    const run = async () => {
      try {
        for (let offset = 0; offset < buffer.length; offset += PUSH_CHUNK) {
          const slice = buffer.subarray(offset, Math.min(buffer.length, offset + PUSH_CHUNK))
          unzip.push(slice, offset + slice.length >= buffer.length)
          const pct = Math.min(100, Math.round(((offset + slice.length) / buffer.length) * 100))
          onProgress?.("read", pct, `Reading archive… ${pct}%`)
          // Yield so the dialog can paint progress and the tab stays responsive.
          await tick()
        }
        finalPushed = true
        maybeResolve()
      } catch (err) {
        reject(err as Error)
      }
    }
    void run()
  })

  entries.sort((a, b) => a.path.localeCompare(b.path))
  onProgress?.("extract", 100, `Extracted ${entries.length} file${entries.length === 1 ? "" : "s"}`)

  return {
    entries,
    removedReasons: Array.from(removedReasons.entries()).map(([reason, count]) =>
      count > 1 ? `${reason} (${count} files)` : reason,
    ),
    removedCount: removedReasons.size,
    totalBytes,
    truncated,
  }
}

/* ------------------------------------------------------------------ */
/* Uploading                                                           */
/* ------------------------------------------------------------------ */

function makeFile(bytes: Uint8Array<ArrayBuffer>, name: string, type: string): File {
  return new File([bytes], name, { type })
}

/** Store one source file privately and return its signed download URL. */
async function uploadEntry(
  entry: RepoFileEntry,
  authHeaders: Record<string, string>,
): Promise<string> {
  const res = await fetch("/api/media/bundle", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
      "X-Bundle-Name": encodeURIComponent(entry.path),
      ...authHeaders,
    },
    body: makeFile(entry.bytes, entry.name, "text/plain;charset=utf-8"),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.url) throw new Error(json?.error || `Upload failed (HTTP ${res.status})`)
  return json.url as string
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++
      await worker(items[current], current)
    }
  })
  await Promise.all(runners)
}/**
 * Stores every kept source file privately, then the original ZIP (used for the
 * "Download ZIP" button). Neither is public: code and archives are served back
 * as plain-text attachments through `/api/media/bundle/{token}`.
 */
export async function uploadRepoFiles(
  entries: RepoFileEntry[],
  zipFile: File,
  authHeaders: Record<string, string>,
  onProgress?: (done: number, total: number, label: string) => void,
  onZipPhase?: (label: string, percent: number) => void,
): Promise<{ files: UploadedRepoFile[]; zipUrl: string | null; zipError: string | null }> {
  const files: UploadedRepoFile[] = []
  const failed: string[] = []

  await runWithConcurrency(entries, 6, async (entry) => {
    try {
      const url = await uploadEntry(entry, authHeaders)
      files.push({ path: entry.path, name: entry.name, url, size: entry.size, language: entry.language })
    } catch {
      failed.push(entry.path)
    }

    const done = files.length + failed.length
    const pct = entries.length ? Math.round((done / entries.length) * 100) : 100
    onProgress?.(done, entries.length, `Uploading files… ${pct}% (${done}/${entries.length})`)
  })

  let zipUrl: string | null = null
  let zipError: string | null = null
  if (zipFile.size > 0) {
    try {
      onZipPhase?.("Storing ZIP archive…", 0)
      zipUrl = await uploadZipArchive(zipFile, authHeaders, (pct) => onZipPhase?.("Storing ZIP archive…", pct))
      onZipPhase?.("Archive stored ✓", 100)
    } catch (err: any) {
      zipError = err?.message || "ZIP archive upload failed"
    }
  }

  return { files, zipUrl, zipError }
}

async function uploadZipArchive(
  zipFile: File,
  authHeaders: Record<string, string>,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (!zipFile.size) throw new Error("The archive is empty")
  if (zipFile.size > zipSizeLimit(true)) {
    throw new Error(`Archives are capped at ${Math.round(zipSizeLimit(true) / 1024 / 1024)}MB.`)
  }

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/media/bundle")
    xhr.responseType = "text"
    xhr.withCredentials = true
    xhr.setRequestHeader("Content-Type", "application/zip")
    xhr.setRequestHeader("X-Bundle-Name", encodeURIComponent(zipFile.name || "project.zip"))
    for (const [key, value] of Object.entries(authHeaders || {})) {
      if (key.toLowerCase() === "content-type") continue
      xhr.setRequestHeader(key, value)
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onload = () => {
      let json: any = {}
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : {}
      } catch {
        json = {}
      }
      if (xhr.status >= 200 && xhr.status < 300 && json?.url) {
        onProgress?.(100)
        resolve(json.url as string)
      } else {
        reject(new Error(json?.error || `Upload failed (HTTP ${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error("Network error while uploading the archive"))
    xhr.send(zipFile)
  })
}

/** Counts bytes of text — used to show "X KB of source" in the dialog. */
export function formatRepoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
