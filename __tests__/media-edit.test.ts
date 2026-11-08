import { describe, expect, it } from "vitest"
import {
  buildEditedVideoUrl,
  clampVideoTrim,
  isAnimatedImageFile,
  isEditableImageFile,
  isVideoFile,
  mediaFileKey,
  readVideoEdit,
  videoEditIsNoop,
} from "@/lib/media-edit"

const BASE = "https://res.cloudinary.com/loop/video/upload/v1712345678/loops/clip.mp4"

function file(name: string, type: string): File {
  return new File(["x"], name, { type })
}

describe("video edits", () => {
  it("writes start and end offsets into the delivery URL", () => {
    const url = buildEditedVideoUrl(BASE, { start: 2.5, end: 9, muted: false })
    expect(url).toBe("https://res.cloudinary.com/loop/video/upload/so_2.5,eo_9/v1712345678/loops/clip.mp4")
  })

  it("mutes through the URL instead of re-encoding", () => {
    expect(buildEditedVideoUrl(BASE, { start: 0, end: null, muted: true })).toBe(
      "https://res.cloudinary.com/loop/video/upload/ac_none/v1712345678/loops/clip.mp4",
    )
  })

  it("replaces an existing trim rather than stacking one", () => {
    const first = buildEditedVideoUrl(BASE, { start: 1, end: 5, muted: true })
    const second = buildEditedVideoUrl(first, { start: 3, end: 8, muted: false })
    expect(second).toBe("https://res.cloudinary.com/loop/video/upload/so_3,eo_8/v1712345678/loops/clip.mp4")
    expect(second.match(/so_/g)).toHaveLength(1)
  })

  it("passes non-Cloudinary URLs and no-op edits through untouched", () => {
    expect(buildEditedVideoUrl("https://cdn.example.com/clip.mp4", { start: 2, end: 4, muted: true })).toBe(
      "https://cdn.example.com/clip.mp4",
    )
    expect(buildEditedVideoUrl(BASE, { start: 0, end: null, muted: false })).toBe(BASE)
  })

  it("reads a saved trim back out of the URL", () => {
    expect(readVideoEdit(buildEditedVideoUrl(BASE, { start: 4, end: 12, muted: true }))).toEqual({
      start: 4,
      end: 12,
      muted: true,
    })
    expect(readVideoEdit(BASE)).toBeNull()
  })

  it("keeps a trim inside the clip with a usable minimum", () => {
    const edit = clampVideoTrim(30, 12, 20)
    expect(edit.start).toBeCloseTo(19.5)
    expect(edit.end).toBeNull()
    expect(videoEditIsNoop(clampVideoTrim(0, 20, 20))).toBe(true)
  })
})

describe("file detection", () => {
  it("treats clips as videos even when the browser reports no MIME type", () => {
    expect(isVideoFile(file("clip.MOV", ""))).toBe(true)
    expect(isVideoFile(file("still.jpg", "image/jpeg"))).toBe(false)
  })

  it("leaves animated and vector images out of the raster editor", () => {
    expect(isEditableImageFile(file("photo.png", "image/png"))).toBe(true)
    expect(isAnimatedImageFile(file("loop.gif", "image/gif"))).toBe(true)
    expect(isEditableImageFile(file("loop.gif", "image/gif"))).toBe(false)
    expect(isEditableImageFile(file("icon.svg", "image/svg+xml"))).toBe(false)
  })

  it("keys files without colliding two uploads with the same name", () => {
    const a = new File(["a"], "photo.jpg", { type: "image/jpeg", lastModified: 1 })
    const b = new File(["bb"], "photo.jpg", { type: "image/jpeg", lastModified: 2 })
    expect(mediaFileKey(a)).not.toBe(mediaFileKey(b))
  })
})
