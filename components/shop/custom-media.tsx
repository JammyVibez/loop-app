"use client"

/**
 * Custom shop art.
 *
 * An admin can attach anything they like to a shop item — a photo, a GIF, a
 * looping video, or a Lottie `.json` they exported from After Effects. This is
 * the one place that knows how to draw each of those, so the card, the preview
 * dialog and the admin panel all show the same thing.
 */

import { useEffect, useState } from "react"
import { Lottie } from "@/components/ui/lottie"
import { Spinner } from "@/components/ui/skeletons"
import { cn } from "@/lib/utils"

/** A URL the admin attached: `image_url` or `animation_url`, row or item_data. */
export function customMediaFor(item: {
  item_data?: Record<string, unknown> | null
  [key: string]: unknown
}): string | null {
  const data = (item.item_data || {}) as Record<string, unknown>
  const url = item.image_url || item.animation_url || data.image_url || data.animation_url
  return typeof url === "string" && url.trim() ? url : null
}

/** Video files need a `<video>` element; GIFs animate happily inside an `<img>`. */
export function isVideoMedia(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url) || /video\/|resource_type=video/.test(url)
}

/** A Lottie export, which has to be fetched and parsed before it can be drawn. */
export function isLottieMedia(url: string): boolean {
  return /\.json(\?|$)/i.test(url)
}

function RemoteLottie({ url, className }: { url: string; className?: string }) {
  const [data, setData] = useState<object | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setFailed(false)

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        // A shop item pointing at an HTML 404 page would otherwise crash the
        // player, so only a real animation document is accepted.
        if (cancelled) return
        if (json && typeof json === "object" && Array.isArray(json.layers)) setData(json)
        else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [url])

  if (failed) return null
  if (!data) {
    return (
      <span className="flex h-full w-full items-center justify-center">
        <Spinner className={cn("h-5 w-5 text-muted-foreground", className)} />
      </span>
    )
  }

  return <Lottie animation={data} className={cn("h-full w-full", className)} />
}

export interface CustomMediaProps {
  url: string
  alt?: string
  /** `cover` fills the tile (cards); `contain` shows the whole thing (dialog). */
  fit?: "cover" | "contain"
  className?: string
}

/** Draws whatever the admin attached. */
export function CustomMedia({ url, alt = "", fit = "cover", className }: CustomMediaProps) {
  const objectFit = fit === "cover" ? "object-cover" : "object-contain"

  if (isVideoMedia(url)) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video src={url} autoPlay loop muted playsInline className={cn("h-full w-full", objectFit, className)} />
    )
  }

  if (isLottieMedia(url)) {
    return <RemoteLottie url={url} className={className} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} draggable={false} className={cn("h-full w-full", objectFit, className)} />
  )
}
