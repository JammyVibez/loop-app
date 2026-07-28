"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, X } from "lucide-react"
import Link from "next/link"

const CHANGELOG_KEY = "loop-changelog-seen-v2026-07-28"
const VERSION = "2026.07.28"

const highlights = [
  "Create loops with drafts, preview, crop, and hashtag suggestions",
  "Circle creation, rooms, moderation, and studio settings",
  "Comment edit/delete/likes + report flow on posts",
  "Profile share card with QR + invite friends",
]

export function AppUpdateBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(CHANGELOG_KEY)
      if (seen !== VERSION) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem(CHANGELOG_KEY, VERSION)
    setVisible(false)
  }

  return (
    <div className="border-b border-cyan-400/20 bg-gradient-to-r from-violet-600/20 via-[#0a1020] to-cyan-500/20 px-4 py-3 text-slate-100">
      <div className="container mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-cyan-400/15 p-2 text-cyan-200">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">What's new in Loop {VERSION}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
              {highlights.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="border-white/15 bg-white/5">
            <Link href="/invite">Invite friends</Link>
          </Button>
          <Button size="sm" onClick={dismiss} className="bg-violet-600 hover:bg-violet-500">
            Got it
          </Button>
          <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
