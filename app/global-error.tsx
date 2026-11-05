"use client"

import { useEffect } from "react"
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-reload"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const chunkError = isChunkLoadError(error)

  useEffect(() => {
    if (chunkError) reloadOnceForChunkError()
  }, [chunkError])

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-background text-foreground">
        <h2 className="mb-2 text-2xl font-bold">
          {chunkError ? "This page is out of date" : "Global Application Error"}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {chunkError
            ? "We released a new version while this tab was open. Reload to continue."
            : error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={() => (chunkError ? window.location.reload() : reset())}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {chunkError ? "Reload page" : "Try again"}
        </button>
      </body>
    </html>
  )
}
