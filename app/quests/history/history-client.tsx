"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/skeletons"
import { ArrowLeft, BadgeCheck, Check, Clock, Coins, Hourglass, Trophy, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface HistoryEntry {
  quest_id: string
  title: string
  description: string | null
  icon: string | null
  banner_url: string | null
  quest_type: string
  quest_kind: string
  cadence: string
  category: string | null
  reward_label: string | null
  reward_item_name: string | null
  progress: { count: number; completed: boolean; claimed: boolean }
  rewards_earned: { coins: number; xp: number }
  status: "claimed" | "completed" | "in_progress" | "expired"
  completed_at: string | null
  claimed_at: string | null
  updated_at: string
}

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  claimed: { label: "Claimed", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: BadgeCheck },
  completed: { label: "Completed", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Trophy },
  in_progress: { label: "In Progress", cls: "bg-sky-500/10 text-sky-500 border-sky-500/30", icon: Clock },
  expired: { label: "Expired", cls: "bg-muted text-muted-foreground border-border", icon: Hourglass },
}

const FILTERS = ["all", "claimed", "completed", "in_progress", "expired"] as const

export default function QuestHistoryClient() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all")

  const load = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch("/api/quests/history", { headers: getAuthHeader() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load history")
      setHistory(json.history || [])
    } catch (err: any) {
      toast({ title: "Could not load history", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [user, getAuthHeader, toast])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const claimed = history.filter((h) => h.status === "claimed")
    return {
      quests: claimed.length,
      coins: claimed.reduce((a, h) => a + h.rewards_earned.coins, 0),
      xp: claimed.reduce((a, h) => a + h.rewards_earned.xp, 0),
    }
  }, [history])

  const filtered = filter === "all" ? history : history.filter((h) => h.status === filter)

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-5 sm:pt-6">
      <Link href="/quests" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Quests
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Quest history</h1>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/70 bg-card p-3 text-center">
          <p className="text-xl font-semibold tabular-nums">{totals.quests}</p>
          <p className="text-[11px] text-muted-foreground">Quests claimed</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-3 text-center">
          <p className="inline-flex items-center gap-1 text-xl font-semibold tabular-nums text-amber-600">
            <Coins className="h-4 w-4" /> {totals.coins.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">Coins earned</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-3 text-center">
          <p className="inline-flex items-center gap-1 text-xl font-semibold tabular-nums text-foreground">
            <Zap className="h-4 w-4 text-primary" /> {totals.xp.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">XP earned</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f === "all" ? "All" : STATUS_META[f]?.label || f}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="mt-4 space-y-2.5">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nothing here yet.
          </div>
        )}
        {filtered.map((h) => {
          const meta = STATUS_META[h.status]
          const Icon = meta.icon
          return (
            <Link
              key={`${h.quest_id}-${h.updated_at}`}
              href={`/quests/${h.quest_id}`}
              className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 transition-colors hover:bg-muted/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{h.title}</p>
                  <Badge variant="outline" className={cn("shrink-0 rounded-full text-[9px]", meta.cls)}>
                    {meta.label}
                  </Badge>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{h.quest_kind === "mission" ? "Mission" : h.quest_type}</span>
                  {h.rewards_earned.coins > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-medium text-amber-600">
                      <Coins className="h-3 w-3" /> +{h.rewards_earned.coins.toLocaleString()}
                    </span>
                  )}
                  {h.rewards_earned.xp > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-medium text-violet-500">
                      <Zap className="h-3 w-3" /> +{h.rewards_earned.xp.toLocaleString()}
                    </span>
                  )}
                  {h.reward_item_name && <span className="font-medium text-pink-500">{h.reward_item_name}</span>}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {new Date(h.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
