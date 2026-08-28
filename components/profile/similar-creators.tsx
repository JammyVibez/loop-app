"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { Users, Check, ArrowRight, Sparkles } from "lucide-react"

interface SimilarCreatorsProps {
  currentUserId: string
  circles?: string[]
}

interface Creator {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_verified?: boolean
  bio?: string
  followers_count?: number
  shared_interests?: string[]
}

export function SimilarCreators({ currentUserId, circles = [] }: SimilarCreatorsProps) {
  const { getAuthHeader, user } = useAuth()
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchSimilar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, circles])

  const fetchSimilar = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "5" })
      if (circles.length > 0) {
        params.set("circles", circles.slice(0, 3).join(","))
      }

      const res = await fetch(`/api/users/similar?${params}`, {
        headers: getAuthHeader(),
      })
      if (res.ok) {
        const data = await res.json()
        setCreators(
          (data.suggestions || data.users || [])
            .filter((u: any) => u.id !== currentUserId)
            .slice(0, 4)
            .map((u: any) => ({
              id: u.id,
              username: u.username,
              display_name: u.display_name || u.username,
              avatar_url: u.avatar_url,
              is_verified: u.is_verified,
              bio: u.bio,
              followers_count: u.follower_count || u.followers_count,
              shared_interests: u.shared_interests || [],
            }))
        )
      }
    } catch {
      // Fallback: use regular suggestions
      try {
        const res = await fetch("/api/users/suggestions?limit=4", {
          headers: getAuthHeader(),
        })
        if (res.ok) {
          const data = await res.json()
          setCreators(
            (data.suggestions || [])
              .filter((u: any) => u.id !== currentUserId)
              .slice(0, 4)
              .map((u: any) => ({
                id: u.id,
                username: u.username,
                display_name: u.display_name || u.username,
                avatar_url: u.avatar_url,
                is_verified: u.is_verified,
                bio: u.bio,
                followers_count: u.follower_count || u.followers_count,
              }))
          )
        }
      } catch {
        // Silent fail
      }
    } finally {
      setLoading(false)
    }
  }

  const handleFollow = async (userId: string) => {
    try {
      const res = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ target_user_id: userId, action: "follow" }),
      })
      if (res.ok) {
        setFollowedIds((prev) => new Set(prev).add(userId))
      }
    } catch {
      // Silent fail
    }
  }

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="h-4 w-40 bg-muted/50 rounded animate-pulse mb-3" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted/50 animate-pulse" />
                <div className="flex-1">
                  <div className="h-3 w-24 bg-muted/50 rounded animate-pulse mb-1" />
                  <div className="h-2 w-16 bg-muted/30 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (creators.length === 0) return null

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Similar Creators</h3>
        </div>

        <div className="space-y-2.5">
          {creators.map((creator) => (
            <div
              key={creator.id}
              className="flex items-center gap-3 group"
            >
              <Link href={`/profile/${creator.username}`}>
                <VideoAvatar
                  src={creator.avatar_url}
                  className="h-10 w-10 shrink-0"
                  fallback={creator.display_name?.charAt(0) || "U"}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/profile/${creator.username}`}
                  className="text-sm font-semibold hover:text-primary transition-colors flex items-center gap-1"
                >
                  {creator.display_name}
                  {creator.is_verified && (
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">✓</span>
                  )}
                </Link>
                <p className="text-xs text-muted-foreground truncate">
                  @{creator.username}
                  {creator.followers_count
                    ? ` · ${creator.followers_count >= 1000 ? `${(creator.followers_count / 1000).toFixed(1)}K` : creator.followers_count} followers`
                    : ""}
                </p>
                {creator.shared_interests && creator.shared_interests.length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {creator.shared_interests.slice(0, 2).map((interest) => (
                      <span
                        key={interest}
                        className="text-[9px] text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded-full"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {user?.id !== creator.id && (
                <Button
                  size="sm"
                  variant={followedIds.has(creator.id) ? "secondary" : "outline"}
                  className="shrink-0 rounded-full text-xs h-7"
                  disabled={followedIds.has(creator.id)}
                  onClick={() => handleFollow(creator.id)}
                >
                  {followedIds.has(creator.id) ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    "Follow"
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>

        <Link
          href="/explore"
          className="mt-3 flex items-center justify-center gap-1 text-xs text-primary hover:underline"
        >
          Discover more creators
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
