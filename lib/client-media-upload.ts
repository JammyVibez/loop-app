"use client"

import { parseJsonResponse } from "@/lib/parse-json-response"
import {
  finishUploadActivity,
  startUploadActivity,
  updateUploadActivity,
  uploadActivityLabel,
} from "@/lib/upload-activity"

/**
 * Browser-side uploader for the VPS media store.
 *
 * Everything goes to `/api/media/upload` as a plain body (never multipart), so
 * the server can stream a 500MB video straight to disk. Files above the chunk
 * size are sent in sequential ranges with a stable `X-Upload-Id`: a dropped
 * chunk retries on its own instead of restarting the file, which matters on
 * mobile connections. Progress is reported per chunk through XHR.
 *
 * Cloudinary is not contacted from the browser any more — `/api/upload/sign`
 * is retired, and no client code needs Cloudinary credentials.
 */

export type UploadMediaOptions = {
  type: "image" | "video" | "audio" | "file"
  folder?: string
  /** Kept for API compatibility; the session cookie authenticates the request. */
  authHeaders?: Record<string, string>
  /** Optional client-side size cap (server still enforces its own). */
  maxSizeBytes?: number
  /** Retained for compatibility with the old direct-to-Cloudinary path. */
  forceDirect?: boolean
  /** Where the file will be used, e.g. "avatar", "post", "badge". */
  purpose?: string
  /** Admin only: store exact pixels/animation without resizing or transcoding. */
  originalQuality?: boolean
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export type UploadMediaResult = {
  url: string
  public_id?: string
  width?: number
  height?: number
  duration?: number
  format?: string
  /** Server media id — use with waitForMediaReady for videos. */
  id?: string
  status?: "ready" | "processing" | "failed"
  thumb_url?: string | null
  poster_url?: string | null
  variants?: Record<string, string>
  storage_path?: string
  media_type?: string
  size?: number
  error?: string
}

// 16MB slices balance both failure modes: a 500MB movie still needs only ~32
// requests, while a dropped mobile connection loses at most 16MB instead of a
// 48MB slice. Every chunk is a full request (session check + policy + disk
// write), which is why we do not go smaller.
const CHUNK_BYTES = 16 * 1024 * 1024
const MAX_RETRIES = 4
// Absolute request timeouts punish slow-but-healthy connections: a 16MB chunk
// legitimately takes minutes on 3G. Instead we abort only when the socket has
// made no progress at all for this long, which catches a genuinely dead upload
// without killing a slow one.
const IDLE_TIMEOUT_MS = 90 * 1000

// Client-side downscale before the bytes ever leave the device. Phone photos
// are routinely 8-15MB; the server re-encodes them anyway, so sending the
// original is pure upload latency.
const IMAGE_COMPRESS_THRESHOLD = 1.5 * 1024 * 1024
const IMAGE_MAX_DIMENSION = 2560

function mediaTypeFromFile(file: File, explicit?: UploadMediaOptions["type"]): UploadMediaOptions["type"] {
  if (explicit) return explicit
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("audio/")) return "audio"
  if (file.type.startsWith("image/")) return "image"

  // Android pickers and desktop drag-and-drop sometimes report an empty MIME
  // type; fall back to the extension so those uploads still reach the server,
  // which validates by magic bytes anyway.
  const name = (file.name || "").toLowerCase()
  if (/\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv|3gp)$/.test(name)) return "video"
  if (/\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/.test(name)) return "audio"
  if (/\.(jpe?g|png|gif|webp|svg|heic|heif|avif|bmp)$/.test(name)) return "image"
  return "file"
}

/**
 * Downscale/compress a large photo in the browser. Falls back to the original
 * file whenever anything is unsupported (GIF/SVG/HEIC, no canvas, tainted
 * decode) — an upload must never fail because optimisation did.
 */
async function compressImageForUpload(file: File): Promise<File> {
  if (typeof document === "undefined") return file
  if (!file.type.startsWith("image/")) return file
  if (/gif|svg|heic|heif/i.test(file.type)) return file
  if (file.size <= IMAGE_COMPRESS_THRESHOLD) return file
  if (typeof createImageBitmap !== "function") return file

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    const scale = longest > IMAGE_MAX_DIMENSION ? IMAGE_MAX_DIMENSION / longest : 1
    // Already small in pixels and only modestly over the size threshold: the
    // re-encode may not be worth it.
    if (scale === 1 && file.size < 4 * 1024 * 1024) return file

    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86))
    // WebP keeps transparency; JPEG is the universal fallback, with a white
    // matte so transparent PNGs do not turn black.
    let blob = await encode("image/webp")
    if (!blob) {
      ctx.globalCompositeOperation = "destination-over"
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, width, height)
      blob = await encode("image/jpeg")
    }
    if (!blob || blob.size >= file.size) return file

    const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"
    const name = `${(file.name || "image").replace(/\.[^.]+$/, "")}.${extension}`
    return new File([blob], name, { type: blob.type, lastModified: Date.now() })
  } catch {
    return file
  } finally {
    bitmap?.close?.()
  }
}

function newUploadId(): string {
  try {
    return crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, "")
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

type SendOptions = {
  file: File
  type: UploadMediaOptions["type"]
  folder: string
  purpose?: string
  originalQuality?: boolean
  authHeaders?: Record<string, string>
  onChunkProgress?: (loaded: number) => void
  signal?: AbortSignal
  range?: { start: number; end: number; total: number; uploadId: string }
}

async function postChunk(
  options: SendOptions,
): Promise<{ status: number; body: any; retryAfter?: number }> {
  const { file, type, folder, purpose, originalQuality, authHeaders, range, signal } = options
  const body = range ? file.slice(range.start, range.end + 1) : file

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/media/upload")
    xhr.responseType = "text"
    xhr.withCredentials = true

    // Stall watchdog, not a total-duration cap. Any upload or download progress
    // proves the connection is alive, so the clock restarts.
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    // A stall must be retryable, but xhr.abort() reports as AbortError — which
    // is treated as user cancellation and never retried. Remember why we
    // aborted so onabort can surface the truth.
    let stalled = false
    const armIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        stalled = true
        xhr.abort()
        reject(new Error("The upload stalled. Check your connection and try again."))
      }, IDLE_TIMEOUT_MS)
    }
    const clearIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = null
    }
    armIdleTimer()

    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
    xhr.setRequestHeader("X-Media-Type", type)
    xhr.setRequestHeader("X-Media-Folder", folder)
    xhr.setRequestHeader("X-Media-Mime", file.type || "")
    xhr.setRequestHeader("X-Media-Name", encodeURIComponent(file.name || "upload"))
    if (purpose) xhr.setRequestHeader("X-Media-Purpose", purpose)
    if (originalQuality) xhr.setRequestHeader("X-Media-Quality", "original")
    for (const [key, value] of Object.entries(authHeaders || {})) {
      if (key.toLowerCase() === "content-type") continue
      xhr.setRequestHeader(key, value)
    }
    if (range) {
      xhr.setRequestHeader("Content-Range", `bytes ${range.start}-${range.end}/${range.total}`)
      xhr.setRequestHeader("X-Upload-Id", range.uploadId)
    }

    xhr.upload.onprogress = (event) => {
      armIdleTimer()
      if (event.lengthComputable) options.onChunkProgress?.(event.loaded)
    }
    xhr.onprogress = armIdleTimer

    xhr.onload = () => {
      clearIdleTimer()
      let parsed: any = {}
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {}
      } catch {
        parsed = {}
      }
      const retryAfter = Number(xhr.getResponseHeader("Retry-After") || 0)
      resolve({ status: xhr.status, body: parsed, retryAfter: Number.isFinite(retryAfter) ? retryAfter : undefined })
    }
    xhr.onerror = () => {
      clearIdleTimer()
      reject(new Error("Network error while uploading. Check your connection and try again."))
    }
    xhr.ontimeout = () => {
      clearIdleTimer()
      reject(new Error("The upload timed out. Please try again."))
    }
    xhr.onabort = () => {
      clearIdleTimer()
      if (stalled) {
        reject(new Error("The upload stalled. Check your connection and try again."))
        return
      }
      reject(new DOMException("Upload cancelled", "AbortError"))
    }
    if (signal?.aborted) {
      clearIdleTimer()
      reject(new DOMException("Upload cancelled", "AbortError"))
      return
    }
    signal?.addEventListener("abort", () => xhr.abort(), { once: true })

    xhr.send(body)
  })
}

async function sendWithRetries(options: SendOptions): Promise<any> {
  let lastError: unknown = null
  let retryAfterSeconds: number | undefined
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { status, body, retryAfter } = await postChunk(options)
      if (status >= 200 && status < 300) return body
      retryAfterSeconds = retryAfter
      // A 4xx means the server made a decision — retrying will not change it.
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        const message = body?.error || `Upload failed (${status})`
        throw new Error(message)
      }
      lastError = new Error(body?.error || `Upload failed (${status})`)
    } catch (error) {
      lastError = error
      if ((error as any)?.name === "AbortError") throw error
      const message = error instanceof Error ? error.message : ""
      if (/too large|not allowed|exceeds|capped|storage allowance|upgrade|only/i.test(message)) throw error
    }
    // Honour the server's Retry-After (a 429 upload limit) instead of hammering
    // it with the generic backoff; otherwise back off exponentially with
    // jitter so several tabs do not retry in lockstep.
    const backoff = retryAfterSeconds
      ? Math.min(30, retryAfterSeconds) * 1000
      : 500 * 2 ** attempt + Math.random() * 400
    retryAfterSeconds = undefined
    await new Promise((resolve) => setTimeout(resolve, backoff))
  }
  throw lastError instanceof Error ? lastError : new Error("Upload failed")
}

function toResult(payload: any, fallbackType: string): UploadMediaResult {
  const data = payload?.data || payload
  const url = data?.url || data?.public_url
  if (!url) throw new Error(data?.error || "The server did not return a media URL")
  return {
    url,
    id: data.id,
    public_id: data.public_id || data.storage_path,
    width: data.width ?? undefined,
    height: data.height ?? undefined,
    duration: data.duration ?? undefined,
    format: data.format,
    status: data.status || "ready",
    thumb_url: data.thumb_url ?? null,
    poster_url: data.poster_url ?? null,
    variants: data.variants || {},
    storage_path: data.storage_path,
    media_type: data.media_type,
    size: data.size,
  }
}

/**
 * Video and audio are stored immediately and transcoded in the background. The
 * final `.mp4`/`.m4a` and poster do not exist until that finishes, so composers
 * wait here before they publish a URL that would 404. Images return instantly.
 */
async function settleProcessing(result: UploadMediaResult): Promise<UploadMediaResult> {
  if (result.status !== "processing" || !result.id) return result
  try {
    const ready = await waitForMediaReady([result.id], { timeoutMs: 15 * 60 * 1000 })
    const finished = ready[result.id]
    if (finished?.url) {
      return {
        ...result,
        ...finished,
        status: finished.status === "failed" ? "failed" : "ready",
        format: result.format,
        media_type: result.media_type,
        size: result.size,
      }
    }
  } catch {
    /* fall through: the caller can still show the processing state */
  }
  return result
}

/**
 * Upload one file. Images return once stored; video and audio wait for the
 * background transcode so the returned URL always resolves.
 */
export async function uploadMediaFile(
  file: File,
  options: UploadMediaOptions,
): Promise<UploadMediaResult> {
  const type = mediaTypeFromFile(file, options.type)
  const folder = options.folder || "general"
  const purpose = options.purpose

  if (!file.size) throw new Error("That file is empty.")

  // Shrink large photos before measuring against the cap: a 12MB camera photo
  // that compresses to 2MB should not be rejected by a 5MB limit.
  const source = type === "image" && !options.originalQuality
    ? await compressImageForUpload(file)
    : file
  if (options.maxSizeBytes && source.size > options.maxSizeBytes) {
    throw new Error(`File is too large. Maximum size is ${Math.round(options.maxSizeBytes / 1024 / 1024)}MB.`)
  }

  const total = source.size
  const activityId = startUploadActivity(uploadActivityLabel(type, folder))
  let reported = 0
  const report = (loaded: number) => {
    if (!total) return
    reported = Math.min(total, reported + loaded)
    const percent = Math.min(99, Math.round((reported / total) * 100))
    updateUploadActivity(activityId, percent)
    options.onProgress?.(percent)
  }

  /** Publish the stored result, flagging the transcode wait in the indicator. */
  const complete = async (payload: any) => {
    const result = toResult(payload, type)
    if (result.status === "processing") {
      updateUploadActivity(activityId, 100, "Processing your media…")
    }
    return settleProcessing(result)
  }

  let failed = false
  try {
    if (total <= CHUNK_BYTES) {
      const payload = await sendWithRetries({
        file: source,
        type,
        folder,
        purpose,
        originalQuality: options.originalQuality,
        authHeaders: options.authHeaders,
        signal: options.signal,
        onChunkProgress: report,
      })
      updateUploadActivity(activityId, 100, "Finishing your upload…")
      options.onProgress?.(100)
      return await complete(payload)
    }

    const uploadId = newUploadId()
    let finalPayload: any = null
    for (let start = 0; start < total; start += CHUNK_BYTES) {
      const end = Math.min(start + CHUNK_BYTES, total) - 1
      // Absolute accounting: a retried chunk restarts its own `loaded` at 0, so
      // progress must not regress or double-count.
      const baseReported = reported
      const payload = await sendWithRetries({
        file: source,
        type,
        folder,
        purpose,
        originalQuality: options.originalQuality,
        authHeaders: options.authHeaders,
        signal: options.signal,
        range: { start, end, total, uploadId },
        onChunkProgress: (loaded) => {
          const absolute = Math.min(total, baseReported + loaded)
          if (absolute > reported) report(absolute - reported)
        },
      })
      if (payload?.partial) continue
      finalPayload = payload
    }

    if (!finalPayload) throw new Error("The upload did not complete. Please try again.")
    updateUploadActivity(activityId, 100, "Finishing your upload…")
    options.onProgress?.(100)
    return await complete(finalPayload)
  } catch (error) {
    failed = true
    throw error
  } finally {
    finishUploadActivity(activityId, !failed, failed ? "Upload failed" : undefined)
  }
}

/** Upload several files (admin bulk upload) with per-file progress. */
export async function uploadMediaBatch(
  files: File[],
  options: UploadMediaOptions & { onFileProgress?: (index: number, percent: number) => void },
): Promise<{ ok: UploadMediaResult[]; failed: { file: string; error: string }[] }> {
  const ok: UploadMediaResult[] = []
  const failed: { file: string; error: string }[] = []
  for (let index = 0; index < files.length; index++) {
    try {
      const result = await uploadMediaFile(files[index], {
        ...options,
        onProgress: (percent) => options.onFileProgress?.(index, percent),
      })
      ok.push(result)
    } catch (error) {
      failed.push({ file: files[index].name, error: error instanceof Error ? error.message : "Upload failed" })
    }
  }
  return { ok, failed }
}

/**
 * Poll the processing queue until the given media ids are ready. Used by the
 * composer before it publishes a post that contains video.
 */
export async function waitForMediaReady(
  ids: string[],
  options: { timeoutMs?: number; intervalMs?: number; onProgress?: (ready: number, total: number) => void } = {},
): Promise<Record<string, UploadMediaResult>> {
  const pending = new Set(ids.filter(Boolean))
  const results: Record<string, UploadMediaResult> = {}
  const timeout = options.timeoutMs ?? 5 * 60 * 1000
  // Poll a little quicker than before: a finished transcode no longer waits up
  // to 2.5s before the composer can publish.
  const interval = options.intervalMs ?? 1200
  const started = Date.now()

  while (pending.size && Date.now() - started < timeout) {
    const list = Array.from(pending)
    try {
      const res = await fetch(`/api/media/status?ids=${encodeURIComponent(list.join(","))}`, { cache: "no-store" })
      const { data: payload } = await parseJsonResponse<any>(res)
      const items: any[] = Array.isArray(payload) ? payload : payload?.items || []
      for (const item of items) {
        if (!item?.id) continue
        if (item.status === "ready" || item.status === "failed") {
          results[item.id] = {
            url: item.url,
            id: item.id,
            status: item.status,
            thumb_url: item.thumb_url,
            poster_url: item.poster_url,
            width: item.width ?? undefined,
            height: item.height ?? undefined,
            duration: item.duration ?? undefined,
          }
          pending.delete(item.id)
        }
      }
    } catch {
      /* keep polling */
    }
    options.onProgress?.(ids.length - pending.size, ids.length)
    if (pending.size) await new Promise((resolve) => setTimeout(resolve, interval))
  }

  return results
}

export type UploadLimits = {
  tier: "admin" | "pro" | "free"
  is_admin: boolean
  original_quality_allowed: boolean
  limits: {
    hard_max_mb: number
    image_max_mb: number
    video_max_mb: number
    voice_max_mb: number
    post_files: number
    quota_mb: number
    daily_upload_mb: number
    uploads_per_hour: number
  }
  disk: { used_percent: number; free_bytes: number; warn: boolean; blocked: boolean }
}

/** Current server limits for this account (used to size the UI copy). */
export async function fetchUploadLimits(authHeaders?: Record<string, string>): Promise<UploadLimits | null> {
  try {
    const res = await fetch("/api/media/upload", { headers: authHeaders, cache: "no-store" })
    const payload = await parseJsonResponse<any>(res)
    if (!res.ok) return null
    return (payload.data || payload) as UploadLimits
  } catch {
    return null
  }
}
