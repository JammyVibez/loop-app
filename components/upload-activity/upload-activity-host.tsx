"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ActionFeedback, type ActionPhase } from "@/components/ui/action-feedback"
import {
  getUploadActivityServerSnapshot,
  getUploadActivitySnapshot,
  subscribeUploadActivity,
} from "@/lib/upload-activity"

/**
 * One global upload indicator.
 *
 * Any `uploadMediaFile` call — composer, avatar, DM attachment, admin panel —
 * reports here, so a media upload never looks frozen and the app never needs
 * per-screen progress plumbing. It stays out of the way for quick uploads: the
 * card only appears after 500ms in flight, then shows real progress for chunked
 * uploads and success/failure for a moment before leaving.
 */
export function UploadActivityHost() {
  const snapshot = useSyncExternalStore(
    subscribeUploadActivity,
    getUploadActivitySnapshot,
    getUploadActivityServerSnapshot,
  )
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const shownOnce = useRef(false)

  const busy = snapshot.count > 0
  const settling = snapshot.done || Boolean(snapshot.failed)

  useEffect(() => {
    if (busy) {
      const timer = window.setTimeout(() => {
        shownOnce.current = true
        setVisible(true)
      }, 500)
      return () => window.clearTimeout(timer)
    }

    if (!settling) {
      // A fast upload that finished before the 500ms mark never shows anything.
      shownOnce.current = false
      setVisible(false)
      return
    }

    if (!shownOnce.current) {
      setVisible(false)
      return
    }

    const timer = window.setTimeout(
      () => {
        shownOnce.current = false
        setVisible(false)
      },
      snapshot.failed ? 2600 : 1000,
    )
    return () => window.clearTimeout(timer)
  }, [busy, settling, snapshot.failed])

  const phase: ActionPhase = snapshot.failed
    ? "error"
    : busy
      ? "working"
      : settling
        ? "success"
        : "idle"

  const label =
    snapshot.count > 1
      ? `${snapshot.count} uploads in progress`
      : snapshot.label || "Uploading"

  return (
    <AnimatePresence>
      {visible && phase !== "idle" ? (
        <motion.div
          key="upload-activity"
          className="pointer-events-none fixed bottom-[calc(var(--bottom-nav-height)+0.75rem)] left-1/2 z-[60] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 sm:bottom-6 sm:left-6 sm:translate-x-0"
          initial={{ opacity: 0, y: reduced ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : 8 }}
          transition={{ duration: reduced ? 0.1 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="pointer-events-auto">
            <ActionFeedback
              phase={phase}
              label={label}
              percent={phase === "working" ? snapshot.percent : null}
              error={snapshot.failed || undefined}
              successLabel="Upload complete"
              delayMs={200}
              layout="panel"
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
