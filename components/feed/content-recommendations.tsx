"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { useAuth } from "@/hooks/use-auth"
import {
  Compass,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Hash,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface RecommendedLoop {
  id: string
  content_text?: string
  content_title?: string
  media_url?: string
  media_type?: string
  like_count?: number
  view_count?: number
  hashtags?: string[]
  author?: {
    id?: string
    username?: string
    display_name?: string
    avatar_url?: string
    is_verified?: boolean
  }
}

interface TrendingTag {
  tag: string
  count: number
  growth?: number
}

interface ContentRecommendationsProps {
  /** Current loop hashtags to find related content */
  currentHashtags?: string[]
  /** Current author to exclude from recommendations */
  currentAuthorId?: string
  /** Where this is embedded: "feed" = after feed, "post" = related to a post */
  context?: "feed" | "post"
}

export function ContentRecommendations({
  currentHashtags = [],
  currentAuthorId,
  context = "feed",
}: ContentRecommendationsProps) {
  const { user, getAuthHeader } = useAuth()
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRecommendations = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    setLoading(true)

    try {
      const tagsRes = await fetch("/api/search?q=&type=hashtags&limit=6", {
        headers: getAuthHeader(),
      }).then((r) => (r.ok ? r.json() : { hashtags: [] }))

      const tags = (tagsRes.hashtags || tagsRes.data || []).map((t: any) => ({
        tag: t.tag || t.name || t.hashtag || String(t),
        count: Number(t.count || t.post_count || 0),
        growth: Number(t.growth || t.trending_score || 0),
      }))

      setTrendingTags(tags)
    } catch (err) {
      console.error("Failed to load recommendations:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && !refreshing) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-2xl bg-muted/50 animate-pulse" />
        <div className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
      </div>
    )
  }

  if (trendingTags.length === 0) return null

  return (
    <div className="space-y-4 mt-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-cyan-500">
            <Compass className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-base font-bold">Discover More</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchRecommendations(true)}
          disabled={refreshing}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Trending Hashtags */}
      {trendingTags.length > 0 && (
        <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold">Trending now</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map((tag) => (
                <Link
                  key={tag.tag}
                  href={`/hashtag/${encodeURIComponent(tag.tag)}`}
                >
                  <Badge
                    variant="outline"
                    className="gap-1.5 py-1.5 px-3 cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-all text-xs"
                  >
                    <Hash className="h-3 w-3 text-primary/60" />
                    {tag.tag}
                    {tag.count > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {tag.count > 1000 ? `${(tag.count / 1000).toFixed(1)}k` : tag.count}
                      </span>
                    )}
                    {(tag.growth ?? 0) > 0 && (
                      <span className="text-[10px] text-emerald-500">
                        +{tag.growth}%
                      </span>
                    )}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/explore"
          className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card/60 p-3 hover:bg-card transition-all group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-semibold group-hover:text-primary transition-colors">Explore</p>
            <p className="text-[10px] text-muted-foreground">Browse all</p>
          </div>
        </Link>
        <Link
          href="/explore?tab=hashtags"
          className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card/60 p-3 hover:bg-card transition-all group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10">
            <TrendingUp className="h-4 w-4 text-rose-500" />
          </div>
          <div>
            <p className="text-xs font-semibold group-hover:text-primary transition-colors">Trending</p>
            <p className="text-[10px] text-muted-foreground">What&apos;s hot</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
