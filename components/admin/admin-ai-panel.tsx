"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Check, KeyRound, Loader2, PlugZap, Sparkles, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/skeletons"
import { Switch } from "@/components/ui/switch"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

type SafeProvider = {
  provider: string
  label: string
  model: string
  enabled: boolean
  key_hint: string
  last_checked_at: string | null
  last_error: string | null
}

type CatalogEntry = {
  id: string
  label: string
  keyUrl: string
  defaultModel: string
  suggestedModels: string[]
  note: string
}

export function AdminAiPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [providers, setProviders] = useState<SafeProvider[]>([])
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [form, setForm] = useState({ provider: "gemini", model: "", apiKey: "" })

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/providers", { headers: getAuthHeader(), cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not load AI providers")
      setProviders(Array.isArray(data.providers) ? data.providers : [])
      setCatalog(Array.isArray(data.catalog) ? data.catalog : [])
    } catch (error: any) {
      toast({ title: "AI settings unavailable", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, toast])

  useEffect(() => {
    void load()
  }, [load])

  const selected = catalog.find((entry) => entry.id === form.provider)
  const activeProvider = providers.find((row) => row.enabled)

  const save = async () => {
    if (!form.apiKey.trim()) {
      toast({ title: "Paste the API key", variant: "destructive" })
      return
    }
    setBusy("save")
    try {
      const res = await fetch("/api/admin/ai/providers", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          model: form.model || selected?.defaultModel || "",
          api_key: form.apiKey.trim(),
          enabled: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not save the key")
      setProviders(Array.isArray(data.providers) ? data.providers : [])
      setForm({ provider: form.provider, model: "", apiKey: "" })
      toast({ title: `${selected?.label || form.provider} connected`, description: "Run a test to confirm the key works." })
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const toggle = async (row: SafeProvider, enabled: boolean) => {
    setBusy(row.provider)
    // Only one provider drives Loop AI at a time.
    const others = providers.filter((p) => p.provider !== row.provider && enabled && p.enabled)
    try {
      for (const other of others) {
        await fetch("/api/admin/ai/providers", {
          method: "POST",
          headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify({ provider: other.provider, model: other.model, enabled: false }),
        })
      }
      const res = await fetch("/api/admin/ai/providers", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ provider: row.provider, model: row.model, enabled }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not update the provider")
      setProviders(Array.isArray(data.providers) ? data.providers : [])
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const test = async (row: SafeProvider) => {
    setBusy(`test:${row.provider}`)
    try {
      const res = await fetch("/api/admin/ai/test", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ provider: row.provider }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data.error || "The provider rejected the request")
      toast({ title: `${data.label} replied`, description: `Model ${data.model}: “${data.reply}”` })
      await load()
    } catch (error: any) {
      toast({ title: "Test failed", description: error.message, variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const remove = async (row: SafeProvider) => {
    const ok = await confirmDialog({
      title: `Remove ${row.label}?`,
      description: "Its stored key is deleted. Loop AI falls back to another enabled provider, or goes offline if none remain.",
      confirmLabel: "Remove provider",
      destructive: true,
    })
    if (!ok) return
    setBusy(`remove:${row.provider}`)
    try {
      const res = await fetch(`/api/admin/ai/providers?provider=${encodeURIComponent(row.provider)}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not remove the provider")
      setProviders(Array.isArray(data.providers) ? data.providers : [])
      toast({ title: `${row.label} removed` })
    } catch (error: any) {
      toast({ title: "Remove failed", description: error.message, variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Loop AI providers
          </CardTitle>
          <CardDescription>
            Keys are encrypted before they are stored and never sent back to the browser. The enabled provider answers
            every Loop AI conversation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : providers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No provider connected yet. Loop AI stays offline until a key is added below.
            </p>
          ) : (
            providers.map((row) => (
              <div
                key={row.provider}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{row.label}</p>
                    {row.enabled && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Check className="h-3 w-3" /> Active
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {row.model} · key {row.key_hint}
                  </p>
                  {row.last_error ? (
                    <p className="mt-1 text-xs text-rose-500">Last error: {row.last_error}</p>
                  ) : row.last_checked_at ? (
                    <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Last check passed</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={row.enabled}
                    disabled={busy === row.provider}
                    onCheckedChange={(checked) => void toggle(row, checked)}
                    aria-label={`Enable ${row.label}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 rounded-full px-3 text-xs"
                    onClick={() => void test(row)}
                    disabled={busy === `test:${row.provider}`}
                  >
                    {busy === `test:${row.provider}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlugZap className="h-3.5 w-3.5" />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-rose-500"
                    onClick={() => void remove(row)}
                    disabled={busy === `remove:${row.provider}`}
                    aria-label={`Remove ${row.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
          {activeProvider && (
            <p className="pt-1 text-xs text-muted-foreground">
              Loop AI is answering with <span className="font-medium text-foreground">{activeProvider.label}</span> (
              {activeProvider.model}).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            Add or replace a key
          </CardTitle>
          <CardDescription>Paste a provider key. It is encrypted with the server secret on the way in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-provider">Provider</Label>
              <select
                id="ai-provider"
                value={form.provider}
                onChange={(event) => setForm({ ...form, provider: event.target.value, model: "" })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {(catalog.length ? catalog : []).map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                list="ai-model-options"
                value={form.model}
                placeholder={selected?.defaultModel || "model id"}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
              />
              <datalist id="ai-model-options">
                {(selected?.suggestedModels || []).map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-key">API key</Label>
            <Input
              id="ai-key"
              type="password"
              autoComplete="off"
              value={form.apiKey}
              placeholder="Paste the key from the provider console"
              onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
            />
            {selected && (
              <p className="text-xs text-muted-foreground">
                {selected.note} Get a key at{" "}
                <a
                  href={selected.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  {selected.keyUrl.replace(/^https?:\/\//, "")}
                </a>
                .
              </p>
            )}
          </div>

          <Button onClick={() => void save()} disabled={busy === "save"} className="gap-2 rounded-full">
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            Save provider
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
