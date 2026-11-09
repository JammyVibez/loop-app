import { Buffer } from "node:buffer"

/**
 * Content-based media typing.
 *
 * The client controls its filename and its `Content-Type`, so neither is ever
 * trusted. A file is admitted only when its leading bytes match a real image,
 * video, audio, vector or Lottie signature — and archives, executables and
 * documents are recognised explicitly so the rejection message can say what
 * the file actually is.
 */

export type MediaFamily = "image" | "video" | "audio" | "vector" | "animation"

export type SniffedMedia = {
  family: MediaFamily
  /** Canonical MIME type of the detected format. */
  mime: string
  /** Canonical extension (no dot), always derived from the bytes. */
  ext: string
  /** True for GIF/APNG/WebP animations and Lottie/AVIF where relevant. */
  animated: boolean
  /** Container-level label, e.g. "quicktime", "webp", "flac". */
  format: string
}

export type SniffResult =
  | { ok: true; media: SniffedMedia }
  | { ok: false; reason: string; detected?: string }

const MAX_SNIFF_BYTES = 64 * 1024

function ascii(buf: Buffer, start: number, end: number): string {
  return buf.subarray(start, end).toString("latin1")
}

function isFtyp(buf: Buffer): boolean {
  return buf.length >= 12 && ascii(buf, 4, 8) === "ftyp"
}

function ftypBrand(buf: Buffer): string {
  if (buf.length < 12) return ""
  return ascii(buf, 8, 12).trim()
}

/** Map ISO-BMFF brands to a family. */
function sniffIsoBmff(buf: Buffer): SniffResult | null {
  if (!isFtyp(buf)) return null
  const brand = ftypBrand(buf)
  const major = brand.toLowerCase()

  const imageBrands = ["avif", "avis", "heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]
  if (imageBrands.includes(major)) {
    return {
      ok: true,
      media: {
        family: "image",
        mime: major.startsWith("avi") ? "image/avif" : "image/heic",
        ext: major.startsWith("avi") ? "avif" : "heic",
        animated: major === "avis" || major === "msf1",
        format: major.startsWith("avi") ? "avif" : "heic",
      },
    }
  }

  const brandList = ascii(buf, 8, Math.min(buf.length, 32)).toLowerCase()
  if (brandList.includes("qt  ")) {
    return { ok: true, media: { family: "video", mime: "video/quicktime", ext: "mov", animated: true, format: "quicktime" } }
  }
  if (brandList.includes("m4a")) {
    return { ok: true, media: { family: "audio", mime: "audio/mp4", ext: "m4a", animated: false, format: "m4a" } }
  }
  if (brandList.includes("m4v")) {
    return { ok: true, media: { family: "video", mime: "video/x-m4v", ext: "m4v", animated: true, format: "m4v" } }
  }

  const videoBrands = ["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "msdh", "msix", "f4v "]
  if (videoBrands.some((b) => brandList.includes(b))) {
    return { ok: true, media: { family: "video", mime: "video/mp4", ext: "mp4", animated: true, format: "mp4" } }
  }
  return null
}

/** Signatures that must be refused outright, with a label for the error. */
const FORBIDDEN_SIGNATURES: { label: string; test: (buf: Buffer) => boolean }[] = [
  { label: "ZIP archive", test: (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) },
  { label: "GZIP archive", test: (b) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b },
  { label: "RAR archive", test: (b) => ascii(b, 0, 4) === "Rar!" },
  { label: "7-Zip archive", test: (b) => b.length > 6 && b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf },
  { label: "TAR archive", test: (b) => b.length > 262 && ascii(b, 257, 262) === "ustar" },
  { label: "PDF document", test: (b) => ascii(b, 0, 5) === "%PDF-" },
  { label: "ELF executable", test: (b) => b.length > 4 && b[0] === 0x7f && ascii(b, 1, 4) === "ELF" },
  { label: "Windows executable", test: (b) => ascii(b, 0, 2) === "MZ" },
  { label: "Mach-O executable", test: (b) => b.length > 4 && ((b[0] === 0xcf && b[1] === 0xfa && b[2] === 0xed && b[3] === 0xfe) || (b[0] === 0xca && b[1] === 0xfe && b[2] === 0xba && b[3] === 0xbe)) },
  { label: "Java class file", test: (b) => b.length > 4 && b[0] === 0xca && b[1] === 0xfe && b[2] === 0xba && b[3] === 0xbe },
  { label: "SQLite database", test: (b) => ascii(b, 0, 15) === "SQLite format 3" },
  { label: "Windows shortcut", test: (b) => b.length > 8 && ascii(b, 4, 8) === "L\u0000\u0000\u0000" },
  { label: "Wave audio (legacy RIFF)", test: () => false },
]

type MarkupKind = "svg" | "html" | "markup" | null

function markupKind(text: string): MarkupKind {
  const head = text.slice(0, 2048).trimStart().toLowerCase()
  if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.includes("<body")) return "html"
  if (head.startsWith("<svg")) return "svg"
  if (head.startsWith("<?xml")) {
    return text.slice(0, 8192).toLowerCase().includes("<svg") ? "svg" : "markup"
  }
  if (head.startsWith("<")) return "markup"
  return null
}

function looksLikeJson(text: string): Record<string, unknown> | null {
  const trimmed = text.slice(0, Math.min(text.length, 512 * 1024)).trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null
  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function isLottieJson(value: Record<string, unknown>): boolean {
  const v = value as any
  return (
    (typeof v.v === "string" || typeof v.v === "number") &&
    typeof v.fr === "number" &&
    Array.isArray(v.layers)
  )
}

/**
 * Identify a file from its bytes. `mimeHint` is only used to disambiguate
 * formats that share a container (Ogg audio vs. video) — never to accept a file
 * the bytes do not support.
 */
export function sniffMedia(buf: Buffer, mimeHint?: string | null): SniffResult {
  if (!buf.length) return { ok: false, reason: "The file is empty." }
  const head = buf.subarray(0, Math.min(buf.length, MAX_SNIFF_BYTES))

  for (const sig of FORBIDDEN_SIGNATURES) {
    if (sig.label === "Wave audio (legacy RIFF)") continue
    if (sig.test(head)) return { ok: false, reason: `${sig.label}s are not allowed.`, detected: sig.label }
  }

  // ── Images ──────────────────────────────────────────────────────────────
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return { ok: true, media: { family: "image", mime: "image/jpeg", ext: "jpg", animated: false, format: "jpeg" } }
  }
  if (head.length >= 8 && head[0] === 0x89 && ascii(head, 1, 4) === "PNG" && head[4] === 0x0d && head[5] === 0x0a) {
    const isApng = head.includes(Buffer.from("acTL"))
    return { ok: true, media: { family: "image", mime: "image/png", ext: "png", animated: isApng, format: "png" } }
  }
  if (head.length >= 6 && (ascii(head, 0, 6) === "GIF87a" || ascii(head, 0, 6) === "GIF89a")) {
    return { ok: true, media: { family: "image", mime: "image/gif", ext: "gif", animated: true, format: "gif" } }
  }
  if (head.length >= 12 && ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "WEBP") {
    const animated = head.includes(Buffer.from("ANIM")) || head.includes(Buffer.from("ANMF"))
    return { ok: true, media: { family: "image", mime: "image/webp", ext: "webp", animated, format: "webp" } }
  }
  if (head.length >= 2 && ascii(head, 0, 2) === "BM") {
    return { ok: true, media: { family: "image", mime: "image/bmp", ext: "bmp", animated: false, format: "bmp" } }
  }

  const iso = sniffIsoBmff(head)
  if (iso) return iso

  // ── Video containers ────────────────────────────────────────────────────
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    // Matroska / WebM share the EBML header.
    const text = head.subarray(0, 4096).toString("latin1")
    if (text.includes("webm")) {
      return { ok: true, media: { family: "video", mime: "video/webm", ext: "webm", animated: true, format: "webm" } }
    }
    return { ok: true, media: { family: "video", mime: "video/x-matroska", ext: "mkv", animated: true, format: "matroska" } }
  }
  if (head.length >= 12 && ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "AVI ") {
    return { ok: true, media: { family: "video", mime: "video/x-msvideo", ext: "avi", animated: true, format: "avi" } }
  }

  // ── Audio ───────────────────────────────────────────────────────────────
  if (head.length >= 12 && ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "WAVE") {
    return { ok: true, media: { family: "audio", mime: "audio/wav", ext: "wav", animated: false, format: "wav" } }
  }
  if (head.length >= 4 && ascii(head, 0, 4) === "fLaC") {
    return { ok: true, media: { family: "audio", mime: "audio/flac", ext: "flac", animated: false, format: "flac" } }
  }
  if (head.length >= 3 && ascii(head, 0, 3) === "ID3") {
    return { ok: true, media: { family: "audio", mime: "audio/mpeg", ext: "mp3", animated: false, format: "mp3" } }
  }
  if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0) {
    const isAac = head.length >= 2 && (head[1] & 0xf6) === 0xf0
    return {
      ok: true,
      media: isAac
        ? { family: "audio", mime: "audio/aac", ext: "aac", animated: false, format: "aac" }
        : { family: "audio", mime: "audio/mpeg", ext: "mp3", animated: false, format: "mp3" },
    }
  }
  if (head.length >= 4 && ascii(head, 0, 4) === "OggS") {
    // Ogg can carry Vorbis/Opus audio or Theora video. Only audio is accepted
    // from regular users; admins may upload Ogg video, detected on transcode.
    const hint = (mimeHint || "").toLowerCase()
    const audio = hint.startsWith("audio/") || !hint.startsWith("video/")
    return audio
      ? { ok: true, media: { family: "audio", mime: "audio/ogg", ext: "ogg", animated: false, format: "ogg" } }
      : { ok: true, media: { family: "video", mime: "video/ogg", ext: "ogv", animated: true, format: "ogg" } }
  }
  if (head.length >= 3 && ascii(head, 0, 3) === "AMR") {
    return { ok: true, media: { family: "audio", mime: "audio/amr", ext: "amr", animated: false, format: "amr" } }
  }

  // ── Text-based formats: SVG, Lottie ─────────────────────────────────────
  const probe = buf.subarray(0, Math.min(buf.length, 8 * 1024))
  if (!probe.includes(0)) {
    const text = probe.toString("utf8")
    const markup = markupKind(text)
    if (markup === "svg") {
      return { ok: true, media: { family: "vector", mime: "image/svg+xml", ext: "svg", animated: text.includes("<animate"), format: "svg" } }
    }
    const json = looksLikeJson(text)
    if (json && isLottieJson(json)) {
      return { ok: true, media: { family: "animation", mime: "application/json", ext: "json", animated: true, format: "lottie" } }
    }
    if (json) {
      return { ok: false, reason: "Only Lottie animation JSON can be uploaded, not arbitrary JSON.", detected: "JSON" }
    }
    if (markup === "html") return { ok: false, reason: "HTML documents are not allowed.", detected: "HTML document" }
    if (markup === "markup") return { ok: false, reason: "Markup documents are not allowed.", detected: "markup document" }
  }

  return {
    ok: false,
    reason: "That file is not a recognised image, video or audio format.",
    detected: "unknown",
  }
}

/** Files that need a pixel-level alpha channel and must stay PNG. */
export function shouldStayPng(input: { family: string; format: string; purpose?: string; folder?: string }): boolean {
  const purpose = `${input.purpose || ""} ${input.folder || ""}`.toLowerCase()
  if (input.format === "png") {
    if (/(badge|frame|emoji|checkmark|icon|logo|overlay|sticker|avatar-frame|asset)/.test(purpose)) return true
  }
  return false
}

/** Formats that are copied byte-for-byte when "original quality" is on. */
export function isAlreadyWebSafe(media: SniffedMedia): boolean {
  return ["webp", "png", "gif", "jpg", "jpeg", "avif"].includes(media.format)
}
