"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import {
  MessageSquare,
  Swords,
  Users,
  UserPlus,
  Handshake,
  Zap,
  X,
} from "@/components/icons/lucide-compat"

type RecapItem = {
  kind: "comment" | "duel" | "circle" | "follow" | "co_loop"
  title: string
  detail: string
  href: string
  icon: "comment" | "duel" | "circle" | "follow" | "co_loop"
}

const ICONS = {
  comment: MessageSquare,
  duel: Swords,
  circle: Users,
  follow: UserPlus,
  co_loop: Handshake,
} as const

const ICON_STYLES = {
  comment: "bg-sky-500/15 text-sky-500 dark:text-sky-400",
  duel: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
  circle: "bg-violet-500/15 text-violet-500 dark:text-violet-400",
  follow: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
  co_loop: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
} as const

const LAST_VISIT_KEY = "loop_last_visit_at"

export function ReturnRecap() {
  const { user } = useAuth()
  const [items, setItems] = useState<RecapItem[] | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!user || !mounted.current) return
    let cancelled = false

    async function load() {
      try {
        const since = localStorage.getItem(LAST_VISIT_KEY) || ""
        const res = await fetch(`/api/home/recap?since=${encodeURIComponent(since)}`, {
          cache: "no-store",
        })
        const data = await res.json()
        if (!cancelled && data?.success) {
          setItems(Array.isArray(data.items) ? data.items.slice(0, 5) : [])
        } else if (!cancelled) {
          setItems([])
        }
      } catch {
        if (!cancelled) setItems([])
      } finally {
        // This visit becomes the baseline for the next one.
        try {
          localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
        } catch {
          /* storage unavailable */
        }
      }
    }
    void load()

    return () => {
      cancelled = true
    }
  }, [user])

  if (!user || dismissed || items === null || items.length === 0) return null

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/[0.07] via-transparent to-violet-500/[0.07]" />
      <div className="relative p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="h-4 w-4 text-primary" />
            Welcome back 👋 — {items.length} thing{items.length === 1 ? "" : "s"} happened while you were away
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss recap"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ul className="mt-3 grid gap-2">
          {items.map((item, i) => {
            const Icon = ICONS[item.icon] || MessageSquare
            return (
              <li key={`${item.kind}-${i}`}>
                <Link
                  href={item.href}
                  className="group flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition-colors hover:border-border/80 hover:bg-muted/40"
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ICON_STYLES[item.icon] || ICON_STYLES.comment}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug text-foreground group-hover:text-primary">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
