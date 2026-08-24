"use client"

import { useRef, useCallback, useEffect, type ReactNode } from "react"
import { useAuth } from "@/hooks/use-auth"
import { WatermarkOverlay } from "./watermark-overlay"

type MediaProtectionProps = {
  children: ReactNode
  /** Enable watermark overlay on images (admin-configurable) */
  enableWatermark?: boolean
  /** Watermark text — defaults to @username or "Loop" */
  watermarkText?: string
  /** Watermark opacity 0–1 */
  watermarkOpacity?: number
  /** Apply protection to the entire wrapper, not just media */
  fullArea?: boolean
  /** Extra className */
  className?: string
}

/**
 * Wraps media content to add download-deterrent layers:
 * 1. Disables right-click "Save Image As" / "Save Link As"
 * 2. Blocks drag-and-drop of media elements
 * 3. Prevents Ctrl+S / Cmd+S on the wrapped area
 * 4. Adds user-select: none on media
 * 5. Optionally renders a subtle watermark overlay on images
 *
 * NOTE: This is a deterrent layer, not a guarantee.
 * Determined users can bypass via dev tools, screen recording, or a second device.
 */
export function MediaProtection({
  children,
  enableWatermark = false,
  watermarkText,
  watermarkOpacity = 0.08,
  fullArea = true,
  className = "",
}: MediaProtectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()

  const effectiveWatermarkText =
    watermarkText || (user?.username ? `@${user.username}` : "Loop")

  // Disable right-click context menu
  const handleContextMenu = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    // Only block on media elements, images, and video
    const isMedia =
      target.tagName === "IMG" ||
      target.tagName === "VIDEO" ||
      target.tagName === "CANVAS" ||
      target.closest("img, video, canvas, [data-protected-media]")
    if (isMedia || fullArea) {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
    return true
  }, [fullArea])

  // Block drag events on media
  const handleDragStart = useCallback((e: DragEvent) => {
    const target = e.target as HTMLElement
    const isMedia =
      target.tagName === "IMG" ||
      target.tagName === "VIDEO" ||
      target.tagName === "CANVAS" ||
      target.closest("img, video, canvas, [data-protected-media]")
    if (isMedia || fullArea) {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
    return true
  }, [fullArea])

  // Block keyboard save shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl+S / Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
    // Ctrl+Shift+S / Cmd+Shift+S (Save As)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
    // F12 — block dev tools (optional, lightweight deterrent)
    // Note: we do NOT block this as it's too aggressive
    return true
  }, [])

  // Prevent touch-and-hold save on mobile
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const target = e.target as HTMLElement
    const isMedia =
      target.tagName === "IMG" ||
      target.tagName === "VIDEO" ||
      target.closest("img, video, [data-protected-media]")
    if (isMedia) {
      // Add a slight delay check for long-press
      const timer = setTimeout(() => {
        // Prevent default context menu on mobile
      }, 500)
      const clear = () => {
        clearTimeout(timer)
        document.removeEventListener("touchend", clear)
        document.removeEventListener("touchmove", clear)
      }
      document.addEventListener("touchend", clear)
      document.addEventListener("touchmove", clear)
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener("contextmenu", handleContextMenu, true)
    el.addEventListener("dragstart", handleDragStart, true)
    el.addEventListener("keydown", handleKeyDown, true)
    el.addEventListener("touchstart", handleTouchStart, { passive: true })

    return () => {
      el.removeEventListener("contextmenu", handleContextMenu, true)
      el.removeEventListener("dragstart", handleDragStart, true)
      el.removeEventListener("keydown", handleKeyDown, true)
      el.removeEventListener("touchstart", handleTouchStart)
    }
  }, [handleContextMenu, handleDragStart, handleKeyDown, handleTouchStart])

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        // CSS-level deterrents
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {children}
      {enableWatermark && (
        <WatermarkOverlay
          opacity={watermarkOpacity}
          position="bottom-right"
          animated={true}
        />
      )}
    </div>
  )
}
