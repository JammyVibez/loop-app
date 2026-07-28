"use client"

import { useEffect, useState } from "react"
import { Coins, Flame, Gift, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type PulseState = {
  daily: { claimed: boolean; amount: number; streak: number; next_available?: string }
  weekly: { claimed: boolean; amount: number; next_available?: string }
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
    if (!state?.daily.claimed && !state?.weekly.claimed) return
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [state?.daily.claimed, state?.weekly.claimed])

  if (!user || !state) return null

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
        const wait = data.next_available ? ` Next in ${formatRemaining(data.next_available)}.` : ""
        throw new Error((data.error || "Could not claim") + wait)
      }
      toast({
        title: kind === "daily" ? "Daily check-in claimed!" : "Weekly bonus unlocked!",
        description: `+${data.amount} Loop Coins · next ${kind === "daily" ? "in 24h" : "in 7 days"}`,
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

  return (
    <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-sky-500" />
            Daily Pulse
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Daily once every 24 hours · Weekly once every 7 days from your last claim.
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
            "h-auto justify-between rounded-xl py-3",
            state.daily.claimed ? "bg-muted text-muted-foreground" : "bg-sky-600 hover:bg-sky-500",
          )}
        >
          <span className="text-left">
            <span className="block">{state.daily.claimed ? "Claimed" : "Claim today"}</span>
            {state.daily.claimed && state.daily.next_available && (
              <span className="block text-[10px] font-normal opacity-80">
                Next in {formatRemaining(state.daily.next_available)}
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-xs opacity-90">
            <Coins className="h-3.5 w-3.5" />+{state.daily.amount}
          </span>
        </Button>
        <Button
          variant="outline"
          disabled={state.weekly.claimed || busy !== null}
          onClick={() => void claim("weekly")}
          className="h-auto justify-between rounded-xl py-3"
        >
          <span className="text-left inline-flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1.5">
              <Gift className="h-4 w-4" />
              {state.weekly.claimed ? "Weekly claimed" : "Weekly bonus"}
            </span>
            {state.weekly.claimed && state.weekly.next_available && (
              <span className="text-[10px] font-normal text-muted-foreground">
                Next in {formatRemaining(state.weekly.next_available)}
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">+{state.weekly.amount}</span>
        </Button>
      </div>
    </div>
  )
}
