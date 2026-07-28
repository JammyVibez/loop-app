"use client"

import { useEffect, useState } from "react"
import { Coins, Flame, Gift, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type PulseState = {
  daily: { claimed: boolean; amount: number; streak: number }
  weekly: { claimed: boolean; amount: number }
  coins: number
}

export function DailyPulse() {
  const { user, getAuthHeader, refreshUser } = useAuth()
  const { toast } = useToast()
  const [state, setState] = useState<PulseState | null>(null)
  const [busy, setBusy] = useState<"daily" | "weekly" | null>(null)

  const load = async () => {
    if (!user) return
    try {
      const res = await fetch("/api/quests/daily-checkin", {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      const data = await res.json()
      if (res.ok) setState(data)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  if (!user || !state) return null
  if (state.daily.claimed && state.weekly.claimed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-gradient-to-r from-amber-500/10 via-transparent to-sky-500/10 px-4 py-3">
        <Flame className="h-5 w-5 text-orange-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{state.daily.streak}-day streak</p>
          <p className="text-xs text-muted-foreground">Come back tomorrow for more coins</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500">
          <Coins className="h-3.5 w-3.5" />
          {state.coins}
        </span>
      </div>
    )
  }

  const claim = async (kind: "daily" | "weekly") => {
    setBusy(kind)
    try {
      const res = await fetch("/api/quests/daily-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ kind }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not claim")
      toast({
        title: kind === "daily" ? "Daily check-in claimed!" : "Weekly bonus unlocked!",
        description: `+${data.amount} Loop Coins`,
      })
      await refreshUser?.()
      await load()
    } catch (error: any) {
      toast({ title: "Not available", description: error.message, variant: "destructive" })
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-sky-500" />
            Daily Pulse
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Check in to keep your streak and earn coins — the habit that brings you back.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
          <Flame className="h-3.5 w-3.5" />
          {state.daily.streak}d
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          disabled={state.daily.claimed || busy !== null}
          onClick={() => void claim("daily")}
          className={cn(
            "justify-between rounded-xl",
            state.daily.claimed ? "bg-muted text-muted-foreground" : "bg-sky-600 hover:bg-sky-500",
          )}
        >
          <span>{state.daily.claimed ? "Checked in" : "Claim today"}</span>
          <span className="inline-flex items-center gap-1 text-xs opacity-90">
            <Coins className="h-3.5 w-3.5" />+{state.daily.amount}
          </span>
        </Button>
        <Button
          variant="outline"
          disabled={state.weekly.claimed || busy !== null}
          onClick={() => void claim("weekly")}
          className="justify-between rounded-xl"
        >
          <span className="inline-flex items-center gap-1.5">
            <Gift className="h-4 w-4" />
            {state.weekly.claimed ? "Weekly claimed" : "Weekly bonus"}
          </span>
          <span className="text-xs text-muted-foreground">+{state.weekly.amount}</span>
        </Button>
      </div>
    </div>
  )
}
