"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Download, Crown, Wallet, ShoppingBag, Sparkles, Loader2, User } from "lucide-react"

export function AccountSettings() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)

  const exportData = async () => {
    if (!user) return
    setExporting(true)
    try {
      // Pull the user's own content — loops, bookmarks, and profile — and
      // bundle it into a downloadable JSON file, entirely client-side.
      const headers = { ...getAuthHeader() }
      const [loopsRes, bookmarksRes] = await Promise.all([
        fetch(`/api/loops?user_id=${user.id}&limit=200`, { headers }),
        fetch("/api/bookmarks", { headers }),
      ])
      const loops = loopsRes.ok ? await loopsRes.json().catch(() => []) : []
      const bookmarks = bookmarksRes.ok ? await bookmarksRes.json().catch(() => []) : []
      const payload = {
        exported_at: new Date().toISOString(),
        profile: {
          username: user.username,
          display_name: user.display_name,
          bio: user.bio,
          website: user.website,
          location: user.location,
          pronouns: (user as any).pronouns,
          joined: (user as any).created_at,
        },
        loops: Array.isArray(loops) ? loops : loops.loops || loops.data || [],
        bookmarks: Array.isArray(bookmarks) ? bookmarks : bookmarks.bookmarks || bookmarks.data || [],
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `loop-data-${user.username || user.id}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Data exported", description: "Your loops and bookmarks were downloaded as JSON." })
    } catch {
      toast({ title: "Export failed", description: "Please try again in a moment.", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" /> Your plan
          </CardTitle>
          <CardDescription>Membership, balance, and upgrades.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Membership</p>
              <div className="mt-1 flex items-center gap-1.5">
                {user.is_premium ? (
                  <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Crown className="h-3 w-3" /> Premium
                  </Badge>
                ) : (
                  <Badge variant="outline">Free</Badge>
                )}
              </div>
              {!user.is_premium && (
                <Button asChild size="sm" variant="outline" className="mt-2 w-full rounded-full text-xs">
                  <Link href="/premium">
                    <Sparkles className="mr-1 h-3 w-3" /> Go Pro
                  </Link>
                </Button>
              )}
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Loop coins</p>
              <p className="mt-1 text-lg font-bold">{((user as any).loop_coins ?? 0).toLocaleString()}</p>
              <Button asChild size="sm" variant="outline" className="mt-2 w-full rounded-full text-xs">
                <Link href="/wallet">
                  <Wallet className="mr-1 h-3 w-3" /> Wallet
                </Link>
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Level</p>
              <p className="mt-1 text-lg font-bold">{(user as any).level ?? 1}</p>
              <Button asChild size="sm" variant="outline" className="mt-2 w-full rounded-full text-xs">
                <Link href="/inventory">
                  <ShoppingBag className="mr-1 h-3 w-3" /> Inventory
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-5 w-5" /> Your data
          </CardTitle>
          <CardDescription>
            Download a copy of your loops and bookmarks as a JSON file. Account deletion lives in the Security tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportData} disabled={exporting} className="rounded-full">
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {exporting ? "Preparing export…" : "Export my data"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
