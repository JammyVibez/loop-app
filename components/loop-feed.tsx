"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { LoopCard } from "@/components/loop-card"
import { CreateLoopButton } from "@/components/create-loop-button"
import { normalizeLoops, type NormalizedLoop } from "@/lib/normalize-loop"

interface LoopAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_verified?: boolean
  is_premium?: boolean
}

interface LoopStats {
  likes_count: number
  comments_count: number
  branches_count: number
  shares_count: number
  views_count: number
}

interface Loop {
  id: string
  author_id: string
  content: string
  media_type: string
  media_url?: string
  hashtags?: string[]
  created_at: string
  author: LoopAuthor
  stats: LoopStats
  user_interactions: {
    is_liked: boolean
    is_saved: boolean
  }
}

interface LoopFeedProps {
  feedType?: "personalized" | "following" | "trending" | "recent"
}

export function LoopFeed({ feedType = "personalized" }: LoopFeedProps) {
  const [loops, setLoops] = useState<NormalizedLoop[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [interacting, setInteracting] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      fetchLoops(true)
    }
  }, [user, feedType])

  const fetchLoops = async (reset = false) => {
    if (!user?.token) return

    const currentLoading = reset ? setLoading : setLoadingMore
    currentLoading(true)

    try {
      const offset = reset ? 0 : loops.length
      const response = await fetch(
        `/api/loops/feed?type=${feedType}&limit=20&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      )

      const data = await response.json()

      if (data.success) {
        const fetchedLoops = normalizeLoops(data.loops || [])

        if (reset) {
          setLoops(fetchedLoops)
        } else {
          setLoops(prev => [...prev, ...fetchedLoops])
        }
        setHasMore(data.hasMore)
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load loops",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching loops:", error)
      toast({
        title: "Error",
        description: "Failed to load loops",
        variant: "destructive",
      })
    } finally {
      currentLoading(false)
    }
  }

  const handleInteraction = async (loopId: string, type: "like" | "save") => {
    if (!user?.token) {
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
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ interaction_type: type }),
      })

      const data = await response.json()

      if (data.success) {
        // Update the loop in the state
        setLoops(prev =>
          prev.map(loop => {
            if (loop.id === loopId) {
              const updatedLoop = { ...loop }
              if (type === "like") {
                updatedLoop.user_interactions.is_liked = data.is_active
                updatedLoop.stats = data.stats || updatedLoop.stats
              } else if (type === "save") {
                updatedLoop.user_interactions.is_saved = data.is_active
              }
              return updatedLoop
            }
            return loop
          })
        )
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update interaction",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating interaction:", error)
      toast({
        title: "Error",
        description: "Failed to update interaction",
        variant: "destructive",
      })
    } finally {
      setInteracting(null)
    }
  }

  // Add this callback to refresh feed after loop creation
  const handleLoopCreated = () => {
    // Add a small delay to ensure the loop is saved before fetching
    setTimeout(() => {
      fetchLoops(true)
    }, 500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading loops...</span>
      </div>
    )
  }

  if (loops.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          No loops found. Start following users or create your first loop!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Add create loop button at the top */}
      <CreateLoopButton onLoopCreated={handleLoopCreated} />
      {loops.map(loop => (
        <LoopCard
          key={loop.id}
          loop={loop}
          interacting={interacting}
          onInteraction={handleInteraction}
          onDeleted={(loopId) => setLoops(prev => prev.filter(loop => loop.id !== loopId))}
          onEdited={(updatedLoop) => setLoops(prev => prev.map(loop => loop.id === updatedLoop.id ? updatedLoop : loop))}
        />
      ))}

      {hasMore && (
        <div className="text-center">
          <Button
            onClick={() => fetchLoops(false)}
            disabled={loadingMore}
            variant="outline"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading more...
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
