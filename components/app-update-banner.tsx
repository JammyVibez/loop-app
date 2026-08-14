"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Zap, X } from "lucide-react"
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
    <div className="border-b border-border/60 bg-gradient-to-r from-indigo-500/10 via-background to-cyan-500/10 px-4 py-2.5 text-foreground">
      <div className="container mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-1.5 text-primary shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">What's new in loopapp.me {VERSION}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {highlights.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Button asChild size="sm" variant="outline" className="rounded-full text-xs h-8">
            <Link href="/invite">Invite friends</Link>
          </Button>
          <Button size="sm" onClick={dismiss} className="rounded-full text-xs h-8">
            Got it
          </Button>
          <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Dismiss" className="h-8 w-8 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
