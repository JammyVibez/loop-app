"use client"

import { useEffect, useState } from "react"
import { Coins, Save, ShoppingBag } from "@/components/icons/lucide-compat"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { ECONOMY_DEFAULTS, type EconomySettings } from "@/lib/economy"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/skeletons"

export function EconomyControl() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [economy, setEconomy] = useState<EconomySettings>({ ...ECONOMY_DEFAULTS })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/economy", {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load economy")
      setEconomy(data.economy)
    } catch (error: any) {
      toast({ title: "Economy load failed", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/economy", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ economy }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setEconomy(data.economy)
      toast({
        title: "Economy updated",
        description: `Daily ${data.economy.daily_claim_enabled ? "on" : "off"} · Weekly ${
          data.economy.weekly_claim_enabled ? "on" : "off"
        }`,
      })
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            Coin claims & faucet
          </CardTitle>
          <CardDescription>
            Harden free coins so users rely on purchases / Pro. Purchases and Stripe packs stay enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="font-medium">Daily claim</p>
                <p className="text-xs text-muted-foreground">24h cooldown check-in</p>
              </div>
              <Switch
                checked={economy.daily_claim_enabled}
                onCheckedChange={(v) => setEconomy((e) => ({ ...e, daily_claim_enabled: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="font-medium">Weekly claim</p>
                <p className="text-xs text-muted-foreground">7-day bonus faucet</p>
              </div>
              <Switch
                checked={economy.weekly_claim_enabled}
                onCheckedChange={(v) => setEconomy((e) => ({ ...e, weekly_claim_enabled: v }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["daily_amount", "Daily coins (free)"],
                ["daily_pro_amount", "Daily coins (Pro)"],
                ["weekly_amount", "Weekly coins"],
                ["signup_bonus", "Signup seed"],
                ["onboarding_bonus", "Onboarding bonus"],
                ["streak_bonus_amount", "Streak bonus coins"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  min={0}
                  value={economy[key]}
                  onChange={(e) =>
                    setEconomy((prev) => ({
                      ...prev,
                      [key]: Number(e.target.value || 0),
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <p className="font-medium">7-day streak micro-bonus</p>
              <p className="text-xs text-muted-foreground">
                Extra +{economy.streak_bonus_amount} on daily claim after {economy.streak_bonus_days} days
              </p>
            </div>
            <Switch
              checked={economy.streak_bonus_enabled}
              onCheckedChange={(v) => setEconomy((e) => ({ ...e, streak_bonus_enabled: v }))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void save()} disabled={saving} className="rounded-full">
              {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Save economy
            </Button>
            <Button variant="outline" className="rounded-full" asChild>
              <Link href="/shop">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Open shop
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEconomy({ ...ECONOMY_DEFAULTS })}
            >
              Reset to hardened defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
