import { describe, expect, it } from "vitest"
import {
  clampOffset,
  coverScale,
  imagePointAtFrameCentre,
  rotatedNaturalSize,
  scaleOffset,
  type ClampOptions,
  type CropFrame,
} from "@/lib/image-crop"

const AVATAR: CropFrame = { width: 600, height: 600 }
const BANNER: CropFrame = { width: 600, height: 200 }

/** Photos people actually upload: portrait, landscape, square, panorama. */
const SOURCES = [
  { naturalWidth: 4032, naturalHeight: 3024 }, // 4:3 landscape
  { naturalWidth: 3024, naturalHeight: 4032 }, // 3:4 portrait
  { naturalWidth: 2000, naturalHeight: 2000 },
  { naturalWidth: 8000, naturalHeight: 1200 }, // panorama
]

function options(
  source: { naturalWidth: number; naturalHeight: number },
  frame: CropFrame,
  overrides: Partial<ClampOptions> = {},
): ClampOptions {
  return { ...source, rotation: 0, zoom: 1, frame, ...overrides }
}

describe("cropper geometry", () => {
  it("swaps dimensions for quarter turns and normalises negative rotations", () => {
    expect(rotatedNaturalSize(400, 200, 0)).toMatchObject({ w: 400, h: 200 })
    expect(rotatedNaturalSize(400, 200, 90)).toMatchObject({ w: 200, h: 400 })
    expect(rotatedNaturalSize(400, 200, 180)).toMatchObject({ w: 400, h: 200 })
    expect(rotatedNaturalSize(400, 200, 270)).toMatchObject({ w: 200, h: 400 })
    expect(rotatedNaturalSize(400, 200, -90)).toMatchObject({ w: 200, h: 400 })
  })

  it("covers the frame at the resting zoom, for every source and rotation", () => {
    for (const frame of [AVATAR, BANNER]) {
      for (const source of SOURCES) {
        for (const rotation of [0, 90, 180, 270]) {
          const scale = coverScale(source.naturalWidth, source.naturalHeight, rotation, frame)
          const drawn = rotatedNaturalSize(source.naturalWidth, source.naturalHeight, rotation)
          expect(drawn.w * scale).toBeGreaterThanOrEqual(frame.width - 1e-6)
          expect(drawn.h * scale).toBeGreaterThanOrEqual(frame.height - 1e-6)
        }
      }
    }
  })

  it("clamps panning so no empty corner can ever be exposed", () => {
    for (const frame of [AVATAR, BANNER]) {
      for (const source of SOURCES) {
        for (const zoom of [1, 1.5, 4]) {
          const opts = options(source, frame, { zoom })
          // Drawn size = rotated natural size × cover scale × zoom.
          const scale = coverScale(source.naturalWidth, source.naturalHeight, 0, frame) * zoom
          const drawn = rotatedNaturalSize(source.naturalWidth, source.naturalHeight, 0)
          const maxPanX = (drawn.w * scale - frame.width) / 2
          const maxPanY = (drawn.h * scale - frame.height) / 2

          // A wildly dragged image must still cover the frame edge to edge.
          const clamped = clampOffset({ x: 99_999, y: -99_999 }, opts)
          expect(clamped.x).toBeCloseTo(maxPanX, 6)
          expect(clamped.y).toBeCloseTo(-maxPanY, 6)

          expect(Math.abs(clamped.x)).toBeLessThanOrEqual(maxPanX + 1e-6)
          expect(Math.abs(clamped.y)).toBeLessThanOrEqual(maxPanY + 1e-6)
        }
      }
    }
  })

  it("cannot pan at all when the image exactly fits (the resting zoom)", () => {
    // 600x600 source into a 600x600 frame: any pan would expose an edge.
    const opts = options({ naturalWidth: 600, naturalHeight: 600 }, AVATAR, { zoom: 1 })
    expect(clampOffset({ x: 120, y: -80 }, opts)).toEqual({ x: 0, y: 0 })
  })

  it("pans by exactly half of the overflow once zoomed in", () => {
    // 300px source into a 600px frame needs scale 2 to cover it; at zoom 2 the
    // drawn image is 1200px wide, leaving 300px of slack on each side.
    const opts = options({ naturalWidth: 300, naturalHeight: 300 }, AVATAR, { zoom: 2 })
    expect(clampOffset({ x: 40, y: 40 }, opts)).toEqual({ x: 40, y: 40 })
    expect(clampOffset({ x: 400, y: -400 }, opts)).toEqual({ x: 300, y: -300 })
  })

  it("keeps the same crop in the preview and in the exported bitmap", () => {
    const preview = options(SOURCES[1], AVATAR, { zoom: 2.4 })
    const exported: ClampOptions = {
      ...preview,
      frame: { width: 512, height: 512 },
    }

    const previewOffset = clampOffset({ x: 180, y: -60 }, preview)
    // The export is generated from the preview offset scaled by the size ratio,
    // exactly as the dialog does it.
    const exportOffset = scaleOffset(previewOffset, 512 / 600)

    const centrePreview = imagePointAtFrameCentre(previewOffset, preview)
    const centreExport = imagePointAtFrameCentre(exportOffset, exported)

    expect(centreExport.x).toBeCloseTo(centrePreview.x, 6)
    expect(centreExport.y).toBeCloseTo(centrePreview.y, 6)
  })

  it("is stable for rotated sources in the same way", () => {
    const preview = options(SOURCES[0], BANNER, { rotation: 90, zoom: 1.7 })
    const exported: ClampOptions = { ...preview, frame: { width: 1500, height: 500 } }

    const previewOffset = clampOffset({ x: -240, y: 75 }, preview)
    const exportOffset = scaleOffset(previewOffset, 1500 / 600)

    const centrePreview = imagePointAtFrameCentre(previewOffset, preview)
    const centreExport = imagePointAtFrameCentre(exportOffset, exported)

    expect(centreExport.x).toBeCloseTo(centrePreview.x, 6)
    expect(centreExport.y).toBeCloseTo(centrePreview.y, 6)
  })

  it("returns a safe scale for a degenerate (zero-sized) source", () => {
    expect(coverScale(0, 0, 0, AVATAR)).toBe(1)
  })
})
