"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Check,
  Crop,
  Film,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Scissors,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  clampOffset,
  coverScale,
  scaleOffset,
  type CropOffset,
} from "@/lib/image-crop"
import {
  DEFAULT_VIDEO_EDIT,
  IMAGE_ASPECTS,
  IMAGE_FILTERS,
  MIN_VIDEO_SECONDS,
  clampVideoTrim,
  formatClock,
  imageFilterCss,
  isEditableImageFile,
  isVideoFile,
  mediaFileKey,
  type ImageFilterId,
  type VideoEdit,
} from "@/lib/media-edit"

/**
 * PostMediaEditor — the "adjust before you post" step.
 *
 * Images are framed, rotated, filtered and re-encoded in the browser, so the
 * file that leaves the composer is exactly the crop on screen. Videos are not
 * re-encoded (that would mean waiting for the clip to play through): the
 * trim and mute choices are returned as a `VideoEdit` and written into the
 * Cloudinary delivery URL after upload, which every player honours.
 */

const CANVAS_W = 640
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const MAX_EXPORT_WIDTH = 2000

export interface PostMediaEditorProps {
  file: File | null
  open: boolean
  /** Existing trim, when re-opening an already-edited clip. */
  initialVideoEdit?: VideoEdit | null
  busy?: boolean
  onClose: () => void
  onApplyImage: (file: File, original: File) => void | Promise<void>
  onApplyVideo: (edit: VideoEdit, original: File) => void
}

type PaintArgs = {
  rotation: number
  zoom: number
  filter: string
  offset: CropOffset
  w: number
  h: number
}

function paint(ctx: CanvasRenderingContext2D, img: HTMLImageElement, args: PaintArgs) {
  const { rotation, zoom, filter, offset, w, h } = args
  ctx.save()
  ctx.clearRect(0, 0, w, h)
  ctx.filter = filter
  ctx.translate(w / 2 + offset.x, h / 2 + offset.y)
  ctx.rotate((rotation * Math.PI) / 180)
  const scale = coverScale(img.naturalWidth, img.naturalHeight, rotation, { width: w, height: h }) * zoom
  ctx.scale(scale, scale)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  ctx.restore()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function PostMediaEditor({
  file,
  open,
  initialVideoEdit,
  busy = false,
  onClose,
  onApplyImage,
  onApplyVideo,
}: PostMediaEditorProps) {
  const isVideo = isVideoFile(file)
  const isImage = isEditableImageFile(file)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isVideo ? <Film className="h-4 w-4 text-violet-400" /> : <Crop className="h-4 w-4 text-violet-400" />}
            {isVideo ? "Trim before posting" : "Adjust before posting"}
          </DialogTitle>
          <DialogDescription>
            {isVideo
              ? "Pick the part of the clip that should go out and whether it keeps its sound."
              : "Frame, zoom and colour the photo. What you see here is the file that gets posted."}
          </DialogDescription>
        </DialogHeader>

        {isVideo && file ? (
          <VideoEditor
            key={mediaFileKey(file)}
            file={file}
            initial={initialVideoEdit || DEFAULT_VIDEO_EDIT}
            busy={busy}
            onCancel={onClose}
            onApply={(edit) => onApplyVideo(edit, file)}
          />
        ) : isImage && file ? (
          <ImageEditor
            key={mediaFileKey(file)}
            file={file}
            busy={busy}
            onCancel={onClose}
            onApply={(edited) => void onApplyImage(edited, file)}
          />
        ) : (
          <div className="space-y-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {file
                ? "This file can't be edited here — animated images and SVGs keep their original motion."
                : "Pick a file to edit."}
            </p>
            <Button variant="outline" className="rounded-full" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Images                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function ImageEditor({
  file,
  busy,
  onCancel,
  onApply,
}: {
  file: File
  busy: boolean
  onCancel: () => void
  onApply: (file: File) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null)

  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [naturalAspect, setNaturalAspect] = useState(1)
  const [aspectId, setAspectId] = useState("original")
  const [filter, setFilter] = useState<ImageFilterId>("original")
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const aspect = IMAGE_ASPECTS.find((preset) => preset.id === aspectId)?.aspect ?? naturalAspect
  const frameH = Math.max(1, Math.round(CANVAS_W / aspect))
  const activeFilter = imageFilterCss(filter)

  useEffect(() => {
    let cancelled = false
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      imageRef.current = img
      setNaturalAspect(img.naturalWidth / Math.max(1, img.naturalHeight))
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
  }, [file])

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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (canvas.width !== CANVAS_W) canvas.width = CANVAS_W
    if (canvas.height !== frameH) canvas.height = frameH
    paint(ctx, image, { rotation, zoom, filter: activeFilter, offset, w: CANVAS_W, h: frameH })
  }, [image, rotation, zoom, offset, frameH, activeFilter])

  const zoomTo = useCallback(
    (requested: number, focal: CropOffset = { x: 0, y: 0 }) => {
      const img = imageRef.current
      const next = clamp(requested, MIN_ZOOM, MAX_ZOOM)
      if (!img) {
        setZoom(next)
        return
      }
      const base = coverScale(img.naturalWidth, img.naturalHeight, rotation, { width: CANVAS_W, height: frameH })
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
    if (pointers.current.size === 2) pinchStart.current = { distance: pinchDistance(), zoom }
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
      if (start && start.distance > 0 && distance > 0) zoomTo(start.zoom * (distance / start.distance))
      return
    }
    setOffset((prev) =>
      clampForFrame(
        { x: prev.x + (event.clientX - previous.x) * factor, y: prev.y + (event.clientY - previous.y) * factor },
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
    const next = rotation + delta
    setRotation(next)
    setOffset((prev) => clampForFrame(prev, zoom, next))
  }

  const chooseAspect = (id: string) => {
    setAspectId(id)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  const save = async () => {
    const img = imageRef.current
    if (!img) return
    const outputW = Math.min(MAX_EXPORT_WIDTH, img.naturalWidth)
    const outputH = Math.max(1, Math.round(outputW / aspect))
    const scale = outputW / CANVAS_W
    setSaving(true)
    setError(null)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = outputW
      canvas.height = outputH
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Editing isn't supported in this browser.")
      paint(ctx, img, {
        rotation,
        zoom,
        filter: activeFilter,
        offset: scaleOffset(offset, scale),
        w: outputW,
        h: outputH,
      })

      const type = file.type === "image/png" ? "image/png" : "image/jpeg"
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.92 : undefined),
      )
      if (!blob) throw new Error("Could not save the edited image.")
      const base = file.name.replace(/\.[^.]+$/, "") || "image"
      const ext = type === "image/png" ? "png" : "jpg"
      onApply(new File([blob], `${base}-edited.${ext}`, { type, lastModified: Date.now() }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the edited image.")
    } finally {
      setSaving(false)
    }
  }

  const disabled = saving || busy

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_190px]">
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(45deg,#17171b_25%,transparent_25%,transparent_75%,#17171b_75%),linear-gradient(45deg,#17171b_25%,#101014_25%,#101014_75%,#17171b_75%)] bg-[length:20px_20px] bg-[position:0_0,10px_10px]">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={handlePointerEnd}
            aria-label="Edit preview — drag to reposition"
            className="block w-full cursor-grab touch-none select-none active:cursor-grabbing"
            style={{ aspectRatio: `${CANVAS_W} / ${frameH}` }}
          />
          {!image && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-xs text-muted-foreground">
              {loadFailed ? "This image can't be opened in the browser — you can still post the original." : "Loading image…"}
            </div>
          )}
          <span className="pointer-events-none absolute bottom-2.5 left-2.5 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm">
            Drag · pinch or scroll to zoom
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2.5">
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
          </div>
          <div className="flex gap-1">
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={!image || disabled} onClick={() => rotate(-90)} aria-label="Rotate left">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={!image || disabled} onClick={() => rotate(90)} aria-label="Rotate right">
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter className="gap-2 border-t border-border/60 pt-4 sm:gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={disabled}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={() => onApply(file)} disabled={disabled}>
            Use original
          </Button>
          <Button type="button" onClick={save} disabled={disabled || !image}>
            <Check className="mr-2 h-4 w-4" />
            {saving || busy ? "Saving…" : "Apply adjustments"}
          </Button>
        </DialogFooter>
      </div>

      <div className="space-y-4">
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Crop</p>
          <div className="grid grid-cols-2 gap-1.5">
            {IMAGE_ASPECTS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => chooseAspect(preset.id)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                  aspectId === preset.id
                    ? "border-foreground/30 bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Colour</p>
          <div className="grid grid-cols-2 gap-1.5">
            {IMAGE_FILTERS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setFilter(preset.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-colors",
                  filter === preset.id
                    ? "border-foreground/30 bg-muted text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{
                    background:
                      "conic-gradient(from 210deg, #f97316, #ef4444, #a855f7, #3b82f6, #22c55e, #f97316)",
                    filter: preset.css === "none" ? undefined : preset.css,
                  }}
                />
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <p className="rounded-xl border border-border/60 bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          GIFs and SVGs skip this step so their animation and sharpness survive.
        </p>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Video                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function VideoEditor({
  file,
  initial,
  busy,
  onCancel,
  onApply,
}: {
  file: File
  initial: VideoEdit
  busy: boolean
  onCancel: () => void
  onApply: (edit: VideoEdit) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(initial.muted)
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState<number | null>(initial.end)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const effectiveEnd = end ?? duration
  const trimmed = start > 0 || end != null || muted
  const selectedSeconds = Math.max(0, effectiveEnd - start)
  const tooShort = duration > 0 && selectedSeconds < MIN_VIDEO_SECONDS

  const seek = (time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = clamp(time, 0, Math.max(0, duration || video.duration || 0))
    setCurrent(video.currentTime)
  }

  const updateStart = (value: number) => {
    const max = Math.max(0, effectiveEnd - MIN_VIDEO_SECONDS)
    const next = clamp(value, 0, max)
    setStart(next)
    seek(next)
    if (next >= effectiveEnd) setEnd(next + MIN_VIDEO_SECONDS)
  }

  const updateEnd = (value: number) => {
    const next = clamp(value, start + MIN_VIDEO_SECONDS, duration || value)
    setEnd(next >= duration ? null : next)
    seek(next)
  }

  const togglePlay = async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      if (video.currentTime < start || video.currentTime >= effectiveEnd) seek(start)
      try {
        await video.play()
        setPlaying(true)
      } catch {
        setPlaying(false)
      }
    } else {
      video.pause()
      setPlaying(false)
    }
  }

  const playSelection = async () => {
    const video = videoRef.current
    if (!video) return
    seek(start)
    try {
      await video.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
        {url ? (
          <video
            ref={videoRef}
            src={url}
            playsInline
            muted={muted}
            className="max-h-[52vh] w-full bg-black object-contain"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget
              const total = Number.isFinite(video.duration) ? video.duration : 0
              setDuration(total)
              setStart(Math.min(initial.start, Math.max(0, total - MIN_VIDEO_SECONDS)))
              setEnd(initial.end != null && initial.end < total ? initial.end : null)
              seek(Math.min(initial.start, total))
            }}
            onTimeUpdate={(event) => {
              const video = event.currentTarget
              setCurrent(video.currentTime)
              if (effectiveEnd > 0 && video.currentTime >= effectiveEnd) {
                video.pause()
                setPlaying(false)
                seek(start)
              }
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : null}

        <button
          type="button"
          onClick={() => void togglePlay()}
          className="absolute inset-0 grid place-items-center bg-black/0 transition-colors hover:bg-black/10"
          aria-label={playing ? "Pause preview" : "Play preview"}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
          </span>
        </button>

        <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full bg-black/70 px-2 py-1 text-[11px] font-medium tabular-nums text-white">
          {formatClock(current)} / {formatClock(duration)}
        </span>
      </div>

      <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Scissors className="h-3.5 w-3.5 text-violet-400" />
            Trim
          </p>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {formatClock(start)} – {formatClock(effectiveEnd)} · {formatClock(selectedSeconds)}
          </p>
        </div>

        <div className="space-y-2.5">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Start</span>
              <button type="button" className="font-medium text-violet-400 hover:underline" onClick={() => updateStart(current)}>
                Set to playhead
              </button>
            </div>
            <Slider
              value={[start]}
              min={0}
              max={Math.max(MIN_VIDEO_SECONDS, duration - MIN_VIDEO_SECONDS)}
              step={0.1}
              disabled={!duration}
              onValueChange={([value]) => updateStart(value ?? 0)}
              aria-label="Trim start"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>End</span>
              <button type="button" className="font-medium text-violet-400 hover:underline" onClick={() => updateEnd(current)}>
                Set to playhead
              </button>
            </div>
            <Slider
              value={[effectiveEnd]}
              min={MIN_VIDEO_SECONDS}
              max={Math.max(MIN_VIDEO_SECONDS, duration)}
              step={0.1}
              disabled={!duration}
              onValueChange={([value]) => updateEnd(value ?? 0)}
              aria-label="Trim end"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => void playSelection()} disabled={!duration}>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Play selection
          </Button>
          <div className="flex items-center gap-2">
            {muted ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-muted-foreground" />}
            <label htmlFor="publish-muted" className="text-xs font-medium text-muted-foreground">
              Publish without sound
            </label>
            <Switch id="publish-muted" checked={muted} onCheckedChange={setMuted} />
          </div>
        </div>

        {tooShort ? (
          <p className="text-[11px] text-destructive">Keep at least {MIN_VIDEO_SECONDS}s in the selection.</p>
        ) : null}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Trim and mute are applied when the clip is delivered, so there is no re-encoding wait. The original file stays
          in your uploads.
        </p>
      </div>

      <DialogFooter className="gap-2 border-t border-border/60 pt-4 sm:gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onApply({ ...DEFAULT_VIDEO_EDIT })}
          disabled={busy}
        >
          Use full clip
        </Button>
        <Button
          type="button"
          onClick={() => onApply({ start, end, muted })}
          disabled={busy || tooShort || !duration}
        >
          <Check className="mr-2 h-4 w-4" />
          {busy ? "Saving…" : trimmed ? "Apply trim" : "Use clip"}
        </Button>
      </DialogFooter>
    </div>
  )
}
