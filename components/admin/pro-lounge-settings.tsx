"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { MessageSquare } from "@/components/icons/lucide-compat"
import { Spinner } from "@/components/ui/skeletons"

interface ProLoungeSetting {
  discord_invite_url: string
  enabled: boolean
  announcement: string
}

const DEFAULT_SETTING: ProLoungeSetting = { discord_invite_url: "", enabled: false, announcement: "" }

export function ProLoungeSettings() {
  const { toast } = useToast()
  const { getAuthHeader } = useAuth()
  const [setting, setSetting] = useState<ProLoungeSetting>(DEFAULT_SETTING)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetchSetting()
  }, [])

  const fetchSetting = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/settings", { headers: { ...getAuthHeader() } })
      const data = await res.json()
      if (data.success && data.data?.pro_lounge) {
        setSetting({ ...DEFAULT_SETTING, ...data.data.pro_lounge })
      }
    } catch (error) {
      console.error("Error fetching Pro Lounge settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const save = async (next: ProLoungeSetting) => {
    setSetting(next)
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ settings: { pro_lounge: next } }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Failed to save")
      toast({ title: "Pro Lounge updated", description: "Discord invite settings saved." })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-500" />
          Pro Lounge — Discord Invite
        </CardTitle>
        <CardDescription>
          Controls the Discord invite widget shown to Pro users on the Lounge page. Update the link anytime — no
          redeploy needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Show Discord widget</h3>
            <p className="text-sm text-muted-foreground">Toggle visibility for all Pro users in the Lounge.</p>
          </div>
          <Switch
            checked={setting.enabled}
            onCheckedChange={(enabled) => void save({ ...setting, enabled })}
            disabled={saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="discord-invite-url">Discord invite URL</Label>
          <div className="flex gap-2">
            <Input
              id="discord-invite-url"
              value={setting.discord_invite_url}
              onChange={(e) => setSetting((prev) => ({ ...prev, discord_invite_url: e.target.value }))}
              placeholder="https://discord.gg/your-invite"
              disabled={saving}
            />
            <Button variant="outline" onClick={() => void save(setting)} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use a permanent (non-expiring) Discord invite link so it keeps working for new Pro members.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lounge-announcement">Announcement banner</Label>
          <div className="flex gap-2">
            <Input
              id="lounge-announcement"
              value={setting.announcement}
              onChange={(e) => setSetting((prev) => ({ ...prev, announcement: e.target.value }))}
              placeholder="e.g. Join our next Founder Q&A this Friday at 5pm!"
              disabled={saving}
            />
            <Button variant="outline" onClick={() => void save(setting)} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Shown at the top of the Lounge for every Pro member. Leave empty to hide.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
