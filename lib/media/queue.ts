import "server-only"
import { promises as fs } from "node:fs"
import path from "node:path"
import { createServerClient } from "@/lib/supabase"
import { absolutePath, internalAbsolutePath, publicUrl } from "./storage"
import { transcodeAudio, transcodeVideo } from "./processors"

/**
 * Background media queue.
 *
 * Video transcodes and audio normalisation take seconds to minutes, far longer
 * than an upload request should stay open, so the row is created immediately
 * with `processing_status = 'processing'` and the work happens here. On the VPS
 * the PM2 process is long-lived, so a job is kicked off right after the upload;
 * `POST /api/media/process` (cron / systemd timer) drains anything a restart
 * left behind, which is also the recovery path after an ffmpeg upgrade.
 *
 * Only one drain runs per process at a time, jobs are processed oldest-first,
 * and a failed job records its error instead of retrying forever.
 */

type MediaJobRow = {
  id: string
  user_id: string | null
  storage_path: string
  source_path: string | null
  media_type: string
  format: string | null
  folder: string | null
  purpose: string | null
  original_quality: boolean | null
  processing_attempts: number | null
  created_at: string
}

const MAX_ATTEMPTS = Number(process.env.MEDIA_MAX_PROCESSING_ATTEMPTS || 3)

export type JobResult = { id: string; ok: boolean; message?: string }

async function processOne(supabase: any, row: MediaJobRow): Promise<JobResult> {
  const sourceRel = row.source_path
  if (!sourceRel) {
    await supabase
      .from("media_uploads")
      .update({ processing_status: "failed", processing_error: "Source file missing" })
      .eq("id", row.id)
    return { id: row.id, ok: false, message: "Source file missing" }
  }

  const sourceAbs = internalAbsolutePath(sourceRel)
  const targetAbs = absolutePath(row.storage_path)
  const outDir = path.dirname(targetAbs)
  const base = path.basename(row.storage_path).replace(/\.[^.]+$/, "")

  try {
    await fs.access(sourceAbs)
  } catch {
    await supabase
      .from("media_uploads")
      .update({
        processing_status: "failed",
        processing_error: "Uploaded source was removed before processing",
        processing_attempts: (row.processing_attempts || 0) + 1,
      })
      .eq("id", row.id)
    return { id: row.id, ok: false, message: "Source file removed" }
  }

  try {
    if (row.media_type === "video") {
      const result = await transcodeVideo(sourceAbs, outDir, base)
      const stat = await fs.stat(result.mainPath)
      await supabase
        .from("media_uploads")
        .update({
          processing_status: "ready",
          processing_error: null,
          width: result.width || null,
          height: result.height || null,
          duration: result.duration || null,
          file_size: stat.size,
          file_type: "video/mp4",
          format: "mp4",
          thumb_url: result.posterPath ? publicUrl(relativeOf(result.posterPath)) : null,
          poster_url: result.posterPath ? publicUrl(relativeOf(result.posterPath)) : null,
          variants: result.posterPath ? { poster: publicUrl(relativeOf(result.posterPath)) } : {},
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id)
    } else if (row.media_type === "audio") {
      const result = await transcodeAudio(sourceAbs, outDir, base)
      const stat = await fs.stat(result.mainPath)
      // storage_path was registered as `.m4a` at upload time; keep that name.
      await supabase
        .from("media_uploads")
        .update({
          processing_status: "ready",
          processing_error: null,
          duration: result.duration || null,
          file_size: stat.size,
          file_type: "audio/mp4",
          format: "m4a",
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id)
    } else {
      // Images are processed inline; anything else here is already final.
      await supabase
        .from("media_uploads")
        .update({ processing_status: "ready", processing_error: null, processed_at: new Date().toISOString() })
        .eq("id", row.id)
    }

    if (row.source_path) {
      await fs.rm(sourceAbs, { force: true }).catch(() => {})
      await supabase.from("media_uploads").update({ source_path: null }).eq("id", row.id)
    }

    return { id: row.id, ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const attempts = (row.processing_attempts || 0) + 1
    const final = attempts >= MAX_ATTEMPTS
    await supabase
      .from("media_uploads")
      .update({
        processing_status: final ? "failed" : "processing",
        processing_error: message.slice(0, 900),
        processing_attempts: attempts,
      })
      .eq("id", row.id)
    console.error(`[media-queue] job ${row.id} failed (attempt ${attempts}/${MAX_ATTEMPTS}):`, message)
    return { id: row.id, ok: false, message }
  }
}

/** Relative-to-root path for a processed file. */
function relativeOf(absoluteFile: string): string {
  const root = path.resolve(process.env.MEDIA_STORAGE_ROOT || "/var/loop-uploads")
  return path.relative(root, absoluteFile).split(path.sep).join("/")
}

let activeDrain: Promise<JobResult[]> | null = null

/**
 * Process queued jobs. Safe to call from a cron endpoint or on boot: concurrent
 * callers share the same drain instead of trans coding the same file twice.
 */
export async function drainMediaQueue(limit = 5): Promise<JobResult[]> {
  if (activeDrain) return activeDrain
  activeDrain = (async () => {
    const supabase: any = createServerClient()
    const results: JobResult[] = []
    let query = supabase
      .from("media_uploads")
      .select(
        "id, user_id, storage_path, source_path, media_type, format, folder, purpose, original_quality, processing_attempts, created_at",
      )
      .eq("processing_status", "processing")
      .not("source_path", "is", null)
      .order("created_at", { ascending: true })
      .limit(limit)

    const { data, error } = await query
    if (error) {
      console.error("[media-queue] could not read jobs:", error.message)
      return results
    }

    for (const row of (data || []) as MediaJobRow[]) {
      results.push(await processOne(supabase, row))
    }
    return results
  })()

  try {
    return await activeDrain
  } finally {
    activeDrain = null
  }
}

/** Fire-and-forget kick used right after an upload. */
export function kickMediaQueue(): void {
  if (process.env.MEDIA_PROCESSING_DISABLED === "1") return
  setImmediate(() => {
    void drainMediaQueue(3).catch((error) => console.error("[media-queue] drain error:", error))
  })
}

/** Re-run a failed or stuck job from the Media Library. */
export async function retryMediaJob(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase: any = createServerClient()
  const { data, error } = await supabase
    .from("media_uploads")
    .select("id, processing_status, source_path")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) return { ok: false, message: "Media not found" }
  if (!data.source_path) return { ok: false, message: "The original file is no longer available to re-process" }

  await supabase
    .from("media_uploads")
    .update({ processing_status: "processing", processing_attempts: 0, processing_error: null })
    .eq("id", id)
  kickMediaQueue()
  return { ok: true }
}
