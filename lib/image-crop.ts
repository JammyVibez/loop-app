/**
 * Geometry for the image cropper (components/ui/image-crop-dialog.tsx).
 *
 * Kept pure and free of DOM/React so the framing maths — which decides what
 * part of a photo ends up in the saved avatar/banner — is unit-testable.
 *
 * Coordinates: `offset` is the pan applied to the image, expressed in
 * destination (frame) pixels. The image is drawn centred, so the point of the
 * image sitting at the frame centre is `-offset / scale`.
 */

export type CropOffset = { x: number; y: number }
export type CropFrame = { width: number; height: number }

/** Natural size of the image with `rotation` applied. */
export function rotatedNaturalSize(
  naturalWidth: number,
  naturalHeight: number,
  rotation: number,
): CropFrame & { w: number; h: number } {
  const quarter = ((rotation % 360) + 360) % 360
  const swapped = quarter === 90 || quarter === 270
  const w = swapped ? naturalHeight : naturalWidth
  const h = swapped ? naturalWidth : naturalHeight
  return { w, h, width: w, height: h }
}

/** Scale at which the rotated image exactly covers the frame. */
export function coverScale(
  naturalWidth: number,
  naturalHeight: number,
  rotation: number,
  frame: CropFrame,
): number {
  const { w, h } = rotatedNaturalSize(naturalWidth, naturalHeight, rotation)
  if (w <= 0 || h <= 0) return 1
  return Math.max(frame.width / w, frame.height / h)
}

export type ClampOptions = {
  naturalWidth: number
  naturalHeight: number
  rotation: number
  zoom: number
  frame: CropFrame
}

/** `-0` is a valid number but a pointless value to hand back to state. */
function normalize(value: number) {
  return value === 0 ? 0 : value
}

/**
 * Keep the image covering the frame: panning can never expose an empty corner,
 * which is what makes "the preview is the result" true.
 */
export function clampOffset(offset: CropOffset, options: ClampOptions): CropOffset {
  const { naturalWidth, naturalHeight, rotation, zoom, frame } = options
  const scale = coverScale(naturalWidth, naturalHeight, rotation, frame) * zoom
  const drawn = rotatedNaturalSize(naturalWidth, naturalHeight, rotation)
  const maxX = Math.max(0, (drawn.w * scale - frame.width) / 2)
  const maxY = Math.max(0, (drawn.h * scale - frame.height) / 2)
  return {
    x: normalize(Math.min(maxX, Math.max(-maxX, offset.x))),
    y: normalize(Math.min(maxY, Math.max(-maxY, offset.y))),
  }
}

/** Rescale a pan between two frame sizes (preview → exported bitmap). */
export function scaleOffset(offset: CropOffset, factor: number): CropOffset {
  return { x: offset.x * factor, y: offset.y * factor }
}

/**
 * Which point of the source image is under the centre of the frame.
 * Identical values for the preview and the export mean the crop the user
 * framed is the crop that gets saved.
 */
export function imagePointAtFrameCentre(
  offset: CropOffset,
  options: ClampOptions,
): { x: number; y: number } {
  const scale = coverScale(
    options.naturalWidth,
    options.naturalHeight,
    options.rotation,
    options.frame,
  ) * options.zoom
  return { x: -offset.x / scale, y: -offset.y / scale }
}
