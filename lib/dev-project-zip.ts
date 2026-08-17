import { Unzip, UnzipInflate } from "fflate"
import { uploadMediaFile } from "@/lib/client-media-upload"

/**
 * GitHub-style project sharing from a ZIP archive.
 *
 * The developer picks a `.zip` of their repo; we extract it in the browser
 * (streaming, so `node_modules/` and other junk is skipped BEFORE it is ever
 * decompressed), filter out build artifacts / lockfiles / binaries, then
 * upload each kept source file to Cloudinary and persist the arranged file
 * tree on the developer_projects row.
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

async function uploadEntry(
  entry: RepoFileEntry,
  authHeaders: Record<string, string>,
): Promise<string> {
  const file = makeFile(entry.bytes, entry.name, "text/plain;charset=utf-8")
  const result = await uploadMediaFile(file, {
    type: "file",
    folder: "developer-projects",
    authHeaders,
    maxSizeBytes: REPO_FILE_LIMITS.maxFileBytes,
    forceDirect: true,
  })
  return result.url
}

interface DirectUploadSign {
  signature: string
  apiKey: string
  timestamp: string
  cloudName: string
  folder: string
  resourceType: string
}

/**
 * Signs one Cloudinary upload session that can be reused for the whole batch
 * of extracted source files. A single signature is valid for any number of
 * uploads with identical params (same folder + timestamp), so we avoid the
 * per-file serverless proxy round-trip that made small zips feel slow.
 */
async function signDirectUpload(
  authHeaders: Record<string, string>,
): Promise<DirectUploadSign | null> {
  try {
    const signRes = await fetch("/api/upload/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ type: "file", folder: "developer-projects" }),
    })
    const { data: sign } = await signRes.json().catch(() => ({}))
    if (!signRes.ok || !sign?.signature || !sign?.cloudName) return null
    return {
      signature: String(sign.signature),
      apiKey: String(sign.apiKey),
      timestamp: String(sign.timestamp),
      cloudName: String(sign.cloudName),
      folder: String(sign.folder),
      resourceType: String(sign.resourceType || "auto"),
    }
  } catch {
    return null
  }
}

async function uploadEntryDirect(
  entry: RepoFileEntry,
  sign: DirectUploadSign,
): Promise<string> {
  const form = new FormData()
  form.append("file", makeFile(entry.bytes, entry.name, "text/plain;charset=utf-8"))
  form.append("api_key", sign.apiKey)
  form.append("timestamp", sign.timestamp)
  form.append("signature", sign.signature)
  form.append("folder", sign.folder)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sign.cloudName}/${sign.resourceType}/upload`,
    { method: "POST", body: form },
  )
  const raw = await res.text()
  let json: any = {}
  try {
    json = raw ? JSON.parse(raw) : {}
  } catch {
    // ignore parse error
  }
  if (!res.ok || !json?.secure_url) {
    throw new Error(json?.error?.message || `Upload failed (HTTP ${res.status})`)
  }
  return json.secure_url as string
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
}

/**
 * Uploads every kept source file to Cloudinary, then the original ZIP (used
 * for the "Download ZIP" button). The ZIP goes through the signed direct
 * upload path; archives over 100MB use Cloudinary's chunked large-upload API.
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

  // Sign ONCE up front, then push every extracted source file straight to
  // Cloudinary in parallel. Source files are small text blobs, so a single
  // signed session is enough — no per-file proxy hop through the API route.
  const sign = await signDirectUpload(authHeaders)

  await runWithConcurrency(entries, 10, async (entry) => {
    try {
      let url: string | null = null
      if (sign) {
        try {
          url = await uploadEntryDirect(entry, sign)
        } catch {
          url = null
        }
      }
      if (!url) {
        url = await uploadEntry(entry, authHeaders)
      }
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
  // <= 100MB: standard signed direct upload (uploadMediaFile proxies
  // anything >3.5MB straight to Cloudinary).
  if (zipFile.size <= 100 * 1024 * 1024) {
    const result = await uploadMediaFile(zipFile, {
      type: "file",
      folder: "developer-projects",
      authHeaders,
      maxSizeBytes: zipSizeLimit(true),
    })
    onProgress?.(100)
    return result.url
  }

  // >100MB: chunked large upload (Cloudinary X-Unique-Upload-Id + ranges).
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ type: "file", folder: "developer-projects" }),
  })
  const { data: sign } = await signRes.json().catch(() => ({}))
  if (!signRes.ok || !sign?.signature || !sign?.cloudName) {
    throw new Error(sign?.error || "Could not sign large upload")
  }

  const chunkSize = 20 * 1024 * 1024
  const total = zipFile.size
  const uniqueId = crypto.randomUUID()
  const baseUrl = `https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`
  const params = new URLSearchParams({
    api_key: String(sign.apiKey),
    timestamp: String(sign.timestamp),
    signature: String(sign.signature),
    folder: String(sign.folder),
  })

  let lastResponse: any = null
  for (let start = 0; start < total; start += chunkSize) {
    const end = Math.min(total, start + chunkSize)
    const chunk = zipFile.slice(start, end)
    const res = await fetch(`${baseUrl}?${params.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Unique-Upload-Id": uniqueId,
        "Content-Range": `bytes ${start}-${end - 1}/${total}`,
      },
      body: chunk,
    })
    const raw = await res.text()
    let json: any = {}
    try {
      json = raw ? JSON.parse(raw) : {}
    } catch {
      // ignore
    }
    if (!res.ok) {
      throw new Error(json?.error?.message || json?.error || `Upload failed (HTTP ${res.status})`)
    }
    lastResponse = json
    onProgress?.(Math.min(99, Math.round(((start + chunkSize) / total) * 100)))
  }

  if (!lastResponse?.secure_url) {
    throw new Error("Upload finished without a file URL")
  }
  onProgress?.(100)
  return lastResponse.secure_url as string
}

/** Counts bytes of text — used to show "X KB of source" in the dialog. */
export function formatRepoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
