"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Store, Save } from "lucide-react"
import { Spinner } from "@/components/ui/skeletons"

export function ShopControl() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [enabled, setEnabled] = useState(true)
  const [message, setMessage] = useState("We're building something amazing!")
  const [subtitle, setSubtitle] = useState("Our shop is being redesigned with new features and items. Check back soon or chat with support.")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        const s = data.settings?.shop_under_construction
        if (s) {
          setEnabled(!!s.enabled)
          setMessage(s.message || "")
          setSubtitle(s.subtitle || "")
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem("auth_token")
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shop_under_construction: { enabled, message, subtitle },
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Saved!", description: "Shop setting updated" })
      } else {
        toast({ title: "Error", description: data.error || "Failed to save", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-orange-200 dark:border-orange-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600">
          <Store className="h-5 w-5" />
          Shop Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Under Construction Mode</p>
            <p className="text-sm text-muted-foreground">
              When enabled, users see a "coming soon" page instead of the shop
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Headline Message</label>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                placeholder="We're building something amazing!"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subtitle</label>
              <Textarea
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={3}
                placeholder="Tell users what's coming..."
              />
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  )
}
