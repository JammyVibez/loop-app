import "server-only"
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { mediaRoot, tmpRoot } from "./storage"
import { UploadError } from "./upload-service"

/**
 * Private bundles for the developer-project importer.
 *
 * Source files and zip archives are code, not media: the upload policy refuses
 * them everywhere else, and they must never be reachable as a public URL that
 * a browser could execute. They are stored under `.private/bundles` (Nginx
 * refuses dot-directories, and nothing maps this path to `/media`), then read
 * back through an authenticated route that always answers `text/plain` with
 * `Content-Disposition: attachment` and `nosniff`.
 *
 * Links are stateless HMAC tokens, so no extra table is needed and a token can
 * never be edited into a path traversal.
 */

const MAX_BUNDLE_BYTES = 510 * 1024 * 1024

function signingSecret(): string {
  return process.env.MEDIA_BUNDLE_SECRET || process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "loop-local-bundle-secret"
}

function privateRoot(): string {
  return path.join(mediaRoot(), ".private", "bundles")
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url")
}

export function encodeBundleToken(relativePath: string): string {
  const payload = Buffer.from(relativePath, "utf8").toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function decodeBundleToken(token: string): string | null {
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null
  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8")
    if (!decoded.startsWith("bundles/") || decoded.includes("..")) return null
    return decoded
  } catch {
    return null
  }
}

export function bundleUrl(relativePath: string): string {
  return `/api/media/bundle/${encodeBundleToken(relativePath)}`
}

function safeName(name: string): string {
  return (name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file"
}

export type SavedBundle = { token: string; url: string; size: number; path: string }

/** Store one project source file or archive. Only authenticated project uploads call this. */
export async function saveBundle(
  body: ReadableStream<Uint8Array> | null,
  options: { filename: string; contentLength?: number },
): Promise<SavedBundle> {
  if (!body) throw new UploadError("No file was received.", 400, "missing_body")
  if ((options.contentLength || 0) > MAX_BUNDLE_BYTES) {
    throw new UploadError("Project archives are capped at 500MB.", 413, "too_large")
  }

  const now = new Date()
  const dir = `bundles/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  const absoluteDir = path.join(privateRoot(), String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"))
  await fs.mkdir(absoluteDir, { recursive: true })
  await fs.mkdir(tmpRoot(), { recursive: true })

  const base = `${randomBytes(12).toString("hex")}-${safeName(options.filename)}`
  const absolute = path.join(absoluteDir, base)
  const handle = await fs.open(absolute, "w")
  const reader = body.getReader()
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      size += value.byteLength
      if (size > MAX_BUNDLE_BYTES) throw new UploadError("Project archives are capped at 500MB.", 413, "too_large")
      await handle.write(value)
    }
  } catch (error) {
    await fs.rm(absolute, { force: true }).catch(() => {})
    throw error
  } finally {
    await handle.close()
  }

  const relative = `${dir}/${base}`
  return { token: encodeBundleToken(relative), url: bundleUrl(relative), size, path: relative }
}

export async function readBundle(relativePath: string): Promise<{ bytes: Buffer; filename: string } | null> {
  try {
    const absolute = path.join(privateRoot(), relativePath.replace(/^bundles\//, ""))
    const resolved = path.resolve(absolute)
    if (!resolved.startsWith(path.resolve(privateRoot()) + path.sep)) return null
    const bytes = await fs.readFile(resolved)
    const filename = path.basename(resolved).replace(/^[a-f0-9]{24}-/, "")
    return { bytes, filename }
  } catch {
    return null
  }
}
