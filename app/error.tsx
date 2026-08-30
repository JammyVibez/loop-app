"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-2">Error: {error.digest}</p>
      )}
      {error.stack && (
        <pre className="text-xs text-left text-muted-foreground max-w-lg overflow-auto mb-4 bg-muted p-2 rounded">{error.stack}</pre>
      )}
      <Button onClick={() => reset()} className="rounded-full">
        Try again
      </Button>
    </div>
  )
}
