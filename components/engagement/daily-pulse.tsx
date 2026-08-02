"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Coins, Flame, Gift, ShoppingBag, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type PulseState = {
  daily: {
    claimed: boolean
    amount: number
    streak: number
    next_available?: string
    enabled?: boolean
  }
  weekly: {
    claimed: boolean
    amount: number
    next_available?: string
    enabled?: boolean
  }
  economy?: {
    daily_claim_enabled?: boolean
    weekly_claim_enabled?: boolean
  }
  coins: number
}

function formatRemaining(iso?: string) {
  if (!iso) return ""
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return "ready"
  const totalMin = Math.ceil(ms / 60000)
  const days = Math.floor(totalMin / (60 * 24))
  const hours = Math.floor((totalMin % (60 * 24)) / 60)
  const mins = totalMin % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function DailyPulse() {
  const { user, getAuthHeader, refreshUser } = useAuth()
  const { toast } = useToast()
  const [state, setState] = useState<PulseState | null>(null)
  const [busy, setBusy] = useState<"daily" | "weekly" | null>(null)
  const [, setTick] = useState(0)

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

  useEffect(() => {
    if (!state?.daily.claimed) return
    const id = setInterval(() => {
      setTick((t) => t + 1)
      if (state.daily.next_available && new Date(state.daily.next_available).getTime() <= Date.now()) {
        void load()
      }
    }, 30000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.daily.claimed, state?.daily.next_available])

  const claim = async (kind: "daily" | "weekly") => {
    setBusy(kind)
    try {
      const res = await fetch("/api/quests/daily-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ kind }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.disabled) {
          toast({
            title: "Claims paused",
            description: data.error || "Buy coins in the shop instead.",
          })
          await load()
          return
        }
        if (data?.claimed || /already claimed/i.test(String(data?.error || ""))) {
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  daily:
                    kind === "daily"
                      ? {
                          ...prev.daily,
                          claimed: true,
                          next_available: data.next_available || prev.daily.next_available,
                        }
                      : prev.daily,
                  weekly:
                    kind === "weekly"
                      ? {
                          ...prev.weekly,
                          claimed: true,
                          next_available: data.next_available || prev.weekly.next_available,
                        }
                      : prev.weekly,
                }
              : prev,
          )
          await load()
          return
        }
        const wait = data.next_available ? ` Next in ${formatRemaining(data.next_available)}.` : ""
        throw new Error((data.error || "Could not claim") + wait)
      }
      if (kind === "daily") {
        setState((prev) =>
          prev
            ? {
                ...prev,
                daily: {
                  ...prev.daily,
                  claimed: true,
                  next_available: data.next_available || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                },
                coins: typeof data.coins === "number" ? data.coins : prev.coins,
              }
            : prev,
        )
      }
      toast({
        title: kind === "daily" ? "Daily check-in claimed!" : "Weekly bonus unlocked!",
        description: `+${data.amount} Loop Coins${
          data.streak_bonus ? ` (includes +${data.streak_bonus} streak)` : ""
        } · next ${kind === "daily" ? "in 24h" : "in 7 days"}`,
      })
      await refreshUser?.()
      await load()
    } catch (error: any) {
      toast({ title: "Not available yet", description: error.message, variant: "destructive" })
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (!user || !state) return null

  const dailyOn = state.economy?.daily_claim_enabled !== false && state.daily.enabled !== false
  const weeklyOn = state.economy?.weekly_claim_enabled !== false && state.weekly.enabled !== false

  if (!dailyOn && !weeklyOn) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <ShoppingBag className="h-4 w-4 text-amber-500" />
          Free claims paused
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Daily and weekly coins are off right now. Grab a pack or Get Pro to keep creating.
        </p>
        <div className="mt-3 flex gap-2">
          <Button asChild size="sm" className="rounded-full">
            <Link href="/shop">Buy coins</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link href="/premium">Get Pro</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (state.daily.claimed || !dailyOn) {
    if (state.weekly.claimed || !weeklyOn) return null
    return (
      <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Gift className="h-4 w-4 text-violet-500" />
            Weekly bonus available
          </p>
          {dailyOn ? (
            <span className="text-xs text-muted-foreground">
              Daily next in {formatRemaining(state.daily.next_available)}
            </span>
          ) : null}
        </div>
        <Button
          variant="outline"
          disabled={busy !== null}
          onClick={() => void claim("weekly")}
          className="h-auto w-full justify-between rounded-xl py-3"
        >
          <span>Claim weekly</span>
          <span className="text-xs text-muted-foreground">+{state.weekly.amount}</span>
        </Button>
      </div>
    )
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
            Small daily boost — bigger packs are in the shop. Pro earns a little more.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
          <Flame className="h-3.5 w-3.5" />
          {state.daily.streak}d
        </span>
      </div>

      <div className={cn("grid gap-2", weeklyOn ? "sm:grid-cols-2" : "grid-cols-1")}>
        <Button
          disabled={busy !== null}
          onClick={() => void claim("daily")}
          className="h-auto justify-between rounded-xl bg-sky-600 py-3 hover:bg-sky-500"
        >
          <span className="text-left">
            <span className="block">Claim today</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs opacity-90">
            <Coins className="h-3.5 w-3.5" />+{state.daily.amount}
          </span>
        </Button>
        {weeklyOn ? (
          <Button
            variant="outline"
            disabled={state.weekly.claimed || busy !== null}
            onClick={() => void claim("weekly")}
            className="h-auto justify-between rounded-xl py-3"
          >
            <span className="inline-flex items-center gap-1.5 text-left">
              <Gift className="h-4 w-4" />
              {state.weekly.claimed ? "Weekly claimed" : "Weekly bonus"}
            </span>
            <span className="text-xs text-muted-foreground">+{state.weekly.amount}</span>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
