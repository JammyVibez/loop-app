"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Hash, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { UserSuggestions } from "@/components/users/user-suggestions";

interface TrendingHashtag {
  tag: string
  count: number
}

export function TrendingSidebar() {
  const [trendingHashtags, setTrendingHashtags] = useState<TrendingHashtag[]>([])
  const [loading, setLoading] = useState(true)
  const { user, getAuthHeader } = useAuth()

  useEffect(() => {
    if (user) {
      void fetchTrendingData()
    }
  }, [user?.id])

  const fetchTrendingData = async () => {
    try {
      const hashtagResponse = await fetch("/api/search?q=trending&type=hashtags&limit=5", {
        headers: {
          ...getAuthHeader(),
        },
        cache: "no-store",
      })
      const hashtagData = await hashtagResponse.json()
      if (hashtagData.success && hashtagData.results && hashtagData.results.hashtags) {
        setTrendingHashtags(hashtagData.results.hashtags)
      } else {
        setTrendingHashtags([])
      }
    } catch (error) {
      console.error("Error fetching trending data:", error)
      setTrendingHashtags([])
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Hash className="h-5 w-5" />
            <span>Trending Hashtags</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : trendingHashtags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trending hashtags yet</p>
          ) : (
            <div className="space-y-3">
              {trendingHashtags.map((hashtag, index) => (
                <Link
                  key={hashtag.tag}
                  href={`/hashtag/${encodeURIComponent(hashtag.tag)}`}
                  className="-m-2 block rounded-lg p-2 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">#{hashtag.tag}</p>
                      <p className="text-xs text-muted-foreground">
                        {hashtag.count} loops
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <UserSuggestions title="Suggested for you" limit={5} compact />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            <span>Your Stats</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Loop Coins</span>
              <Badge variant="secondary">
                {user.loop_coins.toLocaleString()}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Account Type</span>
              <Badge variant={user.is_premium ? "default" : "outline"}>
                {user.is_premium ? "Premium" : "Free"}
              </Badge>
            </div>
            {user.is_verified && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="secondary">✓ Verified</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
