/**
 * Editing rules for media attached to a post.
 *
 * Images are actually re-encoded in the browser (see
 * components/ui/post-media-editor.tsx) so the crop and filter are baked into
 * the upload. Videos are not re-encoded: the trim and mute choices are written
 * into the Cloudinary delivery URL with `so_` / `eo_` / `ac_none`, which is
 * instant for the poster and gives every player the trimmed clip without a
 * second upload.
 *
 * The URL helpers are pure so the offline behaviour (non-Cloudinary uploads,
 * already-trimmed URLs, clearing an edit) can be unit-tested.
 */

export type VideoEdit = {
  /** Seconds into the source clip. */
  start: number
  /** Seconds into the source clip; `null` means "to the end". */
  end: number | null
  muted: boolean
}

export const DEFAULT_VIDEO_EDIT: VideoEdit = { start: 0, end: null, muted: false }

/** Shortest clip we let someone publish, in seconds. */
export const MIN_VIDEO_SECONDS = 0.5

const VIDEO_FILE = /\.(mp4|webm|mov|m4v|ogv|ogg)(\?|$)/i
const ANIMATED_IMAGE = /\.(gif|apng)(\?|$)/i

export function isVideoFile(file: Pick<File, "type" | "name"> | null | undefined): boolean {
  if (!file) return false
  return file.type.startsWith("video/") || VIDEO_FILE.test(file.name)
}

export function isImageFile(file: Pick<File, "type" | "name"> | null | undefined): boolean {
  if (!file) return false
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|avif|heic|heif|bmp)(\?|$)/i.test(file.name)
}

/**
 * GIFs (and animated PNGs) are left alone: re-encoding an animation through a
 * canvas would publish a still frame, which is worse than no editing at all.
 */
export function isAnimatedImageFile(file: Pick<File, "type" | "name"> | null | undefined): boolean {
  if (!file) return false
  return file.type === "image/gif" || ANIMATED_IMAGE.test(file.name)
}

export function isEditableImageFile(file: Pick<File, "type" | "name"> | null | undefined): boolean {
  return isImageFile(file) && !isAnimatedImageFile(file) && !/\.svg(\?|$)/i.test(file?.name || "")
}

/** Stable identity for a File while it sits in the composer. */
export function mediaFileKey(file: Pick<File, "name" | "size" | "lastModified">): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return `${minutes}:${String(rest).padStart(2, "0")}`
}

/** Keep a trim inside the clip and at least MIN_VIDEO_SECONDS long. */
export function clampVideoTrim(start: number, end: number | null, duration: number): VideoEdit {
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0
  const safeStart = Math.min(Math.max(0, start || 0), Math.max(0, total - MIN_VIDEO_SECONDS))
  const requestedEnd = end == null ? total : Math.min(end, total)
  const safeEnd = Math.max(safeStart + MIN_VIDEO_SECONDS, requestedEnd)
  return { start: round(safeStart), end: safeEnd >= total ? null : round(safeEnd), muted: false }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function videoEditIsNoop(edit: VideoEdit): boolean {
  return edit.start <= 0 && edit.end == null && !edit.muted
}

/** Seconds the published clip will run for. */
export function videoEditDuration(edit: VideoEdit, duration: number): number {
  const end = edit.end == null ? duration : edit.end
  return Math.max(0, end - edit.start)
}

const CLOUDINARY_VIDEO = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+)$/i
const TOKEN_LIST = /^(?:[a-z]{1,3}_[^,/]+)(?:,(?:[a-z]{1,3}_[^,/]+))*$/i

/**
 * Write an edit into a Cloudinary video URL.
 *
 * Returns the URL untouched when it is not a Cloudinary video or when the edit
 * changes nothing, so callers can always pass the result straight through.
 * Existing `so_`, `eo_` and `ac_` tokens are replaced rather than stacked, so
 * re-editing a clip is idempotent.
 */
export function buildEditedVideoUrl(url: string, edit: VideoEdit): string {
  if (!url || videoEditIsNoop(edit)) return url
  const match = url.match(CLOUDINARY_VIDEO)
  if (!match) return url

  const [, head, tail] = match
  const segments = tail.split("/")
  const hasTransform = TOKEN_LIST.test(segments[0] || "")
  const existing = hasTransform ? segments.shift()!.split(",") : []

  const kept = existing.filter((token) => {
    const normalised = token.toLowerCase()
    return !normalised.startsWith("so_") && !normalised.startsWith("eo_") && !normalised.startsWith("ac_")
  })

  const added: string[] = []
  if (edit.start > 0) added.push(`so_${round(edit.start)}`)
  if (edit.end != null) added.push(`eo_${round(edit.end)}`)
  if (edit.muted) added.push("ac_none")

  const tokens = [...kept, ...added]
  if (tokens.length === 0) return `${head}${segments.join("/")}`
  return `${head}${tokens.join(",")}/${segments.join("/")}`
}

/** True when this URL can carry a trim/mute edit. */
export function supportsVideoTrim(url: string | null | undefined): boolean {
  return Boolean(url && CLOUDINARY_VIDEO.test(url))
}

/** Read the start offset Cloudinary has already applied, for re-editing. */
export function readVideoEdit(url: string): VideoEdit | null {
  const match = url.match(CLOUDINARY_VIDEO)
  if (!match) return null
  const transform = match[2].split("/")[0] || ""
  if (!TOKEN_LIST.test(transform)) return null
  let start = 0
  let end: number | null = null
  let muted = false
  for (const token of transform.split(",")) {
    if (token.startsWith("so_")) start = Number.parseFloat(token.slice(3)) || 0
    if (token.startsWith("eo_")) {
      const parsed = Number.parseFloat(token.slice(3))
      end = Number.isFinite(parsed) ? parsed : null
    }
    if (token === "ac_none") muted = true
  }
  if (start === 0 && end === null && !muted) return null
  return { start, end, muted }
}

export type ImageFilterId = "original" | "vivid" | "warm" | "cool" | "mono" | "fade"

export const IMAGE_FILTERS: { id: ImageFilterId; label: string; css: string }[] = [
  { id: "original", label: "Original", css: "none" },
  { id: "vivid", label: "Vivid", css: "saturate(1.28) contrast(1.06)" },
  { id: "warm", label: "Warm", css: "sepia(0.16) saturate(1.2) brightness(1.04)" },
  { id: "cool", label: "Cool", css: "saturate(0.94) hue-rotate(-8deg) brightness(1.04) contrast(1.03)" },
  { id: "mono", label: "Mono", css: "grayscale(1) contrast(1.08)" },
  { id: "fade", label: "Fade", css: "saturate(0.8) contrast(0.9) brightness(1.08)" },
]

export function imageFilterCss(id: ImageFilterId): string {
  return IMAGE_FILTERS.find((filter) => filter.id === id)?.css || "none"
}

/** Aspect presets offered in the editor. `null` means "keep the photo's own". */
export const IMAGE_ASPECTS: { id: string; label: string; aspect: number | null }[] = [
  { id: "original", label: "Original", aspect: null },
  { id: "square", label: "Square", aspect: 1 },
  { id: "portrait", label: "4:5", aspect: 4 / 5 },
  { id: "wide", label: "16:9", aspect: 16 / 9 },
]
