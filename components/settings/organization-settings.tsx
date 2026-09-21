"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Building2, TrendingUp, Crown, Coins, Percent, Users, ExternalLink, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"

interface OrgStatus {
  threshold: number
  follower_count: number
  eligible: boolean
  is_organization: boolean
  organization_name: string | null
  organization_badge_url: string | null
  organization_config: {
    coin_rate_multiplier: number
    custom_boost_discount: number
    circle_perk_price: number
    exclusive_rewards_enabled: boolean
  }
}

export function OrganizationSettings() {
  const { user, getAuthHeader, refreshUser } = useAuth()
  const { toast } = useToast()
  const [status, setStatus] = useState<OrgStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [orgName, setOrgName] = useState("")
  const [coinMultiplier, setCoinMultiplier] = useState(1.5)
  const [boostDiscount, setBoostDiscount] = useState(20)
  const [circlePerkPrice, setCirclePerkPrice] = useState(50)
  const [exclusiveRewards, setExclusiveRewards] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/organizations/upgrade", { headers: getAuthHeader(), cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load organization status")
      setStatus(data)
      setOrgName(data.organization_name || "")
      setCoinMultiplier(Number(data.organization_config?.coin_rate_multiplier) || 1.5)
      setBoostDiscount(Math.round(Number(data.organization_config?.custom_boost_discount || 0.2) * 100))
      setCirclePerkPrice(Number(data.organization_config?.circle_perk_price) || 50)
      setExclusiveRewards(Boolean(data.organization_config?.exclusive_rewards_enabled))
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const enable = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/organizations/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ action: "enable", organization_name: orgName.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to enable organization mode")
      toast({ title: "Organization mode enabled 🏢", description: data.message })
      await load()
      await refreshUser()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (
      !(await confirmDialog({
        title: "Disable organization mode?",
        description: "Your perks and org badge are turned off. You can re-enable it any time.",
        confirmLabel: "Disable",
        destructive: true,
      }))
    )
      return
    setBusy(true)
    try {
      const res = await fetch("/api/organizations/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ action: "disable" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to disable organization mode")
      toast({ title: "Organization mode disabled", description: data.message })
      await load()
      await refreshUser()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const saveConfig = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/organizations/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          action: "update_config",
          organization_name: orgName.trim() || undefined,
          coin_rate_multiplier: Number(coinMultiplier),
          custom_boost_discount: Number(boostDiscount) / 100,
          circle_perk_price: Number(circlePerkPrice),
          exclusive_rewards_enabled: exclusiveRewards,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save configuration")
      toast({ title: "Saved", description: data.message })
      await load()
      await refreshUser()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" /> Checking organization eligibility…
        </CardContent>
      </Card>
    )
  }

  if (!status) return null

  const isOrg = status.is_organization
  const progressPct = Math.min(100, Math.round((status.follower_count / Math.max(1, status.threshold)) * 100))

  return (
    <div className="space-y-4">
      {!isOrg ? (
        <>
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-transparent">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Become an Organization</CardTitle>
                  <CardDescription>
                    Turn your account into an Official Organization once you reach the follower milestone.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Users className="h-4 w-4 text-emerald-500" /> {status.follower_count.toLocaleString()} followers
                  </span>
                  <span className="text-muted-foreground">Target: {status.threshold.toLocaleString()}</span>
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      status.eligible ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-amber-500",
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {status.eligible
                    ? "You've hit the milestone — organization mode is unlocked! 🎉"
                    : `${Math.max(0, status.threshold - status.follower_count).toLocaleString()} more followers to unlock.`}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Coins, label: "1.5× coin rate", desc: "Earn 50% more Loop Coins" },
                  { icon: Percent, label: "20% boost discount", desc: "Cheaper post boosts" },
                  { icon: Crown, label: "Org badge + perks", desc: "Recognized across Loop" },
                ].map((perk) => (
                  <div key={perk.label} className="rounded-xl border border-border bg-card/60 p-3">
                    <perk.icon className="h-4 w-4 text-emerald-500" />
                    <p className="mt-1.5 text-sm font-semibold">{perk.label}</p>
                    <p className="text-xs text-muted-foreground">{perk.desc}</p>
                  </div>
                ))}
              </div>

              <Button
                onClick={enable}
                disabled={!status.eligible || busy}
                className="w-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold"
              >
                {busy ? "Enabling…" : status.eligible ? "Enable Organization Mode" : `Unlocks at ${status.threshold.toLocaleString()} followers`}
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-background to-transparent">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {status.organization_name || "Organization Account"}
                      <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40">Official</Badge>
                    </CardTitle>
                    <CardDescription>Organization mode is active · {status.follower_count.toLocaleString()} followers</CardDescription>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link href="/organization">
                    Open dashboard <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Organization display name</Label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Acme Studio" />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Coin rate multiplier</Label>
                  <Input type="number" min={1} max={5} step={0.1} value={coinMultiplier} onChange={(e) => setCoinMultiplier(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Boost discount (%)</Label>
                  <Input type="number" min={0} max={80} value={boostDiscount} onChange={(e) => setBoostDiscount(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Circle perk price (coins)</Label>
                  <Input type="number" min={0} value={circlePerkPrice} onChange={(e) => setCirclePerkPrice(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
                <div>
                  <Label>Exclusive rewards</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Offer members exclusive perks & rewards</p>
                </div>
                <Switch checked={exclusiveRewards} onCheckedChange={setExclusiveRewards} />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={saveConfig} disabled={busy} className="rounded-full">
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> {busy ? "Saving…" : "Save organization settings"}
                </Button>
                <Button variant="ghost" onClick={disable} disabled={busy} className="rounded-full text-destructive hover:text-destructive">
                  Disable organization mode
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> Org growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Followers", value: status.follower_count.toLocaleString() },
                  { label: "Coin rate", value: `${coinMultiplier}×` },
                  { label: "Boost discount", value: `${boostDiscount}%` },
                  { label: "Circle perk", value: `${circlePerkPrice} coins` },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-card/60 p-3 text-center">
                    <p className="text-lg font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
