import "server-only"
import { spawn } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { randomName } from "./storage"
import type { SniffedMedia } from "./magic"

/**
 * Media processing that replaces what Cloudinary used to do implicitly.
 *
 * Images are re-encoded with sharp: EXIF (including GPS) is dropped, colour is
 * normalised, the long edge is capped at 2048px, and a WebP plus a small
 * thumbnail and mid-size variant are written so phones never download an
 * original. GIFs keep their animation by being copied verbatim (with a static
 * WebP thumbnail for lists); PNG stays PNG only where transparency matters
 * (badges, frames, emojis).
 *
 * Video and audio are transcoded with ffmpeg in a background job — H.264/AAC
 * MP4 at 720p with a poster frame, audio to normalised AAC. Everything is
 * best-effort about *how* it is encoded and strict about *what* is accepted:
 * the bytes were already validated by magic-byte sniffing before this runs.
 */

const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg"
const FFPROBE_BIN = process.env.FFPROBE_PATH || "ffprobe"

let ffmpegAvailable: boolean | null = null

export async function isFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable
  ffmpegAvailable = await new Promise<boolean>((resolve) => {
    try {
      const child = spawn(FFMPEG_BIN, ["-version"], { stdio: "ignore" })
      const timer = setTimeout(() => {
        child.kill("SIGKILL")
        resolve(false)
      }, 4000)
      child.on("error", () => {
        clearTimeout(timer)
        resolve(false)
      })
      child.on("exit", (code) => {
        clearTimeout(timer)
        resolve(code === 0)
      })
    } catch {
      resolve(false)
    }
  })
  return ffmpegAvailable
}

export type ImageVariant = {
  label: string
  path: string
  width: number
  height: number
  bytes: number
}

export type ProcessedImage = {
  /** Stored filename of the primary rendition. */
  mainPath: string
  mainWidth: number
  mainHeight: number
  mainBytes: number
  mainExt: string
  thumbPath: string | null
  variants: ImageVariant[]
}

/**
 * `sharp` ships a callable default export, but the ESM interop shape differs
 * between builds; a narrow local signature keeps the call sites honest without
 * depending on how the typings are re-exported.
 */
type SharpFactory = (input?: unknown, options?: Record<string, unknown>) => any

let sharpPromise: Promise<SharpFactory> | null = null

async function loadSharp(): Promise<SharpFactory> {
  if (!sharpPromise) {
    sharpPromise = import("sharp").then((mod) => ((mod as any).default || mod) as SharpFactory)
  }
  return sharpPromise
}

const IMAGE_MAX_EDGE = 2048
const IMAGE_MID_EDGE = 1024
const IMAGE_SMALL_EDGE = 480
const THUMB_EDGE = 320
const WEBP_QUALITY = 82

export type ImageProcessOptions = {
  /** Absolute path of the validated source file. */
  inputPath: string
  /** Absolute directory to write into. */
  outDir: string
  /** Path (relative to the media root) that the main rendition should occupy. */
  targetStoragePath: string
  media: SniffedMedia
  /** Admin "original quality": copy pixels and animation untouched. */
  originalQuality: boolean
  /** Keep PNG when transparency matters (badges/frames/emojis). */
  keepPng?: boolean
  /** Keep an animated image (GIF, animated WebP, APNG) exactly as uploaded. */
  keepAnimation?: boolean
}

async function writeVariant(
  sharp: SharpFactory,
  input: string,
  outFile: string,
  maxEdge: number,
  opts: { animated?: boolean } = {},
): Promise<ImageVariant | null> {
  // Read the header on a throwaway instance: reusing one sharp instance after
  // `metadata()` is not guaranteed across libvips releases.
  const meta = await sharp(input, { animated: Boolean(opts.animated), failOn: "none" }).metadata()
  const width = meta.width || 0
  const height = meta.height || 0
  if (!width || !height) return null
  const output = sharp(input, { animated: Boolean(opts.animated), failOn: "none" })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
  // `withMetadata` is intentionally never called: dropping metadata is what
  // strips EXIF, GPS and camera serials.
  const info = await output.webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(outFile)
  return { label: String(maxEdge), path: outFile, width: info.width, height: info.height, bytes: info.size }
}

export async function processImage(options: ImageProcessOptions): Promise<ProcessedImage> {
  const sharp = await loadSharp()
  await fs.mkdir(options.outDir, { recursive: true })

  const targetBase = path.basename(options.targetStoragePath).replace(/\.[^.]+$/, "")
  const keepAnimation = options.keepAnimation ?? options.media.format === "gif"
  const keepPng = options.keepPng ?? (options.media.format === "png" && options.keepPng !== false)

  if (options.originalQuality) {
    // Byte-for-byte copy: exact pixels, exact palette, exact animation.
    const ext = options.media.ext
    const mainName = `${targetBase}.${ext}`
    const mainAbs = path.join(options.outDir, mainName)
    await fs.copyFile(options.inputPath, mainAbs)
    const stat = await fs.stat(mainAbs)
    const meta = await sharp(options.inputPath, { animated: keepAnimation }).metadata().catch(() => ({} as any))
    let thumbPath: string | null = null
    // Original quality keeps the master file untouched but still gets the
    // responsive renditions, so a phone can pick a small copy instead of the
    // full-size creative.
    const variants: ImageVariant[] = []
    if (meta?.width && meta?.height) {
      for (const { edge, label } of [
        { edge: IMAGE_MID_EDGE, label: "1024" },
        { edge: IMAGE_SMALL_EDGE, label: "480" },
        { edge: THUMB_EDGE, label: "thumb" },
      ]) {
        const file = path.join(options.outDir, `${targetBase}-${label}.webp`)
        try {
          const variant = await writeVariant(sharp, options.inputPath, file, edge)
          if (variant) {
            variants.push({ ...variant, label })
            if (label === "thumb") thumbPath = file
          }
        } catch {
          /* a single failed rendition must not fail the upload */
        }
      }
    }
    return {
      mainPath: mainAbs,
      mainWidth: Number(meta?.width) || 0,
      mainHeight: Number(meta?.height) || 0,
      mainBytes: stat.size,
      mainExt: ext,
      thumbPath,
      variants,
    }
  }

  if (keepAnimation) {
    // Animations are kept in their original container (GIF, animated WebP or
    // APNG); converting them to WebP would silently freeze the animation.
    const ext = options.media.ext || "gif"
    const mainAbs = path.join(options.outDir, `${targetBase}.${ext}`)
    await fs.copyFile(options.inputPath, mainAbs)
    const stat = await fs.stat(mainAbs)
    const meta = await sharp(options.inputPath, { animated: true }).metadata().catch(() => ({} as any))
    // Static WebP renditions keep lists and data-saver views from animating
    // dozens of GIFs; the animation itself is untouched. The 480/1024 copies
    // must exist because the responsive URL guesser points at them.
    const variants: ImageVariant[] = []
    let thumbPath: string | null = null
    for (const { edge, label } of [
      { edge: IMAGE_MID_EDGE, label: "1024" },
      { edge: IMAGE_SMALL_EDGE, label: "480" },
      { edge: THUMB_EDGE, label: "thumb" },
    ]) {
      try {
        const variant = await writeVariant(sharp, options.inputPath, path.join(options.outDir, `${targetBase}-${label}.webp`), edge)
        if (!variant) continue
        variants.push({ ...variant, label })
        if (label === "thumb") thumbPath = variant.path
      } catch {
        /* skip a failed rendition */
      }
    }
    return {
      mainPath: mainAbs,
      mainWidth: Number(meta?.width) || 0,
      mainHeight: Number(meta?.height) || 0,
      mainBytes: stat.size,
      mainExt: ext,
      thumbPath,
      variants,
    }
  }

  const metadata = await sharp(options.inputPath, { failOn: "none" }).metadata()
  const sourceWidth = metadata.width || 0
  const sourceHeight = metadata.height || 0
  if (!sourceWidth || !sourceHeight) throw new Error("That image could not be decoded.")

  const outExt = keepPng ? "png" : "webp"
  const mainAbs = path.join(options.outDir, `${targetBase}.${outExt}`)

  const base = sharp(options.inputPath, { failOn: "none", animated: false })
    .rotate() // applies EXIF orientation, then metadata is dropped
    .resize({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE, fit: "inside", withoutEnlargement: true })

  const mainInfo = keepPng
    ? await base.png({ compressionLevel: 9, palette: false }).toFile(mainAbs)
    : await base.webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(mainAbs)

  const variants: ImageVariant[] = []
  const midSmall: { edge: number; suffix: string }[] = [
    { edge: IMAGE_MID_EDGE, suffix: "-1024" },
    { edge: IMAGE_SMALL_EDGE, suffix: "-480" },
  ]

  for (const { edge, suffix } of midSmall) {
    // Generated even for sources smaller than the target: `withoutEnlargement`
    // keeps the pixels, and the file existing means a responsive URL never
    // 404s for small uploads.
    const file = path.join(options.outDir, `${targetBase}${suffix}.webp`)
    try {
      const variant = await writeVariant(sharp, options.inputPath, file, edge)
      if (variant) variants.push({ ...variant, label: String(edge) })
    } catch {
      /* skip this rendition */
    }
  }

  const thumbAbs = path.join(options.outDir, `${targetBase}-thumb.webp`)
  const thumb = await writeVariant(sharp, options.inputPath, thumbAbs, THUMB_EDGE)
  variants.push({ ...(thumb || { label: "thumb", path: thumbAbs, width: 0, height: 0, bytes: 0 }), label: "thumb" })

  return {
    mainPath: mainAbs,
    mainWidth: mainInfo.width,
    mainHeight: mainInfo.height,
    mainBytes: mainInfo.size,
    mainExt: outExt,
    thumbPath: variants.find((v) => v.label === "thumb")?.path || null,
    variants,
  }
}

/** Rasterise a sanitised SVG into a WebP thumbnail. Failure is non-fatal. */
export async function renderSvgThumbnail(inputPath: string, outDir: string, base: string): Promise<string | null> {
  try {
    const sharp = await loadSharp()
    const file = path.join(outDir, `${base}-thumb.webp`)
    await sharp(inputPath, { density: 192 })
      .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(file)
    return file
  } catch {
    return null
  }
}

// ── ffmpeg ────────────────────────────────────────────────────────────────

function run(cmd: string, args: string[], timeoutMs: number): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    let stderr = ""
    let settled = false
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] })
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        child.kill("SIGKILL")
        resolve({ code: -1, stderr: stderr + "\n[timed out]" })
      }
    }, timeoutMs)
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk)
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000)
    })
    child.on("error", (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code: -2, stderr: `${error.message}\n${stderr}` })
    })
    child.on("exit", (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code: code ?? -1, stderr })
    })
  })
}

export type VideoResult = {
  mainPath: string
  width: number
  height: number
  duration: number
  posterPath: string | null
}

/** Transcode to H.264/AAC MP4, capped at 720p, with a poster frame. */
export async function transcodeVideo(inputPath: string, outDir: string, base: string): Promise<VideoResult> {
  if (!(await isFfmpegAvailable())) {
    throw new Error("Video processing is unavailable on this server (ffmpeg is not installed).")
  }
  await fs.mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `${base}.mp4`)
  const posterPath = path.join(outDir, `${base}-poster.jpg`)

  const args = [
    "-y",
    "-i", inputPath,
    // Keep the long edge at 720 and preserve aspect ratio; never upscale.
    "-vf", "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:v", "libx264",
    "-profile:v", "high",
    "-preset", "veryfast",
    "-crf", "23",
    "-maxrate", "3000k",
    "-bufsize", "6000k",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ac", "2",
    "-movflags", "+faststart",
    outPath,
  ]

  const result = await run(FFMPEG_BIN, args, Number(process.env.MEDIA_FFMPEG_TIMEOUT_MS || 20 * 60 * 1000))
  if (result.code !== 0) {
    await fs.rm(outPath, { force: true }).catch(() => {})
    throw new Error(`Video transcode failed: ${result.stderr.split("\n").slice(-4).join(" ") || "ffmpeg error"}`)
  }

  let poster: string | null = null
  const posterRun = await run(
    FFMPEG_BIN,
    ["-y", "-ss", "0.5", "-i", outPath, "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "3", posterPath],
    60_000,
  )
  if (posterRun.code === 0) {
    poster = posterPath
  } else {
    const fallback = await run(
      FFMPEG_BIN,
      ["-y", "-i", outPath, "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "3", posterPath],
      60_000,
    )
    poster = fallback.code === 0 ? posterPath : null
  }

  const probe = await probeMedia(outPath)
  return {
    mainPath: outPath,
    width: probe?.width || 0,
    height: probe?.height || 0,
    duration: probe?.duration || 0,
    posterPath: poster,
  }
}

export type AudioResult = {
  mainPath: string
  duration: number
  width: number
  height: number
  ext: string
}

/** Normalise audio to AAC/M4A at a sane bitrate (loudness-normalised). */
export async function transcodeAudio(inputPath: string, outDir: string, base: string): Promise<AudioResult> {
  if (!(await isFfmpegAvailable())) {
    throw new Error("Audio processing is unavailable on this server (ffmpeg is not installed).")
  }
  await fs.mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `${base}.m4a`)
  const args = [
    "-y",
    "-i", inputPath,
    "-vn",
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-movflags", "+faststart",
    outPath,
  ]
  const result = await run(FFMPEG_BIN, args, Number(process.env.MEDIA_FFMPEG_TIMEOUT_MS || 10 * 60 * 1000))
  if (result.code !== 0) {
    await fs.rm(outPath, { force: true }).catch(() => {})
    throw new Error(`Audio transcode failed: ${result.stderr.split("\n").slice(-4).join(" ") || "ffmpeg error"}`)
  }
  const probe = await probeMedia(outPath)
  return { mainPath: outPath, duration: probe?.duration || 0, width: 0, height: 0, ext: "m4a" }
}

export type ProbeResult = { width: number; height: number; duration: number }

/** ffprobe is optional; ffmpeg-only hosts simply get zeroed metadata. */
export async function probeMedia(file: string): Promise<ProbeResult | null> {
  return new Promise((resolve) => {
    const child = spawn(
      FFPROBE_BIN,
      ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file],
      { stdio: ["ignore", "pipe", "ignore"] },
    )
    let out = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      resolve(null)
    }, 8000)
    child.stdout?.on("data", (chunk) => {
      out += String(chunk)
      if (out.length > 100_000) out = out.slice(0, 100_000)
    })
    child.on("error", () => {
      clearTimeout(timer)
      resolve(null)
    })
    child.on("exit", () => {
      clearTimeout(timer)
      try {
        const parsed = JSON.parse(out)
        const stream = parsed?.streams?.[0]
        const duration = Number(parsed?.format?.duration) || 0
        resolve({ width: Number(stream?.width) || 0, height: Number(stream?.height) || 0, duration })
      } catch {
        resolve(null)
      }
    })
  })
}

/**
 * Extract a poster frame without transcoding. Used for admin uploads that keep
 * their original bytes ("original quality") but still need a thumbnail in the
 * library and a poster for the player.
 */
export async function extractPoster(inputPath: string, outDir: string, base: string): Promise<string | null> {
  if (!(await isFfmpegAvailable())) return null
  await fs.mkdir(outDir, { recursive: true })
  const posterPath = path.join(outDir, `${base}-poster.jpg`)
  const first = await run(
    FFMPEG_BIN,
    ["-y", "-ss", "0.5", "-i", inputPath, "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "3", posterPath],
    45_000,
  )
  if (first.code === 0) return posterPath
  const fallback = await run(
    FFMPEG_BIN,
    ["-y", "-i", inputPath, "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "3", posterPath],
    45_000,
  )
  return fallback.code === 0 ? posterPath : null
}

/** Unique base name for an upload's renditions. */
export function renditionBase(): string {
  return randomName()
}
