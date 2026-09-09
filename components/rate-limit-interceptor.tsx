"use client"

import { useEffect } from "react"

/**
 * Intercepts fetch 429 responses and stores the retry-after timestamp
 * in sessionStorage so the /ratelimit page can display a countdown.
 * Also intercepts Next.js router pushes that result in 429.
 */
export function RateLimitInterceptor() {
  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After")
        const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000
        sessionStorage.setItem("ratelimit-retry-after", String(Date.now() + retryMs))
        // Only redirect for non-API navigation requests
        const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0])
        if (!url.startsWith("/api/")) {
          window.location.href = "/ratelimit"
        }
      }
      return response
    }
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return null
}
