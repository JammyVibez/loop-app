"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldAlert, Clock, ArrowLeft, RefreshCw } from "@/components/icons/lucide-compat"

export default function RateLimitPage() {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState(60)

  useEffect(() => {
    // Try to read the retry-after from sessionStorage (set by the 429 handler)
    const retryAfter = sessionStorage.getItem("ratelimit-retry-after")
    if (retryAfter) {
      const secs = Math.max(1, Math.ceil((Number(retryAfter) - Date.now()) / 1000))
      setSecondsLeft(Math.min(secs, 300)) // cap at 5 min display
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/60 bg-card/80 backdrop-blur-xl">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-red-500/20 ring-2 ring-amber-500/30">
            <ShieldAlert className="h-10 w-10 text-amber-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Slow down</h1>
            <p className="text-sm text-muted-foreground">
              You&apos;ve made too many requests. Please wait a moment before trying again.
            </p>
          </div>

          {secondsLeft > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-6 py-4">
              <Clock className="h-5 w-5 text-amber-400 animate-pulse" />
              <span className="text-3xl font-black tabular-nums text-amber-400 font-mono">
                {formatTime(secondsLeft)}
              </span>
            </div>
          )}

          <div className="flex w-full gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-2 border-border"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" /> Go back
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={() => {
                if (secondsLeft <= 0) {
                  window.location.reload()
                }
              }}
              disabled={secondsLeft > 0}
            >
              <RefreshCw className="h-4 w-4" /> {secondsLeft > 0 ? "Wait..." : "Try again"}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground/60">
            Rate limits protect the community from spam and abuse.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
