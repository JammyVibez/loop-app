"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, RefreshCw } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { LoopCard } from "@/components/loop-card"
import { normalizeLoops, type NormalizedLoop } from "@/lib/normalize-loop"
import { LoopFeedSkeleton } from "@/components/loading-states"
import { EmptyState } from "@/components/ui/empty-state"

interface LoopFeedProps {
  feedType?: "personalized" | "following" | "trending" | "recent"
  showComposer?: boolean
}

export function LoopFeed({ feedType = "personalized", showComposer = false }: LoopFeedProps) {
  const [loops, setLoops] = useState<NormalizedLoop[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [interacting, setInteracting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const authToken = user?.access_token || user?.token

  const fetchLoops = useCallback(async (reset = false) => {
    if (!authToken) {
      setLoading(false)
      setLoadingMore(false)
      return
    }

    if (reset) {
      setLoading(true)
      setError(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const offset = reset ? 0 : loops.length
      const response = await fetch(
        `/api/loops/feed?type=${feedType}&limit=20&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            ...getAuthHeader(),
          },
          cache: "no-store",
        },
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Failed to load loops")
      }

      const fetchedLoops = normalizeLoops(data.loops || [])

      if (reset) {
        setLoops(fetchedLoops)
      } else {
        setLoops((prev) => [...prev, ...fetchedLoops])
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
  }, [authToken, feedType, getAuthHeader, loops.length, toast])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      setLoops([])
      return
    }
    fetchLoops(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authToken, feedType])

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
    <div className="space-y-4 sm:space-y-6">
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
        <div className="text-center pb-4">
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
