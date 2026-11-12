"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Check, Film, Loader2 } from "lucide-react"

type ProviderStatus = {
  configured: boolean
  source: "environment" | "admin_settings" | null
  label: string
}

type Providers = { giphy?: ProviderStatus; klipy?: ProviderStatus }

/**
 * Admin-managed GIF/sticker credentials. Keys live in `admin_settings` (the
 * same store the Giphy key has always used) and are only ever sent upward.
 */
export function GifProvidersPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [providers, setProviders] = useState<Providers>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [giphy, setGiphy] = useState("")
  const [klipy, setKlipy] = useState("")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/integrations/gifs", { headers: { ...getAuthHeader() } })
      const json = await res.json().catch(() => ({}))
      if (res.ok) setProviders(json.providers || {})
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!giphy.trim() && !klipy.trim()) {
      toast({ title: "Enter a key to save" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/integrations/gifs", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ giphy: giphy.trim(), klipy: klipy.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not save provider keys")
      setProviders(json.providers || {})
      setGiphy("")
      setKlipy("")
      toast({ title: "GIF providers updated", description: "Search results pick up the new keys immediately." })
    } catch (err: any) {
      toast({ title: "Could not save keys", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const statusBadge = (status?: ProviderStatus) => {
    if (loading) return <Badge variant="secondary">Checking…</Badge>
    if (!status?.configured) return <Badge variant="outline">Not configured</Badge>
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15">
        <Check className="h-3 w-3" />
        Connected {status.source === "environment" ? "(env)" : "(admin)"}
      </Badge>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Film className="h-4 w-4" />
          GIF &amp; sticker providers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Keys are stored server-side in Admin Settings and used only by the GIF search route — they never reach the
          browser. Klipy powers both GIF and sticker search.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="giphy-key" className="text-xs font-semibold">
                Giphy API key
              </label>
              {statusBadge(providers.giphy)}
            </div>
            <Input
              id="giphy-key"
              type="password"
              autoComplete="off"
              value={giphy}
              onChange={(event) => setGiphy(event.target.value)}
              placeholder={providers.giphy?.configured ? "Paste a new key to rotate" : "Paste Giphy key"}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="klipy-key" className="text-xs font-semibold">
                Klipy API key
              </label>
              {statusBadge(providers.klipy)}
            </div>
            <Input
              id="klipy-key"
              type="password"
              autoComplete="off"
              value={klipy}
              onChange={(event) => setKlipy(event.target.value)}
              placeholder={providers.klipy?.configured ? "Paste a new key to rotate" : "Paste Klipy key"}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <Button type="button" size="sm" onClick={() => void save()} disabled={saving || loading} className="gap-2">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save provider keys
        </Button>
      </CardContent>
    </Card>
  )
}
