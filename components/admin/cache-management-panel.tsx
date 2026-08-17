"use client"

import { useCallback, useEffect, useState } from "react"
import { Database, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface CacheEntry {
  id: string
  name: string
  description: string | null
  last_cleared_at: string | null
  cleared_count: number
}

export function CacheManagementPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [caches, setCaches] = useState<CacheEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [clearingId, setClearingId] = useState<string | null>(null)

  const fetchCaches = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cache", { headers: { ...getAuthHeader() } })
      const data = await res.json()
      if (res.ok) setCaches(data.caches || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    void fetchCaches()
  }, [fetchCaches])

  const clearCache = async (cache: CacheEntry) => {
    setClearingId(cache.id)
    try {
      const res = await fetch("/api/admin/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ cache_id: cache.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to clear cache")
      toast({ title: `${cache.name} cleared`, description: "Cache cleared. Changes will appear after refresh." })
      await fetchCaches()
    } catch (error: any) {
      toast({ title: "Couldn't clear cache", description: error.message, variant: "destructive" })
    } finally {
      setClearingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-500" />
            Cache Management
          </CardTitle>
          <CardDescription>
            Clear stale caches so users see the latest content immediately.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchCaches()}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading caches…
          </p>
        ) : caches.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No caches registered.</p>
        ) : (
          <div className="space-y-2">
            {caches.map((cache) => (
              <div
                key={cache.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/50 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {cache.name}
                    {cache.cleared_count > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        cleared {cache.cleared_count}×
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{cache.description}</p>
                  {cache.last_cleared_at && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                      Last cleared: {new Date(cache.last_cleared_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1 text-xs"
                  onClick={() => void clearCache(cache)}
                  disabled={clearingId === cache.id}
                >
                  {clearingId === cache.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Clear
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
