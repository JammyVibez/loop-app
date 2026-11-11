"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Crop, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import {
  clampOffset,
  coverScale,
  scaleOffset,
  type CropOffset,
} from "@/lib/image-crop"

/**
 * ImageCropDialog — plain-canvas cropper (no extra dependencies).
 *
 * The frame is fixed: the image is scaled to "cover" it and the user pans,
 * zooms and rotates the image underneath. The same `paint()` routine draws the
 * preview and the exported bitmap, so what you see is what gets uploaded.
 *
 * The framing maths lives in lib/image-crop.ts so it can be unit-tested.
 */

/** Internal preview resolution; the canvas is scaled to fit via CSS. */
const CANVAS_W = 600
const MIN_ZOOM = 1
const MAX_ZOOM = 4

export interface ImageCropDialogProps {
  /** The picked file. Pass `null` (with `open={false}`) to close. */
  file: File | null
  open: boolean
  /** width / height of the crop frame — 1 for avatars, 3 for banners. */
  aspect: number
  title?: string
  description?: string
  /** Circular mask (avatars). */
  shape?: "circle" | "rect"
  /** Width of the exported image, in px. Height follows `aspect`. */
  outputWidth?: number
  /** Keep the primary action disabled while an upload is in flight. */
  busy?: boolean
  onCancel: () => void
  /** Receives the cropped file — or the original when "Use original" is picked. */
  onConfirm: (file: File) => void | Promise<void>
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

type PaintArgs = {
  rotation: number
  zoom: number
  /** Pan offset in destination pixels (frame centre ↔ image centre). */
  offset: CropOffset
  w: number
  h: number
}

function paint(ctx: CanvasRenderingContext2D, img: HTMLImageElement, args: PaintArgs) {
  const { rotation, zoom, offset, w, h } = args
  ctx.save()
  ctx.clearRect(0, 0, w, h)
  ctx.translate(w / 2 + offset.x, h / 2 + offset.y)
  ctx.rotate((rotation * Math.PI) / 180)
  const scale = coverScale(img.naturalWidth, img.naturalHeight, rotation, { width: w, height: h }) * zoom
  ctx.scale(scale, scale)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  ctx.restore()
}

export function ImageCropDialog({
  file,
  open,
  aspect,
  title = "Crop image",
  description,
  shape = "rect",
  outputWidth,
  busy = false,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null)

  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const frameH = Math.max(1, Math.round(CANVAS_W / aspect))

  // Decode the picked file (and reset the framing) every time a new file opens.
  useEffect(() => {
    if (!open || !file) return
    let cancelled = false
    setImage(null)
    imageRef.current = null
    setLoadFailed(false)
    setError(null)
    setZoom(1)
    setRotation(0)
    setOffset({ x: 0, y: 0 })
    setSaving(false)

    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      imageRef.current = img
      setImage(img)
    }
    img.onerror = () => {
      if (!cancelled) setLoadFailed(true)
    }
    img.src = url

    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
      if (imageRef.current === img) imageRef.current = null
    }
  }, [open, file])

  /** Keep the image covering the frame — no empty corners, ever. */
  const clampForFrame = useCallback(
    (next: CropOffset, zoomValue: number, rotationValue: number) => {
      const img = imageRef.current
      if (!img) return next
      return clampOffset(next, {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        rotation: rotationValue,
        zoom: zoomValue,
        frame: { width: CANVAS_W, height: frameH },
      })
    },
    [frameH],
  )

  // Draw the preview (+ the mask that hides the parts outside the final crop).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    if (canvas.width !== CANVAS_W) canvas.width = CANVAS_W
    if (canvas.height !== frameH) canvas.height = frameH

    paint(ctx, image, { rotation, zoom, offset, w: CANVAS_W, h: frameH })

    if (shape === "circle") {
      const radius = Math.min(CANVAS_W, frameH) / 2
      ctx.save()
      ctx.fillStyle = "rgba(0,0,0,0.55)"
      ctx.beginPath()
      ctx.rect(0, 0, CANVAS_W, frameH)
      ctx.arc(CANVAS_W / 2, frameH / 2, radius, 0, Math.PI * 2, true)
      ctx.fill("evenodd")
      ctx.restore()
      ctx.save()
      ctx.strokeStyle = "rgba(255,255,255,0.85)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(CANVAS_W / 2, frameH / 2, radius - 1, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }, [image, rotation, zoom, offset, frameH, shape])

  /** Zoom while keeping `focal` (frame-centre relative px) anchored. */
  const zoomTo = useCallback(
    (requested: number, focal: CropOffset = { x: 0, y: 0 }) => {
      const img = imageRef.current
      const next = clamp(requested, MIN_ZOOM, MAX_ZOOM)
      if (!img) {
        setZoom(next)
        return
      }
      const base = coverScale(img.naturalWidth, img.naturalHeight, rotation, {
        width: CANVAS_W,
        height: frameH,
      })
      const from = base * zoom
      const to = base * next
      setOffset((prev) => {
        const imgX = (focal.x - prev.x) / from
        const imgY = (focal.y - prev.y) / from
        return clampForFrame({ x: focal.x - imgX * to, y: focal.y - imgY * to }, next, rotation)
      })
      setZoom(next)
    },
    [clampForFrame, frameH, rotation, zoom],
  )

  // Wheel zoom needs a non-passive listener (React registers wheel as passive).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const factor = CANVAS_W / Math.max(1, rect.width)
      zoomTo(zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08), {
        x: (event.clientX - rect.left - rect.width / 2) * factor,
        y: (event.clientY - rect.top - rect.height / 2) * factor,
      })
    }
    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [zoom, zoomTo])

  const pinchDistance = () => {
    const [a, b] = [...pointers.current.values()]
    if (!a || !b) return 0
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      pinchStart.current = { distance: pinchDistance(), zoom }
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const rect = event.currentTarget.getBoundingClientRect()
    const factor = CANVAS_W / Math.max(1, rect.width)

    if (pointers.current.size >= 2) {
      const start = pinchStart.current
      const distance = pinchDistance()
      if (start && start.distance > 0 && distance > 0) {
        zoomTo(start.zoom * (distance / start.distance))
      }
      return
    }

    setOffset((prev) =>
      clampForFrame(
        {
          x: prev.x + (event.clientX - previous.x) * factor,
          y: prev.y + (event.clientY - previous.y) * factor,
        },
        zoom,
        rotation,
      ),
    )
  }

  const handlePointerEnd = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
  }

  const rotate = (delta: number) => {
    const nextRotation = rotation + delta
    setRotation(nextRotation)
    setOffset((prev) => clampForFrame(prev, zoom, nextRotation))
  }

  const handleConfirm = async () => {
    const img = imageRef.current
    if (!img) return
    setSaving(true)
    setError(null)
    try {
      const exportW = outputWidth ?? (aspect === 1 ? 512 : 1500)
      const exportH = Math.max(1, Math.round(exportW / aspect))
      const scale = exportW / CANVAS_W

      const canvas = document.createElement("canvas")
      canvas.width = exportW
      canvas.height = exportH
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Cropping isn't supported in this browser.")

      paint(ctx, img, {
        rotation,
        zoom,
        // Same pan, scaled to the exported size — keeps the crop identical.
        offset: scaleOffset(offset, scale),
        w: exportW,
        h: exportH,
      })

      const type = file?.type === "image/png" ? "image/png" : "image/jpeg"
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.92 : undefined),
      )
      if (!blob) throw new Error("Could not read the cropped image.")

      const base = (file?.name || "image").replace(/\.[^.]+$/, "") || "image"
      const ext = type === "image/png" ? "png" : "jpg"
      await onConfirm(new File([blob], `${base}-cropped.${ext}`, { type }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop this image.")
    } finally {
      setSaving(false)
    }
  }

  const disabled = saving || busy

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? "Drag to reposition, then zoom so the framing looks right."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/40">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onLostPointerCapture={handlePointerEnd}
              aria-label="Crop preview — drag to reposition"
              className="block w-full cursor-grab touch-none select-none active:cursor-grabbing"
              style={{ aspectRatio: `${CANVAS_W} / ${frameH}` }}
            />
            {!image && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-xs text-muted-foreground">
                {loadFailed ? "This image can't be edited here — use the original instead." : "Loading image…"}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              disabled={!image || disabled}
              onValueChange={([value]) => zoomTo(value ?? MIN_ZOOM)}
              aria-label="Zoom"
            />
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="ml-1 flex shrink-0 gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={!image || disabled}
                onClick={() => rotate(-90)}
                aria-label="Rotate left"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={!image || disabled}
                onClick={() => rotate(90)}
                aria-label="Rotate right"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Drag to reposition · scroll or pinch to zoom · rotate if the photo is sideways.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={disabled}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !file}
            onClick={() => file && void onConfirm(file)}
          >
            Use original
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={disabled || !image}>
            <Crop className="mr-2 h-4 w-4" />
            {saving || busy ? "Saving…" : "Crop & save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
