"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, Star } from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/skeletons"

export function AdminFeaturedPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [loops, setLoops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/featured", { headers: getAuthHeader() })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load")
      setLoops(data.loops || [])
    } catch (error: any) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, toast])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (loopId: string, currentlyFeatured: boolean) => {
    setBusyId(loopId)
    try {
      const response = await fetch("/api/admin/featured", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ loop_id: loopId, featured: !currentlyFeatured }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Update failed")
      setLoops((prev) => prev.map((l) => (l.id === loopId ? { ...l, is_featured: !currentlyFeatured } : l)))
      toast({ title: !currentlyFeatured ? "Featured" : "Unfeatured" })
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Featured loops</h2>
          <p className="text-sm text-muted-foreground">Highlight quality posts across Explore and discovery.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Spinner className="mr-2 h-5 w-5" /> Loading…
            </div>
          ) : loops.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No loops found.</p>
          ) : (
            loops.map((loop) => (
              <div key={loop.id} className="flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">@{loop.author?.username || "user"}</p>
                    {loop.is_featured && <Badge className="bg-amber-500 text-slate-900">Featured</Badge>}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{loop.content || loop.content_title}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={busyId === loop.id}
                  onClick={() => toggle(loop.id, Boolean(loop.is_featured))}
                >
                  <Star className="mr-1.5 h-3.5 w-3.5" />
                  {loop.is_featured ? "Unfeature" : "Feature"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
