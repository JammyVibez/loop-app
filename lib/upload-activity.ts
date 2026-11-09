/**
 * In-flight upload activity.
 *
 * Every call to `uploadMediaFile` registers here, so the app can show one
 * consistent progress indicator no matter which composer (post, reel, avatar,
 * DM, badge…) started the upload. Deliberately dependency-free and outside
 * React: the uploader is a plain module and several uploads can overlap.
 */

export type UploadActivitySnapshot = {
  /** Uploads currently in flight. */
  count: number
  /** Average percent across uploads that report one (null = indeterminate). */
  percent: number | null
  /** Label of the most recent upload. */
  label: string
  /** Recently finished: the indicator should play its success beat. */
  done: boolean
  /** Recently failed, with a short reason. */
  failed: string | null
}

type Entry = {
  label: string
  percent: number | null
  startedAt: number
}

const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()

let successUntil = 0
let failure: { message: string; until: number } | null = null
let sequence = 0

let snapshot: UploadActivitySnapshot = {
  count: 0,
  percent: null,
  label: "",
  done: false,
  failed: null,
}

function compute(): UploadActivitySnapshot {
  const now = Date.now()
  if (entries.size === 0) {
    const done = successUntil > now
    const recentFailure = failure && failure.until > now ? failure.message : null
    return { count: 0, percent: null, label: "", done, failed: recentFailure }
  }

  let newest: Entry | null = null
  let known = 0
  let sum = 0
  for (const entry of entries.values()) {
    if (entry.percent != null) {
      known += 1
      sum += entry.percent
    }
    if (!newest || entry.startedAt >= newest.startedAt) newest = entry
  }

  return {
    count: entries.size,
    percent: known ? Math.round(sum / known) : null,
    label: newest?.label || "Uploading",
    done: false,
    failed: null,
  }
}

function rebuild() {
  snapshot = compute()
  for (const listener of listeners) listener()
}

export function startUploadActivity(label: string): string {
  sequence += 1
  const id = `upload-${sequence}`
  entries.set(id, { label, percent: null, startedAt: Date.now() })
  successUntil = 0
  failure = null
  rebuild()
  return id
}

export function updateUploadActivity(id: string, percent: number, label?: string) {
  const entry = entries.get(id)
  if (!entry) return
  const next = Math.max(0, Math.min(100, Math.round(percent)))
  if (entry.percent === next && (!label || label === entry.label)) return
  entry.percent = next
  if (label) entry.label = label
  rebuild()
}

export function finishUploadActivity(id: string, ok: boolean, error?: string) {
  if (!entries.delete(id)) return
  if (ok) {
    successUntil = Date.now() + 1100
  } else {
    failure = { message: error || "Upload failed", until: Date.now() + 2600 }
  }
  rebuild()
}

export function subscribeUploadActivity(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getUploadActivitySnapshot(): UploadActivitySnapshot {
  return snapshot
}

const EMPTY: UploadActivitySnapshot = {
  count: 0,
  percent: null,
  label: "",
  done: false,
  failed: null,
}

export function getUploadActivityServerSnapshot(): UploadActivitySnapshot {
  return EMPTY
}

/** Friendly, on-brand copy for a file being uploaded. */
export function uploadActivityLabel(
  type: "image" | "video" | "audio" | "file",
  folder?: string,
): string {
  const where = (folder || "").toLowerCase()
  if (where.includes("avatar")) return "Uploading your new profile photo"
  if (where.includes("banner") || where.includes("cover")) return "Uploading your cover art"
  if (where.includes("badge") || where.includes("emoji") || where.includes("frame")) {
    return "Uploading your artwork"
  }
  if (where.includes("message") || where.includes("dm")) return "Sending your attachment"
  if (where.includes("moment")) return "Uploading your moment"
  if (where.includes("reel")) return "Uploading your reel"

  if (type === "video") return "Uploading your video"
  if (type === "audio") return "Uploading your audio"
  if (type === "image") return "Uploading your image"
  return "Uploading your file"
}
