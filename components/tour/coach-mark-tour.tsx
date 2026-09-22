"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowRight, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CoachMarkStep } from "@/lib/feature-tour"

type Placement = "top" | "bottom" | "left" | "right"

interface Hole {
  top: number
  left: number
  width: number
  height: number
}

interface Layout {
  hole: Hole
  placement: Placement
  cardTop: number
  cardLeft: number
  arrow: { top: number; left: number }
}

const CARD_WIDTH = 300
const CARD_ESTIMATED_HEIGHT = 190
const GAP = 14
const VIEWPORT_PAD = 12

export function findTourTarget(step: CoachMarkStep): HTMLElement | null {
  const candidates = [step.target, ...(step.fallbackTargets || [])]
  for (const selector of candidates) {
    try {
      const el = document.querySelector(selector)
      if (el instanceof HTMLElement) return el
    } catch {
      /* invalid selector — try the next one */
    }
  }
  return null
}

interface CoachMarkTourProps {
  steps: CoachMarkStep[]
  open: boolean
  /** Auto-advance delay for each tip. */
  autoAdvanceMs?: number
  onFinish: () => void
  onSkip: () => void
}

/**
 * Reusable coach-mark / spotlight tour.
 *
 * Each step points at a real element in the DOM (via a CSS selector) and the
 * engine dims everything else with a spotlight cutout, draws an outline around
 * the element and parks a small tip card beside it with a connected pointer.
 * Steps whose target isn't on screen are skipped, so the same component can
 * drive tours for other surfaces (see `lib/feature-tour.ts`).
 */
export function CoachMarkTour({
  steps,
  open,
  autoAdvanceMs = 10_000,
  onFinish,
  onSkip,
}: CoachMarkTourProps) {
  const [mounted, setMounted] = useState(false)
  const [index, setIndex] = useState(0)
  const [hole, setHole] = useState<Hole | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [visibleSteps, setVisibleSteps] = useState<CoachMarkStep[]>([])
  const [runId, setRunId] = useState(0)
  const finishedRef = useRef(false)

  useEffect(() => setMounted(true), [])

  // Resolve which steps actually have a live target each time the tour opens.
  useEffect(() => {
    if (!open) return
    finishedRef.current = false
    setIndex(0)
    setRunId((n) => n + 1)
    const resolved = steps.filter((step) => findTourTarget(step))
    setVisibleSteps(resolved)
    if (resolved.length === 0) {
      finishedRef.current = true
      onFinish()
    }
  }, [open, steps, onFinish])

  const step = open ? visibleSteps[index] || null : null

  const measure = useCallback(() => {
    if (!step || typeof window === "undefined") {
      setHole(null)
      return
    }
    const el = findTourTarget(step)
    if (!el) {
      setHole(null)
      return
    }
    const rect = el.getBoundingClientRect()
    const pad = step.padding ?? 8
    setHole({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    })
    setViewport({ width: window.innerWidth, height: window.innerHeight })
  }, [step])

  // Bring the target into view, then keep the spotlight glued to it (the feed
  // scrolls, cards animate and sticky headers move while the tour is open).
  useLayoutEffect(() => {
    if (!open || !step) return
    const el = findTourTarget(step)
    el?.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "center" })
    measure()
    const first = setTimeout(measure, 320)
    const second = setTimeout(measure, 720)
    return () => {
      clearTimeout(first)
      clearTimeout(second)
    }
  }, [open, step, measure])

  useEffect(() => {
    if (!open) return
    const onChange = () => measure()
    window.addEventListener("resize", onChange)
    window.addEventListener("scroll", onChange, true)
    const interval = setInterval(measure, 400)
    return () => {
      window.removeEventListener("resize", onChange)
      window.removeEventListener("scroll", onChange, true)
      clearInterval(interval)
    }
  }, [open, measure])

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinish()
  }, [onFinish])

  const skip = useCallback(() => {
    finishedRef.current = true
    onSkip()
  }, [onSkip])

  const next = useCallback(() => {
    if (finishedRef.current) return
    setIndex((current) => {
      if (current + 1 >= visibleSteps.length) {
        finishedRef.current = true
        onFinish()
        return current
      }
      return current + 1
    })
  }, [visibleSteps.length, onFinish])

  useEffect(() => {
    if (!open || !step) return
    const timer = setTimeout(next, autoAdvanceMs)
    return () => clearTimeout(timer)
  }, [open, step, next, autoAdvanceMs, index])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        skip()
      } else if (event.key === "Enter" || event.key === "ArrowRight") {
        event.preventDefault()
        next()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, skip, next])

  const layout = useMemo<Layout | null>(() => {
    if (!hole || !step || !viewport.width || !viewport.height) return null
    const { width: vw, height: vh } = viewport

    let placement: Placement = step.placement || "bottom"
    const room = (side: Placement) => {
      if (side === "bottom") return hole.top + hole.height + GAP + CARD_ESTIMATED_HEIGHT <= vh
      if (side === "top") return hole.top - GAP - CARD_ESTIMATED_HEIGHT >= 0
      if (side === "left") return hole.left - GAP - CARD_WIDTH >= 0
      return hole.left + hole.width + GAP + CARD_WIDTH <= vw
    }
    if (!room(placement)) {
      const order: Placement[] =
        placement === "bottom"
          ? ["top", "right", "left"]
          : placement === "top"
            ? ["bottom", "right", "left"]
            : placement === "left"
              ? ["right", "bottom", "top"]
              : ["left", "bottom", "top"]
      placement = order.find(room) || placement
    }

    let cardTop = hole.top + hole.height + GAP
    let cardLeft = hole.left + hole.width / 2 - CARD_WIDTH / 2
    if (placement === "top") {
      cardTop = hole.top - GAP - CARD_ESTIMATED_HEIGHT
    } else if (placement === "left") {
      cardTop = hole.top + hole.height / 2 - CARD_ESTIMATED_HEIGHT / 2
      cardLeft = hole.left - GAP - CARD_WIDTH
    } else if (placement === "right") {
      cardTop = hole.top + hole.height / 2 - CARD_ESTIMATED_HEIGHT / 2
      cardLeft = hole.left + hole.width + GAP
    }

    cardLeft = Math.min(Math.max(VIEWPORT_PAD, cardLeft), Math.max(VIEWPORT_PAD, vw - CARD_WIDTH - VIEWPORT_PAD))
    cardTop = Math.min(
      Math.max(VIEWPORT_PAD, cardTop),
      Math.max(VIEWPORT_PAD, vh - CARD_ESTIMATED_HEIGHT - VIEWPORT_PAD),
    )

    // Pointer sits on the card edge that faces the highlighted element.
    const anchorX = hole.left + hole.width / 2
    const anchorY = hole.top + hole.height / 2
    let arrow = { top: 0, left: 0 }
    if (placement === "bottom") {
      arrow = { top: -5, left: Math.min(Math.max(14, anchorX - cardLeft - 5), CARD_WIDTH - 24) }
    } else if (placement === "top") {
      arrow = { top: CARD_ESTIMATED_HEIGHT - 5, left: Math.min(Math.max(14, anchorX - cardLeft - 5), CARD_WIDTH - 24) }
    } else if (placement === "left") {
      arrow = { top: Math.min(Math.max(14, anchorY - cardTop - 5), CARD_ESTIMATED_HEIGHT - 24), left: CARD_WIDTH - 5 }
    } else {
      arrow = { top: Math.min(Math.max(14, anchorY - cardTop - 5), CARD_ESTIMATED_HEIGHT - 24), left: -5 }
    }

    return { hole, placement, cardTop, cardLeft, arrow }
  }, [hole, step, viewport])

  if (!mounted || !open || !step || !layout) return null

  const isLast = index + 1 >= visibleSteps.length
  const arrowClasses =
    layout.placement === "bottom"
      ? "border-l border-t"
      : layout.placement === "top"
        ? "border-b border-r"
        : layout.placement === "left"
          ? "border-r border-t"
          : "border-b border-l"

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Feature tour">
      {/* The enormous box-shadow IS the dimmer: everything outside the cutout
          is shaded, so the highlighted element stays fully lit. */}
      <div
        className="pointer-events-none absolute rounded-2xl transition-all duration-200 ease-out"
        style={{
          top: layout.hole.top,
          left: layout.hole.left,
          width: layout.hole.width,
          height: layout.hole.height,
          boxShadow:
            "0 0 0 9999px rgba(2, 6, 23, 0.62), 0 0 0 1.5px hsl(var(--primary) / 0.7), 0 0 22px 3px hsl(var(--primary) / 0.28)",
        }}
        aria-hidden="true"
      />

      <div
        className="absolute z-[101]"
        style={{ top: layout.cardTop, left: layout.cardLeft, width: CARD_WIDTH }}
      >
        <div className="relative overflow-visible rounded-2xl border border-border bg-card p-4 shadow-xl shadow-foreground/10">
          <span
            className={cn("absolute h-2.5 w-2.5 rotate-45 bg-card", arrowClasses)}
            style={{ top: layout.arrow.top, left: layout.arrow.left }}
            aria-hidden="true"
          />

          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Quick tour · {index + 1}/{visibleSteps.length}
            </p>
            <button
              type="button"
              onClick={skip}
              className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Skip the tour"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-2 text-sm font-semibold tracking-tight text-foreground">{step.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>

          <div className="mt-3.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1" aria-hidden="true">
              {visibleSteps.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-4 bg-primary" : "w-1.5 bg-border",
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={skip}
                className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                Skip
              </Button>
              <Button size="sm" onClick={next} className="h-7 rounded-full px-3 text-[11px] font-semibold">
                {isLast ? (
                  <>
                    <Check className="mr-1 h-3 w-3" />
                    Done
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Auto-advance indicator */}
          <span
            key={`${runId}-${index}`}
            className="loop-tour-progress absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary/60"
            style={{ animationDuration: `${autoAdvanceMs}ms` }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
