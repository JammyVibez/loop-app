"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface VoiceRecorderWavesProps {
  /** Whether recording is currently active */
  recording: boolean
  /** Whether recording is paused */
  paused?: boolean
  /** Number of bars to render (WhatsApp uses ~30-40) */
  barCount?: number
  /** Base color of the bars */
  color?: string
  /** Height of the tallest bar in px */
  maxBarHeight?: number
  /** Height of the shortest bar in px */
  minBarHeight?: number
  /** Additional class names */
  className?: string
}

/**
 * VoiceRecorderWaves — Animated audio-reactive waveform visualization.
 *
 * When recording is active, bars animate in a smooth wave pattern
 * that simulates live audio input. When paused, bars freeze at
 * their current height. When idle, bars shrink to minimum.
 *
 * Uses a deterministic pseudo-random wave generator that creates
 * natural-looking voice patterns without requiring actual audio
 * analysis (which would need Web Audio API and add complexity).
 * The animation speed varies to simulate speech rhythm.
 */
export function VoiceRecorderWaves({
  recording,
  paused = false,
  barCount = 32,
  color,
  maxBarHeight = 28,
  minBarHeight = 3,
  className,
}: VoiceRecorderWavesProps) {
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => minBarHeight)
  )
  const frameRef = useRef<number>(0)
  const timeRef = useRef(0)
  const targetsRef = useRef<number[]>(Array.from({ length: barCount }, () => minBarHeight))
  const currentRef = useRef<number[]>(Array.from({ length: barCount }, () => minBarHeight))

  useEffect(() => {
    if (!recording || paused) {
      // Animate bars to minimum when idle or paused
      targetsRef.current = targetsRef.current.map(() => minBarHeight)
    }

    const animate = () => {
      timeRef.current += paused ? 0.02 : 0.08

      if (recording && !paused) {
        // Generate new targets periodically to simulate voice variation
        const t = timeRef.current
        for (let i = 0; i < barCount; i++) {
          // Multiple overlapping sine waves create natural-looking voice patterns
          const wave1 = Math.sin(t * 3.5 + i * 0.35) * 0.4
          const wave2 = Math.sin(t * 5.2 + i * 0.2) * 0.25
          const wave3 = Math.sin(t * 1.8 + i * 0.55) * 0.2
          const wave4 = Math.sin(t * 7.1 + i * 0.15) * 0.15

          // Combine waves and add speech-like bursts
          const combined = Math.abs(wave1 + wave2 + wave3 + wave4)

          // Simulate speech rhythm: occasional quiet gaps
          const speechBurst = Math.abs(Math.sin(t * 0.6)) > 0.3 ? 1 : 0.3

          // Add slight randomness per bar using deterministic noise
          const noise = Math.sin(i * 127.1 + t * 11.3) * 0.1

          const target = minBarHeight + (maxBarHeight - minBarHeight) *
            Math.max(0, Math.min(1, combined * speechBurst + noise * 0.3))

          targetsRef.current[i] = target
        }
      }

      // Smooth interpolation towards targets
      const lerp = paused ? 0.05 : 0.15
      let changed = false
      for (let i = 0; i < barCount; i++) {
        const diff = targetsRef.current[i] - currentRef.current[i]
        if (Math.abs(diff) > 0.1) {
          currentRef.current[i] += diff * lerp
          changed = true
        } else {
          currentRef.current[i] = targetsRef.current[i]
        }
      }

      if (changed || recording) {
        setBars([...currentRef.current])
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [recording, paused, barCount, maxBarHeight, minBarHeight])

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-[2px]",
        className,
      )}
      aria-hidden="true"
    >
      {bars.map((height, i) => (
        <div
          key={i}
          className="rounded-full transition-none"
          style={{
            width: 3,
            height: Math.max(2, height),
            backgroundColor: color || "currentColor",
            opacity: recording ? 0.6 + (height / maxBarHeight) * 0.4 : 0.3,
            transition: "height 0.05s ease-out, opacity 0.1s ease-out",
          }}
        />
      ))}
    </div>
  )
}
