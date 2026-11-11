"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-reload"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const chunkError = isChunkLoadError(error)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    console.error("Application error:", error)
    if (!chunkError) return
    // A deploy swapped the build under this tab; reloading picks up the new
    // chunk names. Runs at most once per 30s so a real outage can't loop.
    setReloading(reloadOnceForChunkError())
  }, [error, chunkError])

  if (chunkError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <RefreshCw className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-xl font-bold">{reloading ? "Updating LOOP…" : "This page is out of date"}</h2>
        <p className="mb-5 max-w-sm text-sm text-muted-foreground">
          {reloading
            ? "Loading the latest version."
            : "We released a new version while this tab was open. Reload to continue."}
        </p>
        <Button onClick={() => window.location.reload()} className="rounded-full">
          Reload page
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="mb-2 text-xl font-bold">Something went wrong</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button onClick={() => reset()} className="rounded-full">
        Try again
      </Button>
    </div>
  )
}
