"use client"

import { useEffect, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ProtectedMedia } from "@/components/media-protection"
import { Spinner } from "@/components/ui/skeletons"
import { caretAfterOps, type TextOp } from "@/lib/co-loop-text"
import {
  Activity,
  Crown,
  Hash,
  Image as ImageIcon,
  Paperclip,
  PenLine,
  Plus,
  Upload,
  X,
} from "lucide-react"
import {
  initialsOf,
  type StudioCursor,
  type StudioField,
  type StudioMediaType,
  type StudioParticipant,
} from "./studio-types"

export interface RemoteEdit {
  field: StudioField
  ops: TextOp[]
  /** Monotonic counter so repeated edits to the same field still re-run. */
  seq: number
}

interface CoLoopCanvasProps {
  title: string
  content: string
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onFieldFocus: (field: StudioField | null) => void
  /** This user's caret moved — broadcast so peers can draw it. */
  onCursorMove: (field: StudioField | null, offset: number) => void
  /** Live carets of everyone else in the room, drawn in the text. */
  cursors: StudioCursor[]
  /** Ops from the most recent remote edit, used to move the caret. */
  remoteEdit: RemoteEdit | null
  editingTitle: StudioParticipant[]
  editingContent: StudioParticipant[]
  hashtags: string[]
  onAddHashtag: (tag: string) => void
  onRemoveHashtag: (tag: string) => void
  mediaUrls: string[]
  mediaType: StudioMediaType
  uploadingMedia: boolean
  isPro: boolean
  onUploadFiles: (files: FileList | null) => void
  onRemoveMedia: (index: number) => void
  onAddMediaUrl: (url: string) => void
  disabled?: boolean
}

function EditorBadge({ participant, count }: { participant?: StudioParticipant; count: number }) {
  if (!participant || count === 0) return null
  return (
    <motion.span
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
    >
      <PenLine className="h-3 w-3 animate-pulse" />
      {count === 1 ? `@${participant.username} is editing` : `${count} people editing`}
    </motion.span>
  )
}

export function CoLoopCanvas({
  title,
  content,
  onTitleChange,
  onContentChange,
  onFieldFocus,
  onCursorMove,
  cursors,
  remoteEdit,
  editingTitle,
  editingContent,
  hashtags,
  onAddHashtag,
  onRemoveHashtag,
  mediaUrls,
  mediaType,
  uploadingMedia,
  isPro,
  onUploadFiles,
  onRemoveMedia,
  onAddMediaUrl,
  disabled,
}: CoLoopCanvasProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const mirrorRef = useRef<HTMLDivElement>(null)

  const [hashtagInput, setHashtagInput] = useState("")
  const [mediaUrlInput, setMediaUrlInput] = useState("")
  const [dragActive, setDragActive] = useState(false)
  /** Screen positions of collaborators' carets, keyed by participant id. */
  const [caretMarks, setCaretMarks] = useState<
    Record<string, { field: StudioField; top: number; left: number; height: number; visible: boolean }>
  >({})
  const [layoutTick, setLayoutTick] = useState(0)

  /* ── Remote caret geometry ──────────────────────────────────────
   * A textarea has no children to hang a caret off, so each remote caret is
   * measured with a hidden mirror element that carries the same box metrics
   * and font as the textarea: put the text up to the caret in the mirror, and
   * a zero-width marker's offsetTop/offsetLeft is exactly where the caret
   * belongs — including wrapped lines, which is what a naive character-width
   * estimate gets wrong.
   */
  useLayoutEffect(() => {
    const mirror = mirrorRef.current
    if (!mirror) return
    if (cursors.length === 0) {
      setCaretMarks((prev) => (Object.keys(prev).length === 0 ? prev : {}))
      return
    }

    const next: Record<string, { field: StudioField; top: number; left: number; height: number; visible: boolean }> = {}
    for (const cursor of cursors) {
      const el = cursor.field === "title" ? titleRef.current : contentRef.current
      if (!el) continue
      const value = cursor.field === "title" ? title : content
      const offset = Math.max(0, Math.min(cursor.offset, value.length))
      const cs = getComputedStyle(el)

      mirror.style.width = `${el.clientWidth}px`
      mirror.style.padding = `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`
      mirror.style.fontFamily = cs.fontFamily
      mirror.style.fontSize = cs.fontSize
      mirror.style.fontWeight = cs.fontWeight
      mirror.style.fontStyle = cs.fontStyle
      mirror.style.lineHeight = cs.lineHeight
      mirror.style.letterSpacing = cs.letterSpacing
      mirror.style.wordSpacing = cs.wordSpacing
      mirror.style.textAlign = cs.textAlign
      mirror.style.textTransform = cs.textTransform
      mirror.style.whiteSpace = "pre-wrap"
      mirror.style.overflowWrap = "break-word"

      mirror.textContent = value.slice(0, offset)
      const marker = document.createElement("span")
      marker.textContent = "\u200b"
      mirror.appendChild(marker)

      const top = marker.offsetTop - el.scrollTop
      next[cursor.id] = {
        field: cursor.field,
        top,
        left: marker.offsetLeft,
        height: marker.offsetHeight || parseFloat(cs.lineHeight) || 20,
        // Hide carets that have scrolled out of the textarea's viewport.
        visible: top >= -2 && top <= el.clientHeight - 4,
      }
    }
    setCaretMarks(next)
  }, [cursors, title, content, layoutTick])

  // Window resizes re-wrap the text; remeasure so carets stay on their line.
  useEffect(() => {
    const onResize = () => setLayoutTick((tick) => tick + 1)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const emitCursor = useCallback(
    (field: StudioField) => {
      const el = field === "title" ? titleRef.current : contentRef.current
      if (!el) return
      onCursorMove(field, el.selectionStart ?? 0)
    },
    [onCursorMove]
  )

  /** Draw one field's collaborator carets over its textarea. */
  const renderCarets = (field: StudioField) =>
    cursors.map((cursor) => {
      if (cursor.field !== field) return null
      const mark = caretMarks[cursor.id]
      if (!mark || mark.field !== field || !mark.visible) return null
      return (
        <span
          key={cursor.id}
          className="pointer-events-none absolute z-10"
          style={{ top: mark.top, left: mark.left, height: mark.height }}
          aria-hidden
        >
          <span
            className="absolute inset-y-0 -left-px w-0.5 rounded-full"
            style={{ background: cursor.color }}
          />
          <span
            className="absolute -top-4 left-1.5 max-w-[9rem] truncate rounded-full px-1.5 py-px text-[9px] font-semibold leading-tight text-white shadow-sm"
            style={{ background: cursor.color }}
          >
            {cursor.name}
          </span>
        </span>
      )
    })

  // Move the caret by exactly the length of the ops that landed before it, so a
  // collaborator typing elsewhere in the document never yanks the cursor away.
  useLayoutEffect(() => {
    const edit = remoteEdit
    if (!edit) return
    const el = edit.field === "title" ? titleRef.current : contentRef.current
    if (!el || document.activeElement !== el) return
    const start = el.selectionStart ?? el.value.length
    const caret = caretAfterOps(start, edit.ops, el.value.length)
    try {
      el.setSelectionRange(caret, caret)
    } catch {
      /* element not focusable anymore */
    }
  }, [remoteEdit])

  // Keep the title textarea sized to its content.
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const charCount = content.length
  const readingMinutes = Math.max(1, Math.round(wordCount / 220))

  const stats = useMemo(
    () => [
      { label: "words", value: wordCount.toLocaleString() },
      { label: "characters", value: charCount.toLocaleString() },
      { label: "min read", value: String(readingMinutes) },
    ],
    [wordCount, charCount, readingMinutes]
  )

  const submitHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "")
    if (!tag) return
    onAddHashtag(tag)
    setHashtagInput("")
  }

  const submitMediaUrl = () => {
    const url = mediaUrlInput.trim()
    if (!url) return
    onAddMediaUrl(url)
    setMediaUrlInput("")
  }

  return (
    <div className="relative">
      {/* Shared measurement mirror for caret geometry (invisible, never painted). */}
      <div ref={mirrorRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        {/* Document header: sync state + who is editing */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Shared draft — every keystroke syncs live
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <EditorBadge participant={editingTitle[0]} count={editingTitle.length} />
            <EditorBadge participant={editingContent[0]} count={editingContent.length} />
          </div>
        </div>

        <div className="space-y-1 px-4 py-5 sm:px-7 sm:py-7">
          {/* Title */}
          <div className="flex items-start gap-2">
            <span className="mt-2 hidden h-2 w-2 shrink-0 rounded-full bg-primary/60 sm:block" />
            <div className="relative min-w-0 flex-1">
              <textarea
                ref={titleRef}
                value={title}
                disabled={disabled}
                rows={1}
                onChange={(e) => onTitleChange(e.target.value)}
                onFocus={() => onFieldFocus("title")}
                onBlur={() => onFieldFocus(null)}
                onSelect={() => emitCursor("title")}
                onKeyUp={() => emitCursor("title")}
                placeholder="An untitled collaborative Loop"
                className="w-full flex-1 resize-none border-0 bg-transparent p-0 text-2xl font-semibold leading-snug tracking-tight text-foreground placeholder:text-muted-foreground/60 focus:outline-none sm:text-3xl"
              />
              {renderCarets("title")}
            </div>
          </div>

          <Separator className="my-3" />

          {/* Body */}
          <div className="relative">
            <textarea
              ref={contentRef}
              value={content}
              disabled={disabled}
              onChange={(e) => onContentChange(e.target.value)}
              onFocus={() => onFieldFocus("content")}
              onBlur={() => onFieldFocus(null)}
              onSelect={() => emitCursor("content")}
              onKeyUp={() => emitCursor("content")}
              onScroll={() => setLayoutTick((tick) => tick + 1)}
              placeholder="Write together. Everyone in the room sees each character as it lands — no save button, no overwriting each other."
              className="min-h-[320px] w-full resize-y border-0 bg-transparent p-0 text-[15px] leading-7 text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
            {renderCarets("content")}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-[11px] text-muted-foreground">
            {stats.map((stat) => (
              <span key={stat.label}>
                <span className="font-semibold text-foreground/80">{stat.value}</span> {stat.label}
              </span>
            ))}
          </div>
        </div>

        <Separator />

        {/* Attachments */}
        <div className="grid gap-5 px-4 py-5 sm:grid-cols-2 sm:px-7">
          {/* Hashtags */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hashtags</h3>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={hashtagInput}
                disabled={disabled}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    submitHashtag()
                  }
                }}
                placeholder="design, launch, colab…"
                className="h-9 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || !hashtagInput.trim()}
                onClick={submitHashtag}
                className="h-9 shrink-0 gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            <div className="flex min-h-[26px] flex-wrap gap-1.5">
              {hashtags.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/80">
                  Tags help your Loop get discovered. Everyone can add them live.
                </p>
              ) : (
                hashtags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 rounded-md px-2 py-1 text-[11px] font-medium">
                    #{tag}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onRemoveHashtag(tag)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Remove #${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </section>

          {/* Media */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Media</h3>
              </div>
              {isPro ? (
                <Badge variant="outline" className="gap-1 text-[10px] font-medium">
                  <Crown className="h-3 w-3" /> Pro · up to 4 files
                </Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground">Free · 1 file</span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple={isPro}
              accept="image/*,video/*"
              onChange={(e) => onUploadFiles(e.target.files)}
            />

            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault()
                dragDepthRef.current += 1
                setDragActive(true)
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => {
                e.preventDefault()
                dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
                if (dragDepthRef.current === 0) setDragActive(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                dragDepthRef.current = 0
                setDragActive(false)
                onUploadFiles(e.dataTransfer.files)
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-3 py-4 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/60"
              }`}
            >
              {uploadingMedia ? (
                <Spinner className="h-5 w-5 text-primary" />
              ) : dragActive ? (
                <Upload className="h-5 w-5 text-primary" />
              ) : (
                <Paperclip className="h-5 w-5 text-muted-foreground" />
              )}
              <p className="text-[11px] font-medium text-foreground">
                {uploadingMedia ? "Uploading…" : dragActive ? "Drop to attach" : "Click or drag an image or video"}
              </p>
              <p className="text-[10px] text-muted-foreground/80">JPEG, PNG, GIF, HEIC, MP4, WebM</p>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={mediaUrlInput}
                disabled={disabled}
                onChange={(e) => setMediaUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    submitMediaUrl()
                  }
                }}
                placeholder="…or paste a media URL"
                className="h-9 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || !mediaUrlInput.trim()}
                onClick={submitMediaUrl}
                className="h-9 shrink-0 text-xs"
              >
                Attach
              </Button>
            </div>

            {mediaUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {mediaUrls.map((url, index) => {
                  const isVideo = mediaType === "video" || /\.(mp4|webm|ogg|mov|m4v|avi)(\?|$)/i.test(url)
                  return (
                    <motion.div
                      key={`${url}-${index}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group relative h-20 overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      {isVideo ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={url} muted preload="metadata" playsInline className="h-full w-full object-cover" />
                      ) : (
                        <ProtectedMedia type="image" src={url} alt="Media attachment" className="h-full w-full object-cover" />
                      )}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onRemoveMedia(index)}
                        className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label="Remove attachment"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
