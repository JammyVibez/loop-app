import { useId } from "react"

/**
 * Loop AI's mark: a single unbroken stroke that loops back into itself, with a
 * bright node where it crosses. Deliberately not a sparkle — it reads as
 * "loop", matches the product name, and holds up at 16px in a tab bar.
 */
export function LoopAiMark({
  className,
  glow = false,
}: {
  className?: string
  /** Adds the soft halo used on hero surfaces. */
  glow?: boolean
}) {
  const id = useId().replace(/:/g, "")
  const stroke = `loop-ai-stroke-${id}`
  const halo = `loop-ai-halo-${id}`

  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={stroke} x1="4" y1="6" x2="28" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={halo} cx="0" cy="0" r="1" gradientTransform="translate(16 16) rotate(90) scale(15)">
          <stop stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      {glow && <circle cx="16" cy="16" r="15" fill={`url(#${halo})`} />}

      {/* The loop: enters top-right, sweeps left, crosses itself, exits bottom-right. */}
      <path
        d="M25.5 9.2c-2-2.4-5.7-2.2-8.4.6l-6 6.2c-2.7 2.8-2.9 6.5-.5 8.5 2.4 2 6 1.2 8.3-1.6l3.4-4.1"
        stroke={`url(#${stroke})`}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M6.5 22.8c2 2.4 5.7 2.2 8.4-.6l6-6.2c2.7-2.8 2.9-6.5.5-8.5-2.4-2-6-1.2-8.3 1.6l-3.4 4.1"
        stroke={`url(#${stroke})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" />
    </svg>
  )
}
