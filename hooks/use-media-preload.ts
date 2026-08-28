"use client"

import { useEffect, useRef, useCallback } from "react"

/**
 * Preloads images by injecting <link rel="prefetch"> tags.
 * Safe — silently no-ops if the URL is invalid or already cached.
 */
function preloadImage(url: string) {
  if (!url || typeof document === "undefined") return
  // Skip data URLs and very short strings
  if (url.startsWith("data:") || url.length < 10) return

  try {
    const link = document.createElement("link")
    link.rel = "prefetch"
    link.href = url
    link.as = "image"
    link.fetchPriority = "low"
    document.head.appendChild(link)

    // Also create an Image object to trigger the browser cache
    const img = new Image()
    img.src = url
  } catch {
    // Silently ignore
  }
}

/**
 * Hook that preloads media for upcoming feed items.
 * Pass the current index and the full list of media URLs.
 *
 * Usage:
 *   const mediaUrls = loops.map(l => l.media_url).filter(Boolean)
 *   useMediaPreload(mediaUrls, currentIndex, 3) // preload next 3
 */
export function useMediaPreload(
  mediaUrls: (string | undefined | null)[],
  currentIndex: number,
  preloadCount: number = 3
) {
  const preloadedRef = useRef(new Set<string>())

  useEffect(() => {
    // Preload the next N items
    const start = currentIndex + 1
    const end = Math.min(start + preloadCount, mediaUrls.length)

    for (let i = start; i < end; i++) {
      const url = mediaUrls[i]
      if (url && !preloadedRef.current.has(url)) {
        preloadedRef.current.add(url)
        preloadImage(url)
      }
    }
  }, [currentIndex, mediaUrls, preloadCount])

  // Cleanup old entries periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const activeUrls = new Set(mediaUrls.slice(0, currentIndex + preloadCount + 5))
      for (const url of preloadedRef.current) {
        if (!activeUrls.has(url)) {
          preloadedRef.current.delete(url)
        }
      }
    }, 30000)
    return () => clearInterval(cleanup)
  }, [mediaUrls, currentIndex, preloadCount])
}

/**
 * Simpler version — given an array of loop objects, preload the next few media URLs.
 */
export function useFeedPreload(
  loops: Array<{ media_url?: string; media_urls?: string[] } | undefined | null>,
  currentIndex: number,
  preloadCount: number = 3
) {
  const mediaUrls = loops.map((l) => l?.media_url || l?.media_urls?.[0])
  useMediaPreload(mediaUrls as (string | undefined | null)[], currentIndex, preloadCount)
}
