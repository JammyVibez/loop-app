"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, ArrowUp } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { LoopCard } from "@/components/loop-card"
import { normalizeLoops, type NormalizedLoop } from "@/lib/normalize-loop"
import { LoopFeedSkeleton } from "@/components/loading-states"
import { EmptyState } from "@/components/ui/empty-state"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { cn } from "@/lib/utils"

interface LoopFeedProps {
  feedType?: "personalized" | "following" | "trending" | "recent"
  showComposer?: boolean
}

export function LoopFeed({ feedType = "personalized", showComposer = false }: LoopFeedProps) {
  const [loops, setLoops] = useState<NormalizedLoop[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingNew, setPendingNew] = useState<NormalizedLoop[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [interacting, setInteracting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const pullStartY = useRef<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const newestSeenAt = useRef<string | null>(null)
  const loopsLenRef = useRef(0)
  loopsLenRef.current = loops.length

  const authToken = user?.access_token || user?.token

  const updateNewest = (list: NormalizedLoop[]) => {
    const top = list[0]?.created_at
    if (!top) return
    if (!newestSeenAt.current || new Date(top).getTime() > new Date(newestSeenAt.current).getTime()) {
      newestSeenAt.current = top
    }
  }

  const fetchLoops = useCallback(
    async (reset = false) => {
      if (!authToken) {
        setLoading(false)
        setLoadingMore(false)
        return
      }

      if (reset) {
        setLoading(true)
        setError(null)
        setPendingNew([])
      } else {
        setLoadingMore(true)
      }

      try {
        const offset = reset ? 0 : loopsLenRef.current
        const response = await fetch(`/api/loops/feed?type=${feedType}&limit=20&offset=${offset}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            ...getAuthHeader(),
          },
          cache: "no-store",
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok || data.success === false) {
          throw new Error(data.error || "Failed to load loops")
        }

        const fetchedLoops = normalizeLoops(data.loops || [])

        if (reset) {
          setLoops(fetchedLoops)
          newestSeenAt.current = fetchedLoops[0]?.created_at || null
        } else {
          setLoops((prev) => {
            const ids = new Set(prev.map((l) => l.id))
            return [...prev, ...fetchedLoops.filter((l) => !ids.has(l.id))]
          })
        }
        setHasMore(Boolean(data.hasMore))
      } catch (err: any) {
        console.error("Error fetching loops:", err)
        setError(err?.message || "Failed to load loops")
        toast({
          title: "Error",
          description: err?.message || "Failed to load loops",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [authToken, feedType, getAuthHeader, toast],
  )

  /** Fetch only loops newer than current top — prepend, don't reshuffle */
  const fetchNewer = useCallback(
    async (opts?: { silent?: boolean; apply?: boolean }) => {
      if (!authToken || !newestSeenAt.current) return []
      if (!opts?.silent) setRefreshing(true)
      try {
        const response = await fetch(
          `/api/loops/feed?type=${feedType}&limit=30&since=${encodeURIComponent(newestSeenAt.current)}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              ...getAuthHeader(),
            },
            cache: "no-store",
          },
        )
        const data = await response.json().catch(() => ({}))
        if (!response.ok || data.success === false) return []
        const fetched = normalizeLoops(data.loops || [])
        if (!fetched.length) return []

        if (opts?.apply) {
          setLoops((prev) => {
            const ids = new Set(prev.map((l) => l.id))
            const unique = fetched.filter((l) => !ids.has(l.id))
            if (!unique.length) return prev
            updateNewest(unique)
            return [...unique, ...prev]
          })
          setPendingNew([])
        }
        return fetched
      } catch {
        return []
      } finally {
        if (!opts?.silent) setRefreshing(false)
      }
    },
    [authToken, feedType, getAuthHeader],
  )

  const showPending = () => {
    if (!pendingNew.length) return
    setLoops((prev) => {
      const ids = new Set(prev.map((l) => l.id))
      const unique = pendingNew.filter((l) => !ids.has(l.id))
      updateNewest(unique)
      return [...unique, ...prev]
    })
    setPendingNew([])
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const hardRefresh = async () => {
    setRefreshing(true)
    try {
      const newer = await fetchNewer({ silent: true, apply: true })
      if (!newer.length) {
        // No newer posts — soft-reload first page without wiping mid-scroll feel
        await fetchLoops(true)
      }
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!user) {
      setLoading(false)
      setLoops([])
      return
    }
    newestSeenAt.current = null
    fetchLoops(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authToken, feedType])

  // After composing a loop — soft-refresh newer posts instead of full page reload
  useEffect(() => {
    const onCreated = () => {
      void (async () => {
        // Small delay so DB write is visible
        await new Promise((r) => setTimeout(r, 350))
        const newer = await fetchNewer({ silent: true, apply: true })
        if (!newer.length) await fetchLoops(true)
      })()
    }
    window.addEventListener("loop-created", onCreated)
    return () => window.removeEventListener("loop-created", onCreated)
  }, [fetchNewer, fetchLoops])

  // Live inserts → banner (don't reshuffle the whole feed)
  useEffect(() => {
    if (!user?.id) return
    const supabase = getSupabaseBrowserClient()
    const channel = supabase
      .channel(`feed-live:${feedType}:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "loops" }, async () => {
        const newer = await fetchNewer({ silent: true })
        if (!newer.length) return
        setPendingNew((prev) => {
          const ids = new Set(prev.map((l) => l.id))
          const unique = newer.filter((l) => !ids.has(l.id))
          return [...unique, ...prev]
        })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, feedType, fetchNewer])

  // Pull-to-refresh (touch)
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) pullStartY.current = e.touches[0]?.clientY ?? null
      else pullStartY.current = null
    }
    const onMove = (e: TouchEvent) => {
      if (pullStartY.current == null) return
      const dy = (e.touches[0]?.clientY ?? 0) - pullStartY.current
      setPullDistance(Math.max(0, Math.min(80, dy * 0.45)))
    }
    const onEnd = () => {
      if (pullDistance > 48) void hardRefresh()
      pullStartY.current = null
      setPullDistance(0)
    }
    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchmove", onMove, { passive: true })
    window.addEventListener("touchend", onEnd)
    return () => {
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullDistance, authToken, feedType])

  const handleInteraction = async (loopId: string, type: "like" | "save") => {
    if (!authToken) {
      toast({
        title: "Authentication Required",
        description: "Please log in to interact with loops",
        variant: "destructive",
      })
      return
    }

    setInteracting(`${loopId}-${type}`)

    try {
      const response = await fetch(`/api/loops/${loopId}/interactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ interaction_type: type }),
      })

      const data = await response.json()

      if (data.success) {
        setLoops((prev) =>
          prev.map((loop) => {
            if (loop.id !== loopId) return loop
            const updatedLoop = { ...loop }
            if (type === "like") {
              updatedLoop.user_interactions = {
                ...updatedLoop.user_interactions,
                is_liked: data.is_active,
              }
              updatedLoop.stats = data.stats || updatedLoop.stats
            } else if (type === "save") {
              updatedLoop.user_interactions = {
                ...updatedLoop.user_interactions,
                is_saved: data.is_active,
              }
            }
            return updatedLoop
          }),
        )
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update interaction",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error updating interaction:", err)
      toast({
        title: "Error",
        description: "Failed to update interaction",
        variant: "destructive",
      })
    } finally {
      setInteracting(null)
    }
  }

  if (loading) {
    return <LoopFeedSkeleton />
  }

  if (error && loops.length === 0) {
    return (
      <EmptyState
        title="Couldn't load your feed"
        description={error}
        actionLabel="Try again"
        onAction={() => fetchLoops(true)}
      />
    )
  }

  if (loops.length === 0) {
    return (
      <EmptyState
        title="Your feed is ready"
        description={
          feedType === "following"
            ? "Follow creators to fill this tab, or check For You / Recent."
            : "Create your first loop or explore trending stories to get started."
        }
        actionLabel="Create a loop"
        actionHref="/create"
      />
    )
  }

  return (
    <div className="relative space-y-4 sm:space-y-6">
      {pullDistance > 8 && (
        <div className="flex justify-center text-xs text-muted-foreground" style={{ height: pullDistance }}>
          {pullDistance > 48 ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}

      <div className="sticky top-14 z-20 -mx-1 flex items-center justify-between gap-2 px-1 sm:top-16">
        {pendingNew.length > 0 ? (
          <button
            type="button"
            onClick={showPending}
            className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-500"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            {pendingNew.length} new {pendingNew.length === 1 ? "loop" : "loops"}
          </button>
        ) : (
          <div className="ml-auto">
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-muted-foreground"
              disabled={refreshing}
              onClick={() => void hardRefresh()}
              title="Refresh feed"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              <span className="ml-1.5 hidden sm:inline">Refresh</span>
            </Button>
          </div>
        )}
      </div>

      {loops.map((loop) => (
        <LoopCard
          key={loop.id}
          loop={loop}
          interacting={interacting}
          onInteraction={handleInteraction}
          onDeleted={(loopId) => setLoops((prev) => prev.filter((item) => item.id !== loopId))}
          onEdited={(updatedLoop) =>
            setLoops((prev) => prev.map((item) => (item.id === updatedLoop.id ? updatedLoop : item)))
          }
        />
      ))}

      {hasMore && (
        <div className="pb-4 text-center">
          <Button
            onClick={() => fetchLoops(false)}
            disabled={loadingMore}
            variant="outline"
            className="rounded-full border-white/15 bg-white/5 px-6"
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading more…
              </>
            ) : (
              "Load more loops"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
