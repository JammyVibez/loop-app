"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Check, Crown, ExternalLink, Plus, Users } from "@/components/icons/lucide-compat"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"

export function ProCirclePanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [circle, setCircle] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: "Loop Pro Lounge", description: "" })

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/circles?limit=100", { headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const pro = (data.circles || []).find((c: any) => c.is_premium_only)
        setCircle(pro || null)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    if (!form.name.trim() || creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          name: form.name.trim(),
          description:
            form.description.trim() ||
            "The private Pro community — founders, Q&As, priority voting, and the dev team. Auto-joined while your Pro subscription is active.",
          category: "pro",
          is_private: true,
          is_premium_only: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create Pro circle")
      setCircle(data.circle)
      toast({ title: "Pro community created 🎉", description: "All active Pro users were auto-added." })
    } catch (error: any) {
      toast({ title: "Couldn't create Pro circle", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const refreshMembership = async () => {
    if (!circle) return
    try {
      // Re-PUT the circle with is_premium_only:true to re-run the Pro backfill.
      const res = await fetch(`/api/circles/${circle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ is_premium_only: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to sync")
      toast({ title: "Membership synced", description: "All current Pro users are members." })
      void load()
    } catch (error: any) {
      toast({ title: "Sync failed", description: error.message || "Unknown error", variant: "destructive" })
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16 text-muted-foreground"><Spinner className="mr-2 h-5 w-5" /> Checking Pro community…</div>
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-400/30 bg-gradient-to-br from-amber-500/5 via-card to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4 text-amber-500" /> Pro-only Circle Community
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 text-sm lg:grid-cols-2">
            <div className="space-y-2">
              <p className="font-semibold">How it works</p>
              <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                <li>Only Pro users can see the circle exists (hidden from everyone else).</li>
                <li>Every active Pro user is <span className="font-medium text-foreground">auto-added</span> as a member.</li>
                <li>When a Pro subscription lapses, the user is <span className="font-medium text-foreground">auto-removed</span>.</li>
                <li>Members see a dedicated Slack-style workspace: channels, realtime chat, member rail.</li>
              </ul>
            </div>
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-4">
              <p className="text-center text-xs text-muted-foreground">
                Create it once — the database trigger keeps memberships in sync forever.
              </p>
            </div>
          </div>

          {circle ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground">
                  {circle.avatar_url ? (
                    <img src={circle.avatar_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <Crown className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{circle.name}</p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {circle.member_count} members
                    <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-[10px] text-amber-500">Pro only</Badge>
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/communities/${circle.id}`}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open workspace
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void refreshMembership()}>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Re-sync Pros
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-dashed border-amber-400/40 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="pro-name">Community name</Label>
                <Input id="pro-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pro-desc">Description</Label>
                <Textarea
                  id="pro-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="resize-none"
                />
              </div>
              <Button onClick={() => void create()} disabled={creating || !form.name.trim()} className={cn("w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-400 hover:to-orange-500")}>
                {creating ? <Spinner className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                Create Pro community
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
