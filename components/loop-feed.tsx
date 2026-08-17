"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, ArrowUp } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { LoopCard } from "@/components/loop-card"
import { AdCard, type AdData } from "@/components/ads/ad-card"
import { normalizeLoops, type NormalizedLoop } from "@/lib/normalize-loop"
import { LoopFeedSkeleton } from "@/components/loading-states"
import { EmptyState } from "@/components/ui/empty-state"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { cn } from "@/lib/utils"

/** Max candidates the database ML recommendation engine can score per request. */
const ML_FETCH_LIMIT = 50
const PAGE_SIZE = 20

interface LoopFeedProps {
  feedType?: "personalized" | "following" | "trending" | "recent"
  showComposer?: boolean
  guestMode?: boolean
  topicFilter?: string
  searchQuery?: string
  viewMode?: "stream" | "cards" | "articles"
}

export function LoopFeed({
  feedType = "personalized",
  showComposer = false,
  guestMode = false,
  topicFilter = "all",
  searchQuery = "",
  viewMode = "stream"
}: LoopFeedProps) {
  const [loops, setLoops] = useState<NormalizedLoop[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingNew, setPendingNew] = useState<NormalizedLoop[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [interacting, setInteracting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { user, getAuthHeader } = useAuth()

  // --- Admin-controlled ads: server decides eligibility, the client only
  // places the cards. Frequency is randomized once per session (default
  // one ad every 50–70 organic posts).
  const [feedAds, setFeedAds] = useState<AdData[]>([])
  const [adsEligible, setAdsEligible] = useState(false)
  const adInsertIndexRef = useRef<number | null>(null)
  const adsInitializedRef = useRef(false)
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  )

  /**
   * For You pool: machine-ranked candidates + the standard personalized feed,
   * interleaved and deduped so the tab feels mixed and "just works" — no ML
   * chrome shown to the user.
   */
  const forYouPoolRef = useRef<NormalizedLoop[]>([])

  const interleavePools = (a: NormalizedLoop[], b: NormalizedLoop[]): NormalizedLoop[] => {
    const seen = new Set<string>()
    const out: NormalizedLoop[] = []
    const pushUnique = (item: NormalizedLoop) => {
      if (!item?.id || seen.has(item.id)) return
      seen.add(item.id)
      out.push(item)
    }
    const max = Math.max(a.length, b.length)
    for (let i = 0; i < max; i++) {
      if (i < a.length) pushUnique(a[i])
      if (i < b.length) pushUnique(b[i])
    }
    return out
  }
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
      // Guests can load public trending/recent without a token
      if (!authToken && !guestMode) {
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
        const headers: HeadersInit = { ...getAuthHeader() }
        if (authToken) headers.Authorization = `Bearer ${authToken}`

        let fetchedLoops: NormalizedLoop[] = []
        let hasMore = false

        if (feedType === "personalized" && authToken) {
          // For You = a mixed pool: the ML-ranked candidate set interleaved
          // with the regular personalized feed, so it never looks like a pure
          // algorithm tab. Rebuild the pool on reset; extend it as the user
          // scrolls past the first page.
          let pool = forYouPoolRef.current
          if (pool.length === 0 || offset === 0) {
            const [mlRes, feedRes] = await Promise.all([
              fetch(`/api/ml/recommendations?limit=${ML_FETCH_LIMIT}`, { headers, cache: "no-store" }),
              fetch(`/api/loops/feed?type=personalized&limit=${PAGE_SIZE * 3}&offset=0`, { headers, cache: "no-store" }),
            ])
            const mlData = await mlRes.json().catch(() => ({}))
            const feedData = await feedRes.json().catch(() => ({}))
            if (!mlRes.ok && !feedRes.ok) {
              throw new Error(mlData.error || feedData.error || "Failed to load loops")
            }
            pool = interleavePools(normalizeLoops(mlData.loops || []), normalizeLoops(feedData.loops || []))
            forYouPoolRef.current = pool
          }
          if (offset >= pool.length) {
            const feedRes = await fetch(
              `/api/loops/feed?type=personalized&limit=${PAGE_SIZE * 2}&offset=${pool.length}`,
              { headers, cache: "no-store" },
            )
            const feedData = await feedRes.json().catch(() => ({}))
            pool = interleavePools(pool, normalizeLoops(feedData.loops || []))
            forYouPoolRef.current = pool
          }
          fetchedLoops = pool.slice(offset, offset + PAGE_SIZE)
          hasMore = offset + PAGE_SIZE < pool.length
        } else {
          const response = await fetch(`/api/loops/feed?type=${feedType}&limit=${PAGE_SIZE}&offset=${offset}`, {
            headers,
            cache: "no-store",
          })

          const data = await response.json().catch(() => ({}))

          if (!response.ok || data.success === false) {
            throw new Error(data.error || "Failed to load loops")
          }

          fetchedLoops = normalizeLoops(data.loops || [])
          hasMore = Boolean(data.hasMore)
        }

        if (reset) {
          setLoops(fetchedLoops)
          newestSeenAt.current = fetchedLoops[0]?.created_at || null
        } else {
          setLoops((prev) => {
            const ids = new Set(prev.map((l) => l.id))
            return [...prev, ...fetchedLoops.filter((l) => !ids.has(l.id))]
          })
        }
        setHasMore(hasMore)
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
    [authToken, feedType, getAuthHeader, toast, guestMode],
  )

  /** Fetch only loops newer than current top — prepend, don't reshuffle */
  const fetchNewer = useCallback(
    async (opts?: { silent?: boolean; apply?: boolean }) => {
      // The ML engine re-ranks the whole candidate set; incremental "since"
      // sync doesn't apply. Hard refresh re-runs the engine instead.
      if (feedType === "personalized") return []
      if (!newestSeenAt.current) return []
      if (!authToken && !guestMode) return []
      if (!opts?.silent) setRefreshing(true)
      try {
        const headers: HeadersInit = { ...getAuthHeader() }
        if (authToken) headers.Authorization = `Bearer ${authToken}`
        const response = await fetch(
          `/api/loops/feed?type=${feedType}&limit=30&since=${encodeURIComponent(newestSeenAt.current)}`,
          {
            headers,
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
    [authToken, feedType, getAuthHeader, guestMode],
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
    newestSeenAt.current = null
    fetchLoops(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authToken, feedType, guestMode])

  // Fetch ad eligibility + creatives once per session (home feed only).
  useEffect(() => {
    if (adsInitializedRef.current) return
    const isHomeFeed = ["personalized", "following", "trending", "recent"].includes(feedType)
    if (!isHomeFeed) return
    adsInitializedRef.current = true
    const token = user?.access_token || user?.token
    ;(async () => {
      try {
        const eligibilityRes = await fetch("/api/ads/feed", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        })
        const eligibility = await eligibilityRes.json().catch(() => ({ eligible: false }))
        if (!eligibility.eligible) return
        const adsRes = await fetch("/api/ads/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 2 }),
          cache: "no-store",
        })
        const adsData = await adsRes.json().catch(() => ({ ads: [] }))
        if (!adsData.ads?.length) return
        // Randomize the gap within the 50–70 range once per session.
        const gap = 50 + Math.floor(Math.random() * 21)
        adInsertIndexRef.current = gap
        setFeedAds(adsData.ads)
        setAdsEligible(true)
      } catch {
        // Ads are progressive enhancement — never break the feed.
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedType])

  // After composing a loop — soft-refresh newer posts instead of full page reload
  useEffect(() => {
    const onCreated = () => {
      void (async () => {
        await new Promise((r) => setTimeout(r, 350))
        const newer = await fetchNewer({ silent: true, apply: true })
        if (!newer.length) await fetchLoops(true)
      })()
    }
    window.addEventListener("loop-created", onCreated)
    return () => window.removeEventListener("loop-created", onCreated)
  }, [fetchNewer, fetchLoops])

  /** Re-fetch a single loop and patch it into the feed (used for live edits). */
  const refreshLoop = useCallback(
    async (loopId: string) => {
      if (!loopId) return
      try {
        const headers: HeadersInit = { ...getAuthHeader() }
        if (authToken) headers.Authorization = `Bearer ${authToken}`
        const res = await fetch(`/api/loops/${loopId}`, { headers, cache: "no-store" })
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        const fresh = normalizeLoops([data.loop || data]).filter(Boolean)
        if (!fresh.length) return
        const updated = fresh[0]
        setLoops((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)))
        setPendingNew((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)))
      } catch {
        /* non-fatal — the next manual refresh will reconcile */
      }
    },
    [authToken, getAuthHeader],
  )

  // Live inserts → banner; live deletes/updates + stats → reconcile in place
  // (no page refresh needed). postgres_changes delivery works because loops
  // and loop_stats are readable by everyone via RLS.
  useEffect(() => {
    if (!user?.id && !guestMode) return
    const supabase = getSupabaseBrowserClient()
    const channelKey = `feed-live:${feedType}:${user?.id || "guest"}`
    const channel = supabase
      .channel(channelKey)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "loops" }, async () => {
        const newer = await fetchNewer({ silent: true })
        if (!newer.length) return
        setPendingNew((prev) => {
          const ids = new Set(prev.map((l) => l.id))
          const unique = newer.filter((l) => !ids.has(l.id))
          return [...unique, ...prev]
        })
      })
      // A loop was deleted (author or admin) → drop it everywhere instantly.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "loops" }, (payload: any) => {
        const deletedId: string | undefined = payload.old?.id
        if (!deletedId) return
        setLoops((prev) => prev.filter((l) => l.id !== deletedId))
        setPendingNew((prev) => prev.filter((l) => l.id !== deletedId))
      })
      // A loop was edited → refresh that single card in place.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loops", filter: "visibility=eq.public" },
        (payload: any) => {
          const updatedId: string | undefined = payload.new?.id
          if (!updatedId) return
          void refreshLoop(updatedId)
        },
      )
      // Stats (likes / comments / shares) change → live-update the counters.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loop_stats" },
        (payload: any) => {
          const stats = payload.new as { loop_id?: string; likes_count?: number; comments_count?: number; shares_count?: number; views_count?: number } | undefined
          if (!stats?.loop_id) return
          setLoops((prev) =>
            prev.map((l) =>
              l.id === stats.loop_id
                ? {
                    ...l,
                    stats: {
                      ...l.stats,
                      likes_count: stats.likes_count ?? l.stats?.likes_count,
                      comments_count: stats.comments_count ?? l.stats?.comments_count,
                      shares_count: stats.shares_count ?? l.stats?.shares_count,
                      views_count: stats.views_count ?? l.stats?.views_count,
                    },
                  }
                : l,
            ),
          )
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, feedType, fetchNewer, guestMode, refreshLoop])

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
        title: "Sign in required",
        description: "Log in to like and save loops.",
      })
      return
    }

    // Optimistic UI — update immediately, reconcile with server
    let snapshot: typeof loops | null = null
    setLoops((prev) => {
      snapshot = prev
      return prev.map((loop) => {
        if (loop.id !== loopId) return loop
        const next = {
          ...loop,
          user_interactions: { ...loop.user_interactions },
          stats: { ...loop.stats },
        }
        if (type === "like") {
          const wasLiked = Boolean(loop.user_interactions?.is_liked)
          next.user_interactions.is_liked = !wasLiked
          next.stats.likes_count = Math.max(0, Number(loop.stats?.likes_count || 0) + (wasLiked ? -1 : 1))
        } else {
          next.user_interactions.is_saved = !Boolean(loop.user_interactions?.is_saved)
        }
        return next
      })
    })

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

      const data = await response.json().catch(() => ({}))

      if (!response.ok || data.success === false) {
        if (snapshot) setLoops(snapshot)
        toast({
          title: "Error",
          description: data.error || "Failed to update interaction",
          variant: "destructive",
        })
        return
      }

      setLoops((prev) =>
        prev.map((loop) => {
          if (loop.id !== loopId) return loop
          const updatedLoop = { ...loop, user_interactions: { ...loop.user_interactions }, stats: { ...loop.stats } }
          if (type === "like") {
            const liked = Boolean(data.is_liked ?? data.is_active)
            updatedLoop.user_interactions.is_liked = liked
            if (data.stats) updatedLoop.stats = { ...updatedLoop.stats, ...data.stats }
            else updatedLoop.stats.likes_count = Number(data.stats?.likes_count ?? updatedLoop.stats.likes_count)
          } else if (type === "save") {
            const saved = Boolean(data.is_saved ?? data.is_active)
            updatedLoop.user_interactions.is_saved = saved
            toast({
              title: saved ? "Saved to Bookmarks" : "Removed from Bookmarks",
              description: saved ? "Find it anytime in Bookmarks." : undefined,
            })
          }
          return updatedLoop
        }),
      )
    } catch (err) {
      console.error("Error updating interaction:", err)
      if (snapshot) setLoops(snapshot)
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
        title={guestMode ? "No public loops yet" : "Your feed is ready"}
        description={
          guestMode
            ? "Check Explore or come back soon — creators are shipping."
            : feedType === "following"
              ? "Follow creators to fill this tab, or check For You / Recent."
              : "Create your first loop or explore trending stories to get started."
        }
        actionLabel={guestMode ? "Explore" : "Create a loop"}
        actionHref={guestMode ? "/explore" : "/create"}
      />
    )
  }

  const filteredLoops = loops.filter((loop) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const contentMatch = loop.content?.toLowerCase().includes(q)
      const authorMatch = loop.author?.username?.toLowerCase().includes(q) || loop.author?.display_name?.toLowerCase().includes(q)
      const tagMatch = loop.hashtags?.some((t) => t.toLowerCase().includes(q))
      if (!contentMatch && !authorMatch && !tagMatch) return false
    }

    // Topic chip filter
    if (topicFilter && topicFilter !== "all") {
      const tf = topicFilter.toLowerCase()
      const hasTag = loop.hashtags?.some((t) => t.toLowerCase().includes(tf) || tf.includes(t.toLowerCase()))
      const contentIncludes = loop.content?.toLowerCase().includes(tf)
      if (!hasTag && !contentIncludes) return false
    }

    return true
  })

  if (filteredLoops.length === 0 && loops.length > 0) {
    return (
      <EmptyState
        title="No matching loops"
        description={`No loops found matching "${searchQuery || topicFilter}". Try switching topics or clearing your search.`}
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

      <div className="flex items-center justify-end gap-2 px-1">
        {pendingNew.length > 0 ? (
          <button
            type="button"
            onClick={showPending}
            className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            {pendingNew.length} new {pendingNew.length === 1 ? "loop" : "loops"}
          </button>
        ) : (
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
        )}
      </div>

      <div
        className={cn(
          viewMode === "cards" && "grid gap-4 sm:grid-cols-2",
          viewMode === "articles" && "space-y-6",
          viewMode === "stream" && "space-y-4 sm:space-y-6"
        )}
      >
        {filteredLoops.map((loop, idx) => {
          const showAdHere =
            adsEligible && feedAds.length > 0 && adInsertIndexRef.current !== null && idx === adInsertIndexRef.current
          return (
            <div key={loop.id} className="space-y-1.5">
              {showAdHere && (
                <div className="mb-1.5">
                  <AdCard ad={feedAds[0]} sessionId={sessionIdRef.current} />
                </div>
              )}
              <LoopCard
                loop={loop}
                interacting={interacting}
                onInteraction={handleInteraction}
                onDeleted={(loopId) => setLoops((prev) => prev.filter((item) => item.id !== loopId))}
                onEdited={(updatedLoop) =>
                  setLoops((prev) => prev.map((item) => (item.id === updatedLoop.id ? updatedLoop : item)))
                }
              />
            </div>
          )
        })}
      </div>

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
