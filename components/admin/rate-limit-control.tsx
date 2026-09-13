"use client"

import { useEffect, useState } from "react"
import { Save, ShieldAlert, ShieldCheck, Gauge } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { RATE_LIMIT_ACTIONS, RATE_LIMIT_DEFAULTS, type RateLimitSettings } from "@/lib/rate-limit-settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/skeletons"

export function RateLimitControl() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [settings, setSettings] = useState<RateLimitSettings>({ ...RATE_LIMIT_DEFAULTS })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/rate-limits", {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load rate limits")
      setSettings(data.settings)
    } catch (error: any) {
      toast({ title: "Rate limit load failed", description: error.message, variant: "destructive" })
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
      const res = await fetch("/api/admin/rate-limits", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ settings }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setSettings(data.settings)
      toast({
        title: "Rate limits updated",
        description: data.message || "New limits are live now.",
      })
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const setNumber = (key: keyof RateLimitSettings, value: number) =>
    setSettings((prev) => ({ ...prev, [key]: Number.isFinite(value) ? Math.max(0, Math.round(value)) : prev[key] }))

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
      <Card className={settings.enabled ? "border-emerald-500/30" : "border-red-500/30"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {settings.enabled ? (
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-red-500" />
            )}
            Platform rate limits
          </CardTitle>
          <CardDescription>
            Throttle posting, comments, likes, uploads and messages to stop spam waves and abuse. Limits apply per user,
            per minute. Auth (login/signup) keeps a security floor even when the master switch is off.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                Master switch
              </p>
              <p className="text-xs text-muted-foreground">
                Turn all non-auth limits on or off instantly — useful during tests, launches or incident response.
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings((prev) => ({ ...prev, enabled: v }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RATE_LIMIT_ACTIONS.map(({ key, label, window }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  min={1}
                  value={Number(settings[key])}
                  onChange={(e) => setNumber(key, Number(e.target.value || 0))}
                  disabled={!settings.enabled && !["login_ip_max", "login_fail_max", "signup_ip_max", "signup_email_max"].includes(key)}
                />
                <p className="text-[11px] text-muted-foreground">{window}</p>
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="login_lockout_base_min">Login lockout base (minutes)</Label>
              <Input
                id="login_lockout_base_min"
                type="number"
                min={1}
                value={settings.login_lockout_base_min}
                onChange={(e) => setNumber("login_lockout_base_min", Number(e.target.value || 0))}
              />
              <p className="text-[11px] text-muted-foreground">
                Lockout after repeated failures; doubles with each retry tier.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void save()} disabled={saving} className="rounded-full">
              {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Save rate limits
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettings({ ...RATE_LIMIT_DEFAULTS })}
            >
              Reset to defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
