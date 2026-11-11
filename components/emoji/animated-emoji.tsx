"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"
import {
  getAnimatedEmoji,
  isAnimatedEmoji,
  localEmojiSrc,
  localLottieSrc,
} from "@/lib/emoji/animated-emoji"

const LottieEmoji = dynamic(() => import("./lottie-emoji").then((mod) => mod.LottieEmoji), {
  ssr: false,
})

type Size = number | string

function sizeStyle(size: Size) {
  return { width: typeof size === "number" ? `${size}px` : size, height: typeof size === "number" ? `${size}px` : size }
}

interface AnimatedEmojiProps {
  emoji: string
  /** Pixel size, or any CSS length (defaults to 1.15em so it scales with text). */
  size?: Size
  className?: string
  /** Render the Lottie version when one was mirrored. Falls back to WebP. */
  format?: "webp" | "lottie"
  title?: string
  /** Above-the-fold emoji only; everything else lazy-loads. */
  eager?: boolean
}

/**
 * One animated emoji, local-first with the upstream CDN as a fallback.
 *
 * Rendering an unsupported character is a no-op span so callers can drop this
 * anywhere without checking first.
 */
export function AnimatedEmoji({
  emoji,
  size = "1.15em",
  className,
  format = "webp",
  title,
  eager = false,
}: AnimatedEmojiProps) {
  const asset = getAnimatedEmoji(emoji)
  const [useCdn, setUseCdn] = useState(false)

  // A fresh emoji should always try the local copy first.
  useEffect(() => {
    setUseCdn(false)
  }, [emoji])

  const local = asset ? localEmojiSrc(asset) : null
  const lottie = asset ? localLottieSrc(asset) : null

  if (!asset) {
    return <span className={className}>{emoji}</span>
  }

  if (format === "lottie" && lottie) {
    return <LottieEmoji src={lottie} size={size} className={className} label={title || asset.name} />
  }

  const src = !useCdn && local ? local : asset.cdn

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={emoji}
      title={title || asset.name}
      width={typeof size === "number" ? size : undefined}
      height={typeof size === "number" ? size : undefined}
      style={sizeStyle(size)}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => {
        // Local mirror missing (or a bad build) → try the upstream copy once.
        if (!useCdn) setUseCdn(true)
      }}
      className={cn("inline-block select-none align-[-0.15em] object-contain", className)}
    />
  )
}

interface EmojiTextProps {
  text: string
  className?: string
  size?: Size
  /** Cap how many animations one block can start (protects long posts). */
  maxAnimated?: number
}

const segmenter =
  typeof Intl !== "undefined" && typeof (Intl as any).Segmenter === "function"
    ? new (Intl as any).Segmenter(undefined, { granularity: "grapheme" })
    : null

/** Split into user-perceived characters so ZWJ emoji stay intact. */
export function splitGraphemes(text: string): string[] {
  if (!text) return []
  if (segmenter) return Array.from(segmenter.segment(text), (part: { segment: string }) => part.segment)
  return Array.from(text)
}

/**
 * Renders text with any mirrored emoji replaced by its animation, leaving every
 * other character (including non-animated emoji) exactly as it was.
 */
export function EmojiText({ text, className, size = "1.15em", maxAnimated = 24 }: EmojiTextProps) {
  const parts = useMemo(() => splitGraphemes(text), [text])

  // Batch consecutive plain characters into one text node: a long post should
  // not turn into thousands of spans just because it might contain emoji.
  const nodes: ReactNode[] = []
  let buffer = ""
  let animated = 0

  const flush = () => {
    if (!buffer) return
    nodes.push(<span key={`text-${nodes.length}`}>{buffer}</span>)
    buffer = ""
  }

  for (const part of parts) {
    if (isAnimatedEmoji(part) && animated < maxAnimated) {
      flush()
      animated += 1
      nodes.push(<AnimatedEmoji key={`emoji-${nodes.length}`} emoji={part} size={size} />)
    } else {
      buffer += part
    }
  }
  flush()

  return <span className={className}>{nodes}</span>
}
