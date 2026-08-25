"use client"

import { useState, useEffect, useCallback } from "react"

export interface PfpFrameData {
  id: string | number
  name: string
  image_url: string
  image_type?: string
}

const frameCache = new Map<string, PfpFrameData>()

/**
 * Fetches the PFP frame data for a given frame ID.
 * Results are cached in memory so repeated lookups are instant.
 */
export function usePfpFrame(frameId?: string | number | null) {
  const [frame, setFrame] = useState<PfpFrameData | null>(null)

  const fetchFrame = useCallback(async (id: string | number) => {
    const cacheKey = String(id)
    if (frameCache.has(cacheKey)) {
      setFrame(frameCache.get(cacheKey)!)
      return
    }

    try {
      const res = await fetch(`/api/pfp-frames/${id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.frame) {
          frameCache.set(cacheKey, data.frame)
          setFrame(data.frame)
        }
      }
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    if (frameId) {
      fetchFrame(frameId)
    } else {
      setFrame(null)
    }
  }, [frameId, fetchFrame])

  return frame
}
