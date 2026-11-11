"use client"

import { useEffect, useId, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { RefreshCw } from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"

/**
 * Shared feedback for actions that leave the screen (publishing, sending,
 * uploading, saving).
 *
 * Timing rule: the compact row appears on the same frame as the submit, so the
 * action never feels ignored; the richer card only blooms after `delayMs`
 * (default 450ms) so short round-trips stay quiet. A "still working" line
 * follows at ~1.6s instead of a frozen button. Success draws a check and
 * collapses; failure keeps the message and offers a retry.
 *
 * Motion is skipped under `prefers-reduced-motion` and the in-app
 * `loop-reduced-motion` class — those users get the same information as a
 * static, fully legible card.
 */

export type ActionPhase = "idle" | "working" | "success" | "error"

export type ActionFeedbackProps = {
  phase: ActionPhase
  label: string
  /** Progress line, e.g. "Uploading 2/3…". Also replaces the “still working” copy. */
  detail?: string
  /** Error message shown in the error state. */
  error?: string
  /** 0–100 for determinate work; omit or null for indeterminate. */
  percent?: number | null
  onRetry?: () => void
  successLabel?: string
  layout?: "inline" | "panel" | "overlay"
  delayMs?: number
  className?: string
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function useInAppReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const read = () => setReduced(document.documentElement.classList.contains("loop-reduced-motion"))
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return reduced
}

function ProgressMark({
  phase,
  percent,
  reduced,
  size = 52,
}: {
  phase: Exclude<ActionPhase, "idle">
  percent: number | null
  reduced: boolean
  size?: number
}) {
  const gradientId = useId().replace(/[:]/g, "")
  const radius = 19
  const circumference = 2 * Math.PI * radius
  const determinate = percent != null
  const value = determinate ? clampPercent(percent) : null
  const dash = determinate ? circumference * (1 - value! / 100) : circumference * 0.7

  const stroke =
    phase === "success"
      ? "hsl(var(--success))"
      : phase === "error"
        ? "hsl(var(--destructive))"
        : `url(#${gradientId})`

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <motion.span
        aria-hidden
        className={cn(
          "absolute inset-1 rounded-full blur-md",
          phase === "success"
            ? "bg-success/30"
            : phase === "error"
              ? "bg-destructive/25"
              : "bg-primary/25",
        )}
        animate={reduced || phase !== "working" ? undefined : { opacity: [0.35, 0.75, 0.35], scale: [0.94, 1.04, 0.94] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />

      <svg viewBox="0 0 48 48" className="relative h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="55%" stopColor="hsl(var(--accent-foreground) / 0.65)" />
            <stop offset="100%" stopColor="hsl(var(--ring))" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
        <motion.circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: dash }}
          transition={{ duration: reduced ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
        {!determinate && phase === "working" && !reduced ? (
          <motion.circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.16} ${circumference}`}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "24px 24px" }}
          />
        ) : null}
      </svg>

      <span className="absolute inset-0 flex items-center justify-center">
        {phase === "success" ? (
          <motion.svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
            <motion.path
              d="M5 12.5 10 17.5 19 7"
              stroke="hsl(var(--success))"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduced ? 0 : 0.34, ease: "easeOut" }}
            />
          </motion.svg>
        ) : phase === "error" ? (
          <span className="text-[15px] font-bold leading-none text-destructive">!</span>
        ) : (
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-primary"
            animate={reduced ? undefined : { scale: [0.8, 1.25, 0.8], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </span>
    </span>
  )
}

function Particles({ reduced }: { reduced: boolean }) {
  if (reduced) return null
  const dots = [
    { left: "18%", top: "22%", delay: 0, size: 3 },
    { left: "78%", top: "30%", delay: 0.5, size: 2 },
    { left: "64%", top: "76%", delay: 1.1, size: 2.5 },
    { left: "30%", top: "70%", delay: 0.8, size: 2 },
  ]
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((dot, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full bg-primary/50"
          style={{ left: dot.left, top: dot.top, width: dot.size, height: dot.size }}
          animate={{ y: [-3, 4, -3], opacity: [0, 0.8, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, delay: dot.delay, ease: "easeInOut" }}
        />
      ))}
    </span>
  )
}

export function ActionFeedback({
  phase,
  label,
  detail,
  error,
  percent = null,
  onRetry,
  successLabel = "Done",
  layout = "inline",
  delayMs = 450,
  className,
}: ActionFeedbackProps) {
  const prefersReduced = useReducedMotion()
  const appReduced = useInAppReducedMotion()
  const reduced = Boolean(prefersReduced || appReduced)

  const startedAt = useRef(0)
  const [deep, setDeep] = useState(false)
  const [patient, setPatient] = useState(false)

  useEffect(() => {
    if (phase !== "working") {
      setDeep(false)
      setPatient(false)
      return
    }
    startedAt.current = Date.now()
    setDeep(false)
    setPatient(false)
    const deepTimer = window.setTimeout(() => setDeep(true), delayMs)
    const patientTimer = window.setTimeout(() => setPatient(true), 1600)
    return () => {
      window.clearTimeout(deepTimer)
      window.clearTimeout(patientTimer)
    }
  }, [phase, delayMs])

  const expanded = phase !== "working" || deep

  const headline =
    phase === "success"
      ? successLabel
      : phase === "error"
        ? label
        : label

  const secondary =
    phase === "error"
      ? error || "Something went wrong. Nothing was lost — try again."
      : detail || (patient ? "Still working — this one is taking a little longer." : undefined)

  const card = (
    <motion.div
      layout={!reduced}
      initial={{ opacity: 0, y: reduced ? 0 : 6, scale: reduced ? 1 : 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduced ? 0 : -4, scale: reduced ? 1 : 0.98 }}
      transition={{ duration: reduced ? 0.12 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-card/90 px-3.5 py-3 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.65)] backdrop-blur-xl",
        phase === "error" ? "border-destructive/35" : "border-border/70",
        expanded ? "w-full max-w-sm" : "w-auto",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          phase === "error"
            ? "via-destructive/50"
            : "via-primary/60",
        )}
      />
      {expanded ? <Particles reduced={reduced} /> : null}

      <ProgressMark
        phase={phase === "idle" ? "working" : phase}
        percent={phase === "success" ? 100 : percent}
        reduced={reduced}
        size={expanded ? 48 : 24}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium tracking-[-0.01em] text-foreground",
            expanded ? "text-[13px]" : "text-[12px]",
          )}
        >
          {headline}
          {phase === "working" && expanded && !reduced ? (
            <motion.span
              aria-hidden
              className="ml-1 inline-block"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              …
            </motion.span>
          ) : null}
        </p>
        {expanded && secondary ? (
          <p
            className={cn(
              "mt-0.5 line-clamp-2 text-[11px] leading-snug",
              phase === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {secondary}
          </p>
        ) : null}
        {expanded && phase === "working" && percent != null ? (
          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${clampPercent(percent)}%` }}
              transition={{ duration: reduced ? 0 : 0.3, ease: "easeOut" }}
            />
          </div>
        ) : null}
      </div>

      {phase === "error" && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      ) : null}

      {phase === "working" && expanded && !reduced ? (
        <span
          aria-hidden
          className="loop-action-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent"
        />
      ) : null}
    </motion.div>
  )

  // An error must never trap the user behind the overlay: it drops to a
  // bottom-anchored card so the form underneath stays editable.
  const containerClass =
    layout === "overlay"
      ? phase === "error"
        ? "absolute inset-x-0 bottom-0 z-30 flex justify-center p-3"
        : "absolute inset-0 z-30 flex items-center justify-center bg-background/60 p-4 backdrop-blur-[3px]"
      : "w-full"

  return (
    <AnimatePresence initial={false}>
      {phase !== "idle" ? (
        <motion.div
          key="action-feedback"
          role={phase === "error" ? "alert" : "status"}
          aria-live={phase === "error" ? "assertive" : "polite"}
          aria-atomic="true"
          className={cn(containerClass, className)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.1 : 0.18 }}
        >
          {card}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
