import "server-only"
import { createHash, randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { resolveStaffRole } from "@/lib/staff-roles"
import { getMediaPolicy, MB, normalizeMediaPolicy, type MediaPolicy } from "./policy"
import { sniffMedia, shouldStayPng, type MediaFamily, type SniffedMedia } from "./magic"
import {
  absolutePath,
  buildStoragePath,
  ensureMediaDirs,
  getDiskUsage,
  internalAbsolutePath,
  mediaRoot,
  publicUrl,
  randomName,
  tmpRoot,
} from "./storage"
import { extractPoster, processImage, renderSvgThumbnail, isFfmpegAvailable } from "./processors"
import { sanitizeSvg } from "./sanitize-svg"
import { findMediaReferences } from "./references"
import { kickMediaQueue } from "./queue"

/**
 * The single upload pipeline for the whole application.
 *
 * Every route, form and admin panel goes through `saveUpload` (or the
 * `uploadFileToCloudinary` compatibility wrapper), so the same authentication,
 * magic-byte validation, limits, processing and recording apply everywhere.
 * Cloudinary is no longer contacted for new uploads; existing rows keep their
 * `cloudinary_url` and `storage_provider = 'cloudinary'`.
 */

export type UploadFamily = "image" | "video" | "audio" | "file"

export type UploadActor = {
  id: string
  username?: string
  isAdmin: boolean
  isPro: boolean
  createdAt?: string | null
  postCount: number
}

export class UploadError extends Error {
  status: number
  code: string
  constructor(message: string, status = 400, code = "upload_rejected") {
    super(message)
    this.name = "UploadError"
    this.status = status
    this.code = code
  }
}

const ADMIN_ONLY_FAMILIES: MediaFamily[] = ["vector", "animation"]

export async function resolveUploadActor(userId: string, supabase?: SupabaseClient): Promise<UploadActor> {
  const db = supabase || createServerClient()
  let profile: any = null
  try {
    const { data } = await db
      .from("profiles")
      .select("id, username, is_admin, is_moderator, staff_role, is_premium, created_at")
      .eq("id", userId)
      .maybeSingle()
    profile = data
  } catch {
    /* fall through to the least-privileged actor */
  }

  let postCount = 0
  try {
    const { count } = await db
      .from("loops")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId)
    postCount = count || 0
  } catch {
    postCount = 0
  }

  const staffRole = resolveStaffRole(profile)
  return {
    id: userId,
    username: profile?.username || undefined,
    isAdmin: staffRole === "admin" || staffRole === "developer",
    isPro: Boolean(profile?.is_premium),
    createdAt: profile?.created_at || null,
    postCount,
  }
}

function sanitizeFolder(folder?: string | null): string {
  const cleaned = String(folder || "general")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40)
  return cleaned || "general"
}

function sanitizePurpose(purpose?: string | null): string {
  return String(purpose || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40)
}

function isNewAccount(actor: UploadActor, policy: MediaPolicy): boolean {
  if (!actor.createdAt) return false
  const ageMs = Date.now() - new Date(actor.createdAt).getTime()
  if (!Number.isFinite(ageMs)) return false
  const tooYoung = ageMs < policy.new_account_min_age_hours * 3_600_000
  const tooQuiet = actor.postCount < policy.new_account_min_posts
  return tooYoung || tooQuiet
}

export type LimitDecision =
  | { ok: true; maxBytes: number; tierLabel: "admin" | "pro" | "free" }
  | { ok: false; status: number; code: string; message: string }

/** Pre-flight limits that don't need the file body. */
export function planUploadLimits(
  actor: UploadActor,
  policy: MediaPolicy,
  family: UploadFamily,
): LimitDecision {
  const hardBytes = policy.hard_max_mb * MB
  const tierLabel = actor.isAdmin ? "admin" : actor.isPro ? "pro" : "free"

  let maxMb: number
  if (actor.isAdmin) {
    if (family === "image") maxMb = policy.admin_image_max_mb
    else if (family === "video") maxMb = policy.video_pro_mb
    else if (family === "audio") maxMb = policy.hard_max_mb
    else maxMb = policy.hard_max_mb
  } else if (family === "image") {
    maxMb = policy.image_max_mb
  } else if (family === "video") {
    maxMb = actor.isPro ? policy.video_pro_mb : policy.video_free_mb
    if (isNewAccount(actor, policy)) maxMb = Math.min(maxMb, policy.new_account_video_mb)
  } else if (family === "audio") {
    maxMb = policy.voice_max_mb
  } else {
    return {
      ok: false,
      status: 400,
      code: "file_type_blocked",
      message: "Only images, videos and audio can be uploaded.",
    }
  }

  const maxBytes = Math.min(maxMb * MB, hardBytes)
  return { ok: true, maxBytes, tierLabel }
}

export type UsageSnapshot = {
  storedBytes: number
  todayBytes: number
  hourCount: number
}

async function readUsage(supabase: SupabaseClient, userId: string): Promise<UsageSnapshot> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString()

  const run = async (withProvider: boolean) => {
    let storedQuery = supabase.from("media_uploads").select("file_size").eq("user_id", userId)
    let todayQuery = supabase
      .from("media_uploads")
      .select("file_size")
      .eq("user_id", userId)
      .gte("created_at", startOfDay.toISOString())
    let hourQuery = supabase
      .from("media_uploads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", hourAgo)
    if (withProvider) {
      storedQuery = storedQuery.eq("storage_provider", "vps")
      todayQuery = todayQuery.eq("storage_provider", "vps")
      hourQuery = hourQuery.eq("storage_provider", "vps")
    }
    const [stored, today, hour] = await Promise.all([storedQuery, todayQuery, hourQuery])
    if (stored.error || today.error || hour.error) {
      const err = stored.error || today.error || hour.error
      throw new Error(err?.message || "usage query failed")
    }
    const sum = (rows: any[] | null) => (rows || []).reduce((total, row) => total + Number(row.file_size || 0), 0)
    return { storedBytes: sum(stored.data as any[]), todayBytes: sum(today.data as any[]), hourCount: hour.count || 0 }
  }

  try {
    return await run(true)
  } catch {
    try {
      return await run(false)
    } catch (error) {
      console.error("[media] usage query failed:", error)
      return { storedBytes: 0, todayBytes: 0, hourCount: 0 }
    }
  }
}

export type UploadCheckInput = {
  actor: UploadActor
  policy: MediaPolicy
  family: UploadFamily
  sizeBytes: number
  supabase?: SupabaseClient
}

/**
 * Server-side enforcement. The client's own numbers are never consulted; every
 * gate is re-evaluated here, including the disk-safety refusal shared by admins
 * and regular users.
 */
export async function assertUploadAllowed(input: UploadCheckInput): Promise<LimitDecision> {
  const { actor, policy, family } = input
  const db = input.supabase || createServerClient()
  const plan = planUploadLimits(actor, policy, family)
  if (!plan.ok) return plan

  if (input.sizeBytes > policy.hard_max_mb * MB) {
    return {
      ok: false,
      status: 413,
      code: "hard_ceiling",
      message: `Files are capped at ${policy.hard_max_mb}MB.`,
    }
  }
  if (input.sizeBytes > plan.maxBytes) {
    return {
      ok: false,
      status: 413,
      code: "type_limit",
      message: `That file is too large. The limit is ${Math.round(plan.maxBytes / MB)}MB for this type.`,
    }
  }

  const disk = await getDiskUsage()
  if (disk.available && disk.usedPercent >= policy.disk_block_percent) {
    return {
      ok: false,
      status: 507,
      code: "disk_full",
      message:
        "Uploads are paused while we free up space on our servers. Nothing was lost — please try again later.",
    }
  }

  if (actor.isAdmin) return plan

  const usage = await readUsage(db, actor.id)

  if (usage.hourCount >= policy.uploads_per_hour) {
    return {
      ok: false,
      status: 429,
      code: "hourly_limit",
      message: `You've reached the upload limit of ${policy.uploads_per_hour} files an hour. Try again later.`,
    }
  }

  const dailyLimit = (actor.isPro ? policy.daily_upload_mb_pro : policy.daily_upload_mb_free) * MB
  if (usage.todayBytes + input.sizeBytes > dailyLimit) {
    return {
      ok: false,
      status: 429,
      code: "daily_bytes",
      message: `You've uploaded the maximum amount for today. Your limit resets at midnight UTC.`,
    }
  }

  const quotaMb = actor.isPro ? policy.quota_pro_mb : policy.quota_free_mb
  if (usage.storedBytes + input.sizeBytes > quotaMb * MB) {
    return {
      ok: false,
      status: 413,
      code: "quota_exceeded",
      message: `This upload would exceed your ${quotaMb}MB storage allowance. Delete some media or upgrade for more space.`,
    }
  }

  return plan
}

/** Per-post attachment count, enforced by the post-creation routes. */
export function maxFilesPerPost(actor: UploadActor, policy: MediaPolicy): number {
  if (actor.isAdmin) return 50
  return actor.isPro ? policy.post_files_pro : policy.post_files_free
}

export type PostMediaCheck = { ok: true } | { ok: false; message: string }

export function checkPostMediaCount(urls: unknown[], actor: UploadActor, policy: MediaPolicy): PostMediaCheck {
  // Accepts either stored URLs (JSON posts) or File objects (multipart posts),
  // so the same limit applies whichever route created the post.
  const count = urls.filter((u) => (typeof u === "string" ? u.length > 0 : Boolean(u))).length
  const max = maxFilesPerPost(actor, policy)
  if (count > max) {
    return {
      ok: false,
      message: `A post can include up to ${max} files on your plan.`,
    }
  }
  return { ok: true }
}

async function streamBodyToFile(
  body: ReadableStream<Uint8Array> | null,
  dest: string,
  maxBytes: number,
): Promise<number> {
  if (!body) throw new UploadError("No file was received.", 400, "missing_body")
  await fs.mkdir(path.dirname(dest), { recursive: true })
  const handle = await fs.open(dest, "w")
  const reader = body.getReader()
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      total += value.byteLength
      if (total > maxBytes) {
        throw new UploadError(
          `That file exceeds the ${Math.round(maxBytes / MB)}MB limit.`,
          413,
          "type_limit",
        )
      }
      await handle.write(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    await handle.close()
  }
  return total
}

async function appendChunkToFile(
  body: ReadableStream<Uint8Array> | null,
  dest: string,
  start: number,
  end: number,
  maxBytes: number,
): Promise<number> {
  if (!body) throw new UploadError("No chunk was received.", 400, "missing_body")
  await fs.mkdir(path.dirname(dest), { recursive: true })
  let existing = 0
  try {
    existing = (await fs.stat(dest)).size
  } catch {
    existing = 0
  }
  // A retried chunk whose response was lost is already on disk: nothing to do.
  if (start < existing && end + 1 <= existing) {
    await body.cancel().catch(() => {})
    return existing
  }
  if (start !== existing) {
    throw new UploadError("Upload chunks arrived out of order. Please retry.", 409, "chunk_mismatch")
  }
  const handle = await fs.open(dest, "a")
  const reader = body.getReader()
  let total = existing
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      total += value.byteLength
      if (total > maxBytes) {
        throw new UploadError(
          `That file exceeds the ${Math.round(maxBytes / MB)}MB limit.`,
          413,
          "type_limit",
        )
      }
      await handle.write(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    await handle.close()
  }
  return total
}

export type UploadInput = {
  actor: UploadActor
  policy: MediaPolicy
  body: ReadableStream<Uint8Array> | null
  contentLength?: number
  declaredFamily: UploadFamily
  folder?: string
  purpose?: string
  originalFilename?: string
  mimeHint?: string | null
  originalQuality?: boolean
  /** Present for chunked uploads (large files / flaky mobile connections). */
  chunk?: { uploadId: string; start: number; end: number; total: number }
  supabase?: SupabaseClient
  ip?: string | null
  userAgent?: string | null
}

export type UploadResult = {
  id: string
  url: string
  storage_path: string
  thumb_url: string | null
  poster_url: string | null
  variants: Record<string, string>
  media_type: string
  format: string
  mime: string
  width: number | null
  height: number | null
  duration: number | null
  size: number
  status: "ready" | "processing"
  original_quality: boolean
  provider: "vps"
  original_name: string
}

/**
 * Extension of the file that will actually be served.
 *
 * Video and audio must match the container the background job writes (`.mp4`,
 * `.m4a`) — building those paths as `.webp` produced rows whose public URL
 * never came into existence. Admin "original quality" keeps the source
 * container instead.
 */
export function extensionForRender(
  media: SniffedMedia,
  keepPng: boolean,
  originalQuality: boolean,
  keepAnimation = false,
): string {
  if (originalQuality) return media.ext
  if (keepAnimation) return media.ext
  if (media.family === "video") return "mp4"
  if (media.family === "audio") return "m4a"
  if (media.format === "gif") return "gif"
  if (media.format === "svg") return "svg"
  if (media.format === "lottie") return "json"
  if (keepPng) return "png"
  return "webp"
}

function publicFor(absoluteFile: string): string {
  const rel = path.relative(mediaRoot(), absoluteFile).split(path.sep).join("/")
  return publicUrl(rel)
}

async function insertMediaRecord(
  db: SupabaseClient,
  row: Record<string, any>,
): Promise<{ id: string } | null> {
  const attempt = async (payload: Record<string, any>) => {
    const { data, error } = await db.from("media_uploads").insert(payload).select("id").single()
    if (error) return { error }
    return { data }
  }

  const first = await attempt(row)
  if (first.data) return first.data as { id: string }

  // Before the vps-media schema migration runs, unknown columns make the insert
  // fail. Retry with just the legacy columns so uploads keep working; the file
  // is already on disk and the storage path is recoverable.
  console.warn("[media] extended insert failed, retrying with legacy columns:", (first as any).error?.message)
  const legacy: Record<string, any> = {
    user_id: row.user_id,
    file_name: row.file_name,
    file_type: row.file_type,
    file_size: row.file_size,
    cloudinary_public_id: row.cloudinary_public_id,
    cloudinary_url: row.cloudinary_url,
    media_type: row.media_type,
    folder: row.folder,
    width: row.width,
    height: row.height,
    duration: row.duration,
    format: row.format,
  }
  const second = await attempt(legacy)
  if (second.data) return second.data as { id: string }
  console.error("[media] could not record upload:", (second as any).error?.message)
  return null
}

async function audit(
  db: SupabaseClient,
  actor: UploadActor,
  action: string,
  details: Record<string, unknown>,
  ip?: string | null,
  userAgent?: string | null,
): Promise<void> {
  try {
    await db.from("security_audit_log").insert({
      user_id: actor.id,
      action,
      details,
      ip_address: ip || null,
      user_agent: (userAgent || "").slice(0, 500) || null,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    // Audit logging must never break an upload.
    console.error("[media] audit insert failed:", error)
  }
}

/**
 * Validate, process, store and record one upload.
 */
export async function saveUpload(input: UploadInput): Promise<UploadResult> {
  const db = input.supabase || createServerClient()
  const { actor, policy } = input
  const folder = sanitizeFolder(input.folder)
  const purpose = sanitizePurpose(input.purpose)
  const originalQuality = Boolean(input.originalQuality) && actor.isAdmin

  await ensureMediaDirs()

  // When the client cannot say what the file is, the type-specific gate runs
  // after magic-byte sniffing below instead of guessing here.
  const preflightFamily = input.declaredFamily
  const plan =
    preflightFamily === "file"
      ? { ok: true as const, maxBytes: policy.hard_max_mb * MB, tierLabel: actor.isAdmin ? ("admin" as const) : actor.isPro ? ("pro" as const) : ("free" as const) }
      : await assertUploadAllowed({
          actor,
          policy,
          family: preflightFamily,
          sizeBytes: input.contentLength || 0,
          supabase: db,
        })
  if (!plan.ok) throw new UploadError(plan.message, plan.status, plan.code)

  const tmpId = `upload-${randomUUID()}`
  const workingPath = path.join(tmpRoot(), input.chunk ? `${input.chunk.uploadId}.part` : `${tmpId}.bin`)

  let size: number
  if (input.chunk) {
    const { start, end, total } = input.chunk
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(total)) {
      throw new UploadError("Malformed upload chunk.", 400, "bad_chunk")
    }
    if (total > policy.hard_max_mb * MB) {
      throw new UploadError(`Files are capped at ${policy.hard_max_mb}MB.`, 413, "hard_ceiling")
    }
    size = await appendChunkToFile(input.body, workingPath, start, end, plan.maxBytes)
    if (size < total) {
      // More chunks to come — nothing is stored or recorded yet.
      return {
        id: "",
        url: "",
        storage_path: "",
        thumb_url: null,
        poster_url: null,
        variants: {},
        media_type: input.declaredFamily,
        format: "",
        mime: "",
        width: null,
        height: null,
        duration: null,
        size,
        status: "processing",
        original_quality: originalQuality,
        provider: "vps",
        original_name: input.originalFilename || "",
      }
    }
  } else {
    size = await streamBodyToFile(input.body, workingPath, plan.maxBytes)
  }

  if (size === 0) {
    await fs.rm(workingPath, { force: true }).catch(() => {})
    throw new UploadError("The file is empty.", 400, "empty_file")
  }

  // ── Content-based validation ────────────────────────────────────────────
  const handle = await fs.open(workingPath, "r")
  const sniffBuffer = Buffer.alloc(Math.min(size, 64 * 1024))
  try {
    await handle.read(sniffBuffer, 0, sniffBuffer.length, 0)
  } finally {
    await handle.close()
  }
  const sniffed = sniffMedia(sniffBuffer, input.mimeHint)
  if (!sniffed.ok) {
    await fs.rm(workingPath, { force: true }).catch(() => {})
    throw new UploadError(
      `${sniffed.reason} Only real images, videos and audio files are accepted.`,
      415,
      "content_rejected",
    )
  }

  const media = sniffed.media
  if (ADMIN_ONLY_FAMILIES.includes(media.family) && !actor.isAdmin) {
    await fs.rm(workingPath, { force: true }).catch(() => {})
    throw new UploadError("SVG and Lottie uploads are limited to admins.", 403, "admin_only_type")
  }

  // Re-check the type-specific limit now that the real type is known.
  const actualPlan = await assertUploadAllowed({
    actor,
    policy,
    family: media.family === "video" ? "video" : media.family === "audio" ? "audio" : "image",
    sizeBytes: size,
    supabase: db,
  })
  if (!actualPlan.ok) {
    await fs.rm(workingPath, { force: true }).catch(() => {})
    throw new UploadError(actualPlan.message, actualPlan.status, actualPlan.code)
  }

  if (media.family === "video" && !originalQuality && !(await isFfmpegAvailable())) {
    await fs.rm(workingPath, { force: true }).catch(() => {})
    throw new UploadError(
      "Video uploads are temporarily unavailable because the server is missing ffmpeg. Please tell an admin.",
      503,
      "ffmpeg_missing",
    )
  }

  // ── Processing ──────────────────────────────────────────────────────────
  const keepPng = shouldStayPng({ family: media.family, format: media.format, purpose, folder })
  // Animated WebP/APNG are as much "keep it moving" as a GIF is.
  const keepAnimation = !originalQuality && media.family === "image" && media.animated
  const storageExt = extensionForRender(media, keepPng, originalQuality, keepAnimation)
  const storagePath = buildStoragePath(media.family, storageExt)
  const targetAbs = absolutePath(storagePath)
  const outDir = path.dirname(targetAbs)
  const baseName = path.basename(storagePath).replace(/\.[^.]+$/, "")

  let status: "ready" | "processing" = "ready"
  let thumbUrl: string | null = null
  let posterUrl: string | null = null
  let variants: Record<string, string> = {}
  let width: number | null = null
  let height: number | null = null
  let duration: number | null = null
  let finalSize = size
  let format = media.format
  let fileType = media.mime
  let sourcePath: string | null = null

  try {
    if (media.family === "image") {
      const processed = await processImage({
        inputPath: workingPath,
        outDir,
        targetStoragePath: storagePath,
        media,
        originalQuality,
        keepPng,
        keepAnimation,
      })
      finalSize = processed.mainBytes
      width = processed.mainWidth
      height = processed.mainHeight
      format = processed.mainExt
      fileType = format === "png" ? "image/png" : format === "gif" ? "image/gif" : format === "jpg" ? "image/jpeg" : "image/webp"
      for (const variant of processed.variants) {
        if (!variant.bytes) continue
        variants[variant.label] = publicFor(variant.path)
      }
      thumbUrl = processed.thumbPath ? publicFor(processed.thumbPath) : variants.thumb || null
      posterUrl = thumbUrl
      await fs.rm(workingPath, { force: true }).catch(() => {})
    } else if (media.family === "vector") {
      const raw = await fs.readFile(workingPath, "utf8")
      const sanitized = sanitizeSvg(raw)
      await fs.mkdir(outDir, { recursive: true })
      await fs.writeFile(targetAbs, sanitized.svg, "utf8")
      const stat = await fs.stat(targetAbs)
      finalSize = stat.size
      format = "svg"
      fileType = "image/svg+xml"
      const thumb = await renderSvgThumbnail(targetAbs, outDir, baseName)
      if (thumb) {
        thumbUrl = publicFor(thumb)
        posterUrl = thumbUrl
        variants.thumb = thumbUrl
      }
      await fs.rm(workingPath, { force: true }).catch(() => {})
    } else if (media.family === "animation") {
      const raw = await fs.readFile(workingPath, "utf8")
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).layers)) {
        throw new Error("Invalid Lottie animation")
      }
      await fs.mkdir(outDir, { recursive: true })
      await fs.writeFile(targetAbs, JSON.stringify(parsed), "utf8")
      const stat = await fs.stat(targetAbs)
      finalSize = stat.size
      format = "lottie"
      fileType = "application/json"
      width = Number(parsed.w) || null
      height = Number(parsed.h) || null
      await fs.rm(workingPath, { force: true }).catch(() => {})
    } else if (originalQuality) {
      // Admin "original quality": keep the exact bytes and container (MOV stays
      // MOV, WebM stays WebM) instead of transcoding. A poster is still pulled
      // so lists and players have something to show.
      await fs.mkdir(outDir, { recursive: true })
      await fs.rename(workingPath, targetAbs).catch(async () => {
        await fs.copyFile(workingPath, targetAbs)
        await fs.rm(workingPath, { force: true }).catch(() => {})
      })
      const stat = await fs.stat(targetAbs)
      finalSize = stat.size
      format = media.format
      fileType = media.mime
      if (media.family === "video") {
        const poster = await extractPoster(targetAbs, outDir, baseName).catch(() => null)
        if (poster) {
          posterUrl = publicFor(poster)
          thumbUrl = posterUrl
          variants.poster = posterUrl
        }
      }
    } else {
      // Video / audio: keep the source for the background job and return the
      // stable public URLs it will fill in.
      await fs.mkdir(outDir, { recursive: true })
      const sourceDir = path.join(tmpRoot(), "sources")
      await fs.mkdir(sourceDir, { recursive: true })
      const sourceName = `${randomName()}.source`
      const sourceAbs = path.join(sourceDir, sourceName)
      await fs.rename(workingPath, sourceAbs).catch(async () => {
        await fs.copyFile(workingPath, sourceAbs)
        await fs.rm(workingPath, { force: true }).catch(() => {})
      })
      sourcePath = path.relative(mediaRoot(), sourceAbs).split(path.sep).join("/")
      status = "processing"
      format = media.family === "video" ? "mp4" : "m4a"
      fileType = media.family === "video" ? "video/mp4" : "audio/mp4"
      posterUrl = media.family === "video" ? publicUrl(path.join(path.dirname(storagePath), `${baseName}-poster.jpg`)) : null
      thumbUrl = posterUrl
    }
  } catch (error) {
    await fs.rm(workingPath, { force: true }).catch(() => {})
    await fs.rm(targetAbs, { force: true }).catch(() => {})
    throw new UploadError(
      error instanceof Error ? `We couldn't process that file: ${error.message}` : "We couldn't process that file.",
      422,
      "processing_failed",
    )
  }

  const checksum = createHash("sha256").update(`${actor.id}:${storagePath}`).digest("hex").slice(0, 32)
  const publicPath = publicUrl(storagePath)
  const originalName = (input.originalFilename || "upload").slice(0, 180)

  const record = await insertMediaRecord(db, {
    user_id: actor.id,
    file_name: originalName,
    file_type: fileType,
    file_size: finalSize,
    cloudinary_public_id: `vps/${storagePath}`,
    cloudinary_url: publicPath,
    media_type: media.family === "vector" || media.family === "animation" ? "image" : media.family,
    folder,
    width,
    height,
    duration,
    format,
    // Extended columns (vps-media schema)
    storage_provider: "vps",
    storage_path: storagePath,
    public_url: publicPath,
    thumb_url: thumbUrl,
    poster_url: posterUrl,
    variants,
    processing_status: status,
    source_path: sourcePath,
    processing_attempts: 0,
    original_quality: originalQuality,
    uploaded_by_role: actor.isAdmin ? "admin" : actor.isPro ? "pro" : "user",
    purpose: purpose || null,
    checksum,
    mime_detected: media.mime,
    updated_at: new Date().toISOString(),
  })

  if (status === "processing") kickMediaQueue()

  if (actor.isAdmin) {
    await audit(
      db,
      actor,
      "media_upload",
      {
        file: storagePath,
        name: originalName,
        size: finalSize,
        folder,
        original_quality: originalQuality,
        provider: "vps",
      },
      input.ip,
      input.userAgent,
    )
  }

  return {
    id: record?.id || storagePath,
    url: publicPath,
    storage_path: storagePath,
    thumb_url: thumbUrl,
    poster_url: posterUrl,
    variants,
    media_type: media.family,
    format,
    mime: fileType,
    width,
    height,
    duration,
    size: finalSize,
    status,
    original_quality: originalQuality,
    provider: "vps",
    original_name: originalName,
  }
}

export type MediaAssetRow = {
  id: string
  url: string
  storage_provider: "vps" | "cloudinary"
  storage_path: string | null
  media_type: string | null
  format: string | null
  file_size: number | null
  file_name: string | null
  folder: string | null
  user_id: string | null
  created_at: string
  processing_status: string | null
  thumb_url: string | null
  poster_url: string | null
}

export async function getMediaById(id: string): Promise<MediaAssetRow | null> {
  const db = createServerClient()
  const { data, error } = await db
    .from("media_uploads")
    .select(
      "id, cloudinary_url, public_url, storage_provider, storage_path, media_type, format, file_size, file_name, folder, user_id, created_at, processing_status, thumb_url, poster_url",
    )
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null
  return {
    id: String(data.id),
    url: data.public_url || data.cloudinary_url,
    storage_provider: (data.storage_provider as "vps" | "cloudinary") || "cloudinary",
    storage_path: data.storage_path || null,
    media_type: data.media_type || null,
    format: data.format || null,
    file_size: data.file_size ?? null,
    file_name: data.file_name || null,
    folder: data.folder || null,
    user_id: data.user_id || null,
    created_at: data.created_at,
    processing_status: data.processing_status || "ready",
    thumb_url: data.thumb_url || null,
    poster_url: data.poster_url || null,
  }
}

/**
 * Remove the files and the row for one upload, with no permission or reference
 * checks. Callers are either the admin/owner delete flow (after those checks)
 * or the cleanup jobs, which delete posts' media on purpose.
 */
export async function purgeMediaAsset(
  id: string,
): Promise<{ ok: boolean; warnings?: string[]; message?: string }> {
  const db = createServerClient()
  let row: any = null
  try {
    const { data } = await db
      .from("media_uploads")
      .select("id, storage_provider, storage_path, source_path")
      .eq("id", id)
      .maybeSingle()
    row = data
  } catch {
    row = null
  }

  const warnings: string[] = []

  if (row?.storage_provider === "vps" && row?.storage_path) {
    try {
      const target = absolutePath(row.storage_path)
      const dir = path.dirname(target)
      const base = path.basename(target).replace(/\.[^.]+$/, "")
      const extension = path.extname(target)
      const entries = await fs.readdir(dir).catch(() => [] as string[])
      for (const entry of entries) {
        if (entry !== `${base}${extension}` && !entry.startsWith(`${base}-`)) continue
        await fs.rm(path.join(dir, entry), { force: true }).catch(() => {
          warnings.push(`Could not remove ${entry}`)
        })
      }
    } catch {
      warnings.push("Stored file was already missing")
    }
  }

  if (row?.source_path) {
    try {
      await fs.rm(internalAbsolutePath(row.source_path), { force: true }).catch(() => {})
    } catch {
      /* invalid or legacy source path */
    }
  }

  const { error } = await db.from("media_uploads").delete().eq("id", id)
  if (error) return { ok: false, message: error.message, warnings }
  return { ok: true, warnings }
}

export type DeleteMediaOptions = {
  actor: UploadActor
  id: string
  /** Admin explicitly accepted that the file is still referenced. */
  confirmReferenced?: boolean
  ip?: string | null
  userAgent?: string | null
}

export type DeleteMediaResult =
  | { ok: true; deleted: boolean; warnings: string[] }
  | { ok: false; status: number; code: string; message: string; references?: { label: string; id: string; table: string }[] }

/**
 * Delete one media asset. Regular users may only delete their own files and
 * never a file that is still referenced; admins can remove referenced files
 * after confirming, and the action is audited.
 */
export async function deleteMediaAsset(options: DeleteMediaOptions): Promise<DeleteMediaResult> {
  const db = createServerClient()
  const asset = await getMediaById(options.id)
  if (!asset) return { ok: false, status: 404, code: "not_found", message: "Media not found." }

  if (!options.actor.isAdmin && asset.user_id !== options.actor.id) {
    return { ok: false, status: 403, code: "forbidden", message: "You can only delete your own uploads." }
  }

  const warnings: string[] = []

  if (asset.storage_provider === "vps" && asset.storage_path) {
    const refs = await findMediaReferences(db, asset.storage_path)
    if (refs.length && !(options.actor.isAdmin && options.confirmReferenced)) {
      return {
        ok: false,
        status: 409,
        code: "referenced",
        message: `This file is still used by ${Array.from(new Set(refs.map((r) => r.label))).join(", ")}. Confirm to delete it anyway.`,
        references: refs.map((r) => ({ label: r.label, id: r.id, table: r.table })),
      }
    }
  }

  const purged = await purgeMediaAsset(asset.id)
  if (!purged.ok) {
    return { ok: false, status: 500, code: "delete_failed", message: purged.message || "Could not delete the media record." }
  }
  warnings.push(...(purged.warnings || []))

  if (options.actor.isAdmin) {
    await audit(
      db,
      options.actor,
      "media_delete",
      {
        file: asset.storage_path || asset.url,
        id: asset.id,
        size: asset.file_size,
        referenced_confirmed: Boolean(options.confirmReferenced),
        provider: asset.storage_provider,
      },
      options.ip,
      options.userAgent,
    )
  }

  return { ok: true, deleted: true, warnings }
}

/**
 * Replace the bytes of an existing file without changing its URL — used for
 * "replace" in the Media Library (badges, frames, ad creatives).
 */
export async function replaceMediaFile(options: {
  actor: UploadActor
  policy: MediaPolicy
  asset: MediaAssetRow
  body: ReadableStream<Uint8Array> | null
  contentLength?: number
  mimeHint?: string | null
  ip?: string | null
  userAgent?: string | null
}): Promise<{ ok: true; url: string } | { ok: false; status: number; message: string }> {
  const { actor, policy, asset } = options
  if (!actor.isAdmin) return { ok: false, status: 403, message: "Only admins can replace media files." }
  if (asset.storage_provider !== "vps" || !asset.storage_path) {
    return { ok: false, status: 400, message: "Only files stored on the VPS can be replaced." }
  }

  const plan = await assertUploadAllowed({
    actor,
    policy,
    family: asset.media_type === "video" ? "video" : asset.media_type === "audio" ? "audio" : "image",
    sizeBytes: options.contentLength || 0,
  })
  if (!plan.ok) return { ok: false, status: plan.status, message: plan.message }

  const db = createServerClient()
  const tmp = path.join(tmpRoot(), `replace-${randomUUID()}.bin`)
  try {
    const size = await streamBodyToFile(options.body, tmp, plan.maxBytes)
    const probe = Buffer.alloc(Math.min(size, 64 * 1024))
    const handle = await fs.open(tmp, "r")
    try {
      await handle.read(probe, 0, probe.length, 0)
    } finally {
      await handle.close()
    }
    const sniffed = sniffMedia(probe, options.mimeHint)
    if (!sniffed.ok) return { ok: false, status: 415, message: sniffed.reason }

    // The URL must not change, so the replacement has to keep the existing
    // file extension — writing PNG bytes into a `.webp` name would be served
    // with the wrong content type under `nosniff`.
    const previousExt = path.extname(asset.storage_path).replace(/^\./, "").toLowerCase()
    const nextExt = sniffed.media.ext.toLowerCase()
    const sameType =
      previousExt === nextExt ||
      (["jpg", "jpeg"].includes(previousExt) && ["jpg", "jpeg"].includes(nextExt))
    if (!sameType) {
      await fs.rm(tmp, { force: true }).catch(() => {})
      return {
        ok: false,
        status: 415,
        message: `This file is stored as .${previousExt}; upload a .${previousExt} replacement so the URL and cached copies stay valid.`,
      }
    }

    const targetAbs = absolutePath(asset.storage_path)
    const outDir = path.dirname(targetAbs)
    const base = path.basename(targetAbs).replace(/\.[^.]+$/, "")
    let finalSize = size
    let width = asset.media_type === "video" ? null : 0
    let height = 0

    if (sniffed.media.family === "image" && sniffed.media.format !== "svg") {
      // Render to a temporary sibling name, then move the bytes over the
      // existing filename so every URL already pointing here keeps working.
      const rendered = await processImage({
        inputPath: tmp,
        outDir,
        targetStoragePath: path.join(path.dirname(asset.storage_path), `${base}-replace.${sniffed.media.ext}`),
        media: sniffed.media,
        originalQuality: true,
        keepPng: sniffed.media.format === "png",
      })
      const bytes = await fs.readFile(rendered.mainPath)
      await fs.writeFile(targetAbs, bytes)
      finalSize = bytes.byteLength
      width = rendered.mainWidth
      height = rendered.mainHeight
      // Responsive renditions were written as `${base}-replace-480.webp` etc.
      // Move each one onto the real `${base}-480.webp` name — otherwise phones
      // would keep getting the old pixels from the stale variants.
      const byproducts = await fs.readdir(outDir).catch(() => [] as string[])
      for (const entry of byproducts) {
        // Only the renditions (`-replace-480.webp`); the main temp file is
        // handled separately below.
        if (!entry.startsWith(`${base}-replace-`)) continue
        const published = entry.replace(`${base}-replace`, base)
        await fs.rename(path.join(outDir, entry), path.join(outDir, published)).catch(() => {})
      }
      await fs.rm(rendered.mainPath, { force: true }).catch(() => {})
    } else {
      await fs.copyFile(tmp, targetAbs)
    }
    await fs.rm(tmp, { force: true }).catch(() => {})

    try {
      await db
        .from("media_uploads")
        .update({
          file_size: finalSize,
          file_type: sniffed.media.mime,
          format: sniffed.media.format,
          width: width || null,
          height: height || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", asset.id)
    } catch {
      /* pre-migration schema */
    }

    await audit(db, actor, "media_replace", { file: asset.storage_path, size: finalSize, id: asset.id }, options.ip, options.userAgent)
    return { ok: true, url: asset.url }
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => {})
    return { ok: false, status: 422, message: error instanceof Error ? error.message : "Replace failed" }
  }
}

/** Policy read helper for routes. */
export async function currentPolicy(db?: SupabaseClient): Promise<MediaPolicy> {
  const supabase = db || createServerClient()
  return getMediaPolicy(supabase)
}

export { normalizeMediaPolicy }
