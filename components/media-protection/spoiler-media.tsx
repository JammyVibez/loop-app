"use client"

import { useState, type ReactNode } from "react"
import { EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface SpoilerMediaProps {
  /** Whether this media was marked as a spoiler by its author */
  active: boolean
  /** The media element(s) — shown blurred while hidden, fully after reveal */
  children: ReactNode
  /**
   * Optional placeholder rendered INSTEAD of children while hidden.
   * Use for videos so nothing is downloaded or autoplayed until reveal.
   */
  hiddenFallback?: ReactNode
  className?: string
}

/**
 * Spoiler cover for image/video posts.
 *
 * While hidden the media renders behind a heavy blur with a
 * "Spoiler — tap to reveal" overlay. Tapping reveals it for the current
 * viewing session only — the reveal lives in component state, so the media
 * re-blurs on the next feed load / page refresh (nothing is persisted).
 */
export function SpoilerMedia({ active, children, hiddenFallback, className }: SpoilerMediaProps) {
  const [revealed, setRevealed] = useState(false)

  if (!active) return <>{children}</>

  const hidden = !revealed

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {hidden && hiddenFallback ? (
        <div aria-hidden>{hiddenFallback}</div>
      ) : (
        <div
          aria-hidden={hidden}
          className={cn(
            "transition-[filter,transform] duration-300",
            hidden && "pointer-events-none scale-[1.04] blur-2xl select-none"
          )}
        >
          {children}
        </div>
      )}

      {hidden && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setRevealed(true)
          }}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/40 backdrop-blur-[2px] transition-colors hover:bg-black/30 focus:outline-none"
          aria-label="Spoiler — tap to reveal"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/55 backdrop-blur-md">
            <EyeOff className="h-5 w-5 text-white/90" />
          </span>
          <span className="rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/95 backdrop-blur-md sm:text-xs">
            Spoiler — tap to reveal
          </span>
        </button>
      )}
    </div>
  )
}
