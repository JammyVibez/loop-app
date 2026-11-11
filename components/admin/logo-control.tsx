"use client"

import { useCallback, useEffect, useState } from "react"
import { Image, Save } from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/skeletons"

export function LogoControl() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [logoUrl, setLogoUrl] = useState("/icons/icon.svg")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchLogo = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { headers: { ...getAuthHeader() } })
      const data = await res.json()
      const url = data?.settings?.app_logo?.logo_url || data?.data?.app_logo?.logo_url
      if (url) setLogoUrl(url)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    void fetchLogo()
  }, [fetchLogo])

  const saveLogo = async () => {
    if (!logoUrl.trim()) {
      toast({ title: "Logo URL required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ app_logo: { logo_url: logoUrl.trim() } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save logo")
      // Notify every mounted AppLogo to update instantly.
      window.dispatchEvent(new Event("loop-logo-changed"))
      try {
        sessionStorage.setItem("loop-app-logo", logoUrl.trim())
      } catch {
        /* ignore */
      }
      toast({ title: "Logo updated", description: "The new logo is live across the app." })
    } catch (error: any) {
      toast({ title: "Couldn't save logo", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-4 w-4 text-indigo-500" />
          App Logo
        </CardTitle>
        <CardDescription>
          Change the brand logo used in the header, sidebar, and auth screens — anywhere in the app — without a deploy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="Logo preview"
            className="h-16 w-16 rounded-2xl border border-border object-cover shadow-md"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.opacity = "0.4"
            }}
            onLoad={(e) => {
              ;(e.target as HTMLImageElement).style.opacity = "1"
            }}
          />
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="logo-url">Logo URL</Label>
            <Input
              id="logo-url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://… or /icons/icon.svg"
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchLogo()}>
            Reset
          </Button>
          <Button size="sm" onClick={() => void saveLogo()} disabled={saving || loading}>
            {saving ? <Spinner className="mr-1.5 h-4 w-4" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save logo
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
