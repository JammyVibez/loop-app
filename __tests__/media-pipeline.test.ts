import { describe, expect, it, vi } from "vitest"

// Server media modules import the `server-only` marker, which throws outside a
// React Server Component bundle; the pipeline logic itself is pure.
vi.mock("server-only", () => ({}))

import { sniffMedia, shouldStayPng, type SniffedMedia } from "@/lib/media/magic"
import { extensionForRender } from "@/lib/media/upload-service"
import { isOurMediaUrl, storagePathFromUrl } from "@/lib/media/storage"
import { optimizeImageUrl } from "@/lib/optimize-image"

/** Bytes of a real file of each kind, just enough for the signature. */
function bytes(...parts: (string | number[])[]): Buffer {
  const chunks: Buffer[] = []
  for (const part of parts) {
    chunks.push(typeof part === "string" ? Buffer.from(part, "latin1") : Buffer.from(part))
  }
  return Buffer.concat(chunks)
}

const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF", [0, 1])
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "IHDR")
const GIF = bytes("GIF89a", [1, 0, 1, 0])
const WEBP = bytes("RIFF", [0x24, 0, 0, 0], "WEBPVP8 ")
const MP4 = bytes([0, 0, 0, 0x18], "ftypisom", [0, 0, 2, 0])
const MOV = bytes([0, 0, 0, 0x14], "ftypqt  ", [0, 0, 0, 0])
const WAV = bytes("RIFF", [0x24, 0, 0, 0], "WAVEfmt ")
const MP3 = bytes("ID3", [3, 0, 0, 0])
const SVG = bytes('<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>')
const LOTTIE = bytes('{"v":"5.7.4","fr":30,"ip":0,"op":60,"w":100,"h":100,"layers":[]}')
const ZIP = bytes([0x50, 0x4b, 0x03, 0x04], [0, 0], "doc.kind")
const PDF = bytes("%PDF-1.7\n")
const ELF = bytes([0x7f], "ELF", [2, 1, 1])

describe("magic-byte media validation", () => {
  it("accepts real images, video and audio regardless of extension", () => {
    expect(sniffMedia(JPEG)).toMatchObject({ ok: true, media: { family: "image", ext: "jpg" } })
    expect(sniffMedia(PNG)).toMatchObject({ ok: true, media: { family: "image", ext: "png" } })
    expect(sniffMedia(GIF)).toMatchObject({ ok: true, media: { family: "image", ext: "gif", animated: true } })
    expect(sniffMedia(WEBP)).toMatchObject({ ok: true, media: { family: "image", ext: "webp" } })
    expect(sniffMedia(MP4)).toMatchObject({ ok: true, media: { family: "video", ext: "mp4" } })
    expect(sniffMedia(MOV)).toMatchObject({ ok: true, media: { family: "video", ext: "mov" } })
    expect(sniffMedia(WAV)).toMatchObject({ ok: true, media: { family: "audio", ext: "wav" } })
    expect(sniffMedia(MP3)).toMatchObject({ ok: true, media: { family: "audio", ext: "mp3" } })
  })

  it("accepts sanitised SVG and Lottie JSON only", () => {
    expect(sniffMedia(SVG)).toMatchObject({ ok: true, media: { family: "vector", ext: "svg" } })
    expect(sniffMedia(LOTTIE)).toMatchObject({ ok: true, media: { family: "animation", ext: "json" } })
    expect(sniffMedia(bytes('{"hello":"world"}'))).toMatchObject({ ok: false })
  })

  it("refuses archives, documents, executables and markup even for admins", () => {
    for (const bad of [ZIP, PDF, ELF, bytes("<!DOCTYPE html><html></html>"), bytes([0x4d, 0x5a, 0x90, 0x00])]) {
      expect(sniffMedia(bad).ok).toBe(false)
    }
  })

  it("rejects empty and unknown content", () => {
    expect(sniffMedia(Buffer.alloc(0)).ok).toBe(false)
    expect(sniffMedia(bytes([1, 2, 3, 4, 5, 6, 7, 8])).ok).toBe(false)
  })

  it("keeps PNG only where transparency matters", () => {
    expect(shouldStayPng({ family: "image", format: "png", purpose: "emoji" })).toBe(true)
    expect(shouldStayPng({ family: "image", format: "png", folder: "badges" })).toBe(true)
    expect(shouldStayPng({ family: "image", format: "png", purpose: "post" })).toBe(false)
    expect(shouldStayPng({ family: "image", format: "jpeg", purpose: "emoji" })).toBe(false)
  })
})

describe("stored file extension", () => {
  const media = (over: Partial<SniffedMedia>): SniffedMedia => ({
    family: "image",
    mime: "image/jpeg",
    ext: "jpg",
    animated: false,
    format: "jpeg",
    ...over,
  })

  it("uses the container the background job writes for video and audio", () => {
    expect(extensionForRender(media({ family: "video", mime: "video/quicktime", ext: "mov", format: "quicktime" }), false, false)).toBe("mp4")
    expect(extensionForRender(media({ family: "audio", mime: "audio/wav", ext: "wav", format: "wav" }), false, false)).toBe("m4a")
  })

  it("keeps the source container when original quality is on", () => {
    expect(extensionForRender(media({ family: "video", mime: "video/webm", ext: "webm", format: "webm" }), false, true)).toBe("webm")
    expect(extensionForRender(media({ family: "image", ext: "gif", format: "gif" }), false, true)).toBe("gif")
  })

  it("converts ordinary images to WebP and keeps PNG/GIF where needed", () => {
    expect(extensionForRender(media({}), false, false)).toBe("webp")
    expect(extensionForRender(media({ ext: "png", mime: "image/png", format: "png" }), true, false)).toBe("png")
    expect(extensionForRender(media({ family: "image", ext: "gif", format: "gif" }), false, false)).toBe("gif")
  })
})

describe("media URL handling", () => {
  const relative = "/media/images/2026/11/abcdef0123456789.webp"
  const absolute = "https://loopapp.me/media/videos/2026/11/abcdef0123456789.mp4"

  it("recognises both relative and absolute own-media URLs, and nothing else", () => {
    expect(isOurMediaUrl(relative)).toBe(true)
    expect(isOurMediaUrl(absolute)).toBe(true)
    expect(isOurMediaUrl("https://res.cloudinary.com/demo/image/upload/a.jpg")).toBe(false)
    expect(isOurMediaUrl("https://example.com/media/a.jpg")).toBe(false)
    expect(isOurMediaUrl(null)).toBe(false)
  })

  it("maps a URL back to its storage path", () => {
    expect(storagePathFromUrl(relative)).toBe("images/2026/11/abcdef0123456789.webp")
    expect(storagePathFromUrl(absolute)).toBe("videos/2026/11/abcdef0123456789.mp4")
    expect(storagePathFromUrl("https://res.cloudinary.com/demo/image/upload/a.jpg")).toBeNull()
  })
})

describe("responsive image selection", () => {
  const master = "/media/images/2026/11/abcdef0123456789.webp"

  it("serves the small rendition in data-saver mode", () => {
    expect(optimizeImageUrl(master, 1200, { dataSaver: true })).toBe(
      "/media/images/2026/11/abcdef0123456789-480.webp",
    )
  })

  it("picks by requested width and leaves the master alone otherwise", () => {
    expect(optimizeImageUrl(master, 900)).toBe("/media/images/2026/11/abcdef0123456789-1024.webp")
    expect(optimizeImageUrl(master, 400)).toBe("/media/images/2026/11/abcdef0123456789-480.webp")
    expect(optimizeImageUrl(master)).toBe(master)
    expect(optimizeImageUrl(master, 1600)).toBe(master)
  })

  it("never rewrites animations, SVGs, Lottie or video", () => {
    for (const url of [
      "/media/images/2026/11/animated.gif",
      "/media/images/2026/11/vector.svg",
      "/media/images/2026/11/lottie.json",
      "/media/videos/2026/11/clip.mp4",
    ]) {
      expect(optimizeImageUrl(url, 400, { dataSaver: true })).toBe(url)
    }
  })

  it("keeps transforming legacy Cloudinary URLs", () => {
    expect(optimizeImageUrl("https://res.cloudinary.com/demo/image/upload/v1/a.jpg", 600)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_600/v1/a.jpg",
    )
  })
})
