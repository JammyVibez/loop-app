"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { WifiOff, RefreshCw, Home } from "lucide-react"

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712] px-4 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a1020]/90 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200">
          <WifiOff className="h-7 w-7" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold">You're offline</h1>
        <p className="mb-6 text-sm text-slate-400">
          loopapp.me needs a connection for live feeds, chat, and uploads. Cached pages may still open, but posting and
          messaging will wait until you're back online.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-violet-600 to-cyan-500">
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
          <Button asChild variant="outline" className="border-white/15 bg-white/5">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" /> Home
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          Tip: drafts in the composer are saved on this device, so you won't lose unfinished loops.
        </p>
      </div>
    </div>
  )
}
