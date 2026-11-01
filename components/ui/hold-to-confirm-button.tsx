"use client"

import * as React from "react"
import { useReducedMotion } from "motion/react"

import { buttonVariants } from "@/components/ui/button"
import { hapticPress, hapticSuccess } from "@/lib/haptics"
import { cn } from "@/lib/utils"

export interface HoldToConfirmButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd"> {
  onConfirm: () => void | Promise<void>
  label?: string
  holdingLabel?: string
  holdDurationMs?: number
}

/**
 * A deliberate confirmation control for irreversible actions.
 *
 * Pointer release, pointer cancellation, focus loss or keyboard release
 * before the threshold cancels the action. Space and Enter are supported.
 */
export const HoldToConfirmButton = React.forwardRef<HTMLButtonElement, HoldToConfirmButtonProps>(
  function HoldToConfirmButton(
    {
      onConfirm,
      label = "Hold to confirm",
      holdingLabel = "Keep holding…",
      holdDurationMs = 900,
      disabled = false,
      className,
      onClick,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
      onKeyUp,
      onBlur,
      ...props
    },
    forwardedRef,
  ) {
    const buttonRef = React.useRef<HTMLButtonElement>(null)
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const holdingRef = React.useRef(false)
    const [holding, setHolding] = React.useState(false)
    const reducedMotion = useReducedMotion()

    React.useImperativeHandle(forwardedRef, () => buttonRef.current as HTMLButtonElement)

    const clearHold = React.useCallback(() => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      holdingRef.current = false
      setHolding(false)
    }, [])

    const startHold = React.useCallback(() => {
      if (disabled || holdingRef.current) return
      holdingRef.current = true
      setHolding(true)
      hapticPress()

      timerRef.current = setTimeout(() => {
        timerRef.current = null
        holdingRef.current = false
        setHolding(false)
        hapticSuccess()
        void onConfirm()
      }, holdDurationMs)
    }, [disabled, holdDurationMs, onConfirm])

    React.useEffect(() => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }, [])

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return
      onPointerDown?.(event)
      if (event.defaultPrevented) return
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Pointer capture is not available in every embedded browser.
      }
      startHold()
    }

    const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerUp?.(event)
      clearHold()
    }

    const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerCancel?.(event)
      clearHold()
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event)
      if (event.defaultPrevented || event.repeat) return
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault()
        startHold()
      }
    }

    const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyUp?.(event)
      if (event.key === " " || event.key === "Enter") clearHold()
    }

    const handleBlur = (event: React.FocusEvent<HTMLButtonElement>) => {
      onBlur?.(event)
      clearHold()
    }

    return (
      <button
        {...props}
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-describedby={props["aria-describedby"]}
        aria-label={props["aria-label"] || label}
        data-holding={holding ? "true" : "false"}
        className={cn(
          buttonVariants({ variant: "destructive", size: "default" }),
          "loop-tactile relative isolate min-w-32 select-none overflow-hidden",
          "touch-none focus-visible:ring-2 focus-visible:ring-rose-500",
          className,
        )}
        onClick={(event) => {
          event.preventDefault()
          onClick?.(event)
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={clearHold}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={handleBlur}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 origin-left bg-rose-950/30"
          style={{
            transform: holding ? "scaleX(1)" : "scaleX(0)",
            transition: reducedMotion ? "none" : `transform ${holdDurationMs}ms linear`,
          }}
        />
        <span className="relative z-10">
          {holding ? holdingLabel : label}
        </span>
        <span className="sr-only" aria-live="polite">
          {holding ? "Hold to confirm. Releasing cancels." : "Press and hold to confirm."}
        </span>
      </button>
    )
  },
)

HoldToConfirmButton.displayName = "HoldToConfirmButton"
