"use client"

import { useEffect, useCallback, useRef } from "react"

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  handler: (e: KeyboardEvent) => void
}

/**
 * Hook for registering global keyboard shortcuts.
 * Shortcuts are disabled when focus is inside an input/textarea/contenteditable.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  const isInputFocused = useCallback(() => {
    const el = document.activeElement
    if (!el) return false
    const tag = el.tagName.toLowerCase()
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      (el as HTMLElement).isContentEditable
    )
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (isInputFocused()) return

      for (const shortcut of shortcutsRef.current) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault()
          e.stopPropagation()
          shortcut.handler(e)
          return
        }
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isInputFocused])
}

/**
 * Pre-built shortcut configs for the feed.
 */
export function useFeedShortcuts(handlers: {
  like?: () => void
  save?: () => void
  comment?: () => void
  share?: () => void
  nextPost?: () => void
  prevPost?: () => void
  newPost?: () => void
  scrollToTop?: () => void
}) {
  useKeyboardShortcuts([
    ...(handlers.like ? [{ key: "l", description: "Like post", handler: handlers.like }] : []),
    ...(handlers.save ? [{ key: "s", description: "Save post", handler: handlers.save }] : []),
    ...(handlers.comment ? [{ key: "c", description: "Comment", handler: handlers.comment }] : []),
    ...(handlers.share ? [{ key: "s", shift: true, description: "Share", handler: handlers.share }] : []),
    ...(handlers.nextPost ? [{ key: "j", description: "Next post", handler: handlers.nextPost }] : []),
    ...(handlers.prevPost ? [{ key: "k", description: "Previous post", handler: handlers.prevPost }] : []),
    ...(handlers.newPost ? [{ key: "n", description: "New post", handler: handlers.newPost }] : []),
    ...(handlers.scrollToTop ? [{ key: "g", description: "Scroll to top", handler: handlers.scrollToTop }] : []),
  ] as ShortcutConfig[])
}
